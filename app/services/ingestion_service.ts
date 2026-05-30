/**
 * Orchestrates an on-demand sync: lists upstream spec files, diffs by blob sha, upserts
 * changed specs (raw content + metadata; rendering deferred), resolves intra-project
 * references into the relatedOut pivot, captures the project home, and reports a summary.
 * Never deletes specs that vanished upstream (out of scope).
 */
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import Document from '#models/document'
import ProjectMeta from '#models/project_meta'
import SpecSourceService from '#services/spec_source_service'
import { parsePreamble, extractReferences } from '#values/spec_parsing'
import { canonicalize } from '#values/document_number'
import type { ProjectConfig } from '#types/project'
import type { SyncSummary, SyncError } from '#types/ingestion'

@inject()
export default class IngestionService {
  constructor(protected source: SpecSourceService) {}

  async syncProject(project: ProjectConfig): Promise<SyncSummary> {
    const errors: SyncError[] = []
    let added = 0
    let updated = 0
    let unchanged = 0

    // Existing catalog state for this project: number -> { id, hash } for the sha diff.
    const existingRows = await Document.query()
      .where('project', project.key)
      .select('id', 'number', 'hash')
    const existing = new Map(
      existingRows.map((row) => [row.number, { id: row.id, hash: row.hash }])
    )

    const files = await this.source.listSpecFiles(project)

    // Specs whose body we parsed this run, so we can resolve their references afterwards.
    const refsByNumber = new Map<string, string[]>()

    for (const file of files) {
      const stored = existing.get(file.number)
      if (stored && stored.hash === file.sha) {
        unchanged++
        continue
      }

      try {
        const raw = await this.source.fetchContent(project, file.sha)
        const { title, preamble } = parsePreamble(project.parser, raw)

        await Document.updateOrCreate(
          { project: project.key, number: file.number },
          {
            title,
            preamble: JSON.stringify(preamble),
            sourceFormat: file.sourceFormat,
            sourceUrl: file.sourceUrl,
            sortOrder: file.sortOrder,
            rawContent: raw,
            hash: file.sha,
          }
        )

        refsByNumber.set(file.number, extractReferences(project.parser, raw))
        if (stored) {
          updated++
        } else {
          added++
        }
      } catch (error) {
        errors.push({ number: file.number, message: (error as Error).message })
      }
    }

    const links = await this.resolveLinks(project, refsByNumber)
    await this.captureHome(project)

    await ProjectMeta.updateOrCreate({ project: project.key }, { lastUpdate: DateTime.now() })

    return { project: project.key, added, updated, unchanged, links, errors }
  }

  async syncAll(): Promise<SyncSummary[]> {
    const { projects } = await import('#config/projects')
    const summaries: SyncSummary[] = []
    for (const project of projects.filter((p) => p.enabled)) {
      summaries.push(await this.syncProject(project))
    }
    return summaries
  }

  /**
   * Resolve raw references to known specs in this project and sync the relatedOut pivot.
   * References to a number absent from the catalog are dropped (the pivot cannot hold an
   * unresolved ref). Returns the count of edges written.
   */
  private async resolveLinks(
    project: ProjectConfig,
    refsByNumber: Map<string, string[]>
  ): Promise<number> {
    if (refsByNumber.size === 0) {
      return 0
    }

    // Rebuild number -> id including specs just inserted this run.
    const rows = await Document.query().where('project', project.key).select('id', 'number')
    const idByNumber = new Map(rows.map((row) => [row.number, row.id]))

    let links = 0
    for (const [number, rawRefs] of refsByNumber) {
      const fromId = idByNumber.get(number)
      if (!fromId) {
        continue
      }
      const targetIds: number[] = []
      for (const rawRef of rawRefs) {
        const canonical = canonicalize(rawRef, project.numberBase)
        if (canonical === null || canonical === number) {
          continue
        }
        const toId = idByNumber.get(canonical)
        if (toId) {
          targetIds.push(toId)
        }
      }
      const doc = await Document.findOrFail(fromId)
      await doc.related('relatedOut').sync(targetIds)
      links += targetIds.length
    }

    return links
  }

  /** Capture the project's curated home file, skipping the download when the sha is unchanged. */
  private async captureHome(project: ProjectConfig): Promise<void> {
    const home = await this.source.findHome(project)
    if (!home) {
      return
    }
    const meta = await ProjectMeta.find(project.key)
    if (meta && meta.homeHash === home.sha) {
      return
    }
    const raw = await this.source.fetchContent(project, home.sha)
    await ProjectMeta.updateOrCreate(
      { project: project.key },
      {
        homeContent: raw,
        homeFormat: home.format,
        homeSourceUrl: home.url,
        homeHash: home.sha,
      }
    )
  }
}
