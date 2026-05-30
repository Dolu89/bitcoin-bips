/**
 * Orchestrates an on-demand sync: lists upstream spec files, diffs by blob sha, upserts
 * changed specs (raw content + metadata; rendering deferred), resolves intra-project
 * references into the relatedOut pivot, captures the project home, and reports a summary.
 * Never deletes specs that vanished upstream (out of scope).
 */
import { inject } from '@adonisjs/core'
import { dirname } from 'node:path/posix'
import { DateTime } from 'luxon'
import Document from '#models/document'
import ProjectMeta from '#models/project_meta'
import SpecSourceService from '#services/spec_source_service'
import RenderingService from '#services/rendering_service'
import { parsePreamble, extractReferences, extractBody } from '#values/spec_parsing'
import { canonicalize } from '#values/document_number'
import type { ProjectConfig } from '#types/project'
import type { SyncSummary, SyncError } from '#types/ingestion'

/** Raw-content base URL for a repo file's directory — relative images resolve against it. */
function rawBaseUrl(repo: ProjectConfig['repo'], path: string): string {
  const dir = dirname(path)
  const prefix = dir === '.' ? '' : `${dir}/`
  return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch ?? 'HEAD'}/${prefix}`
}

@inject()
export default class IngestionService {
  constructor(
    protected source: SpecSourceService,
    protected rendering: RenderingService
  ) {}

  async syncProject(project: ProjectConfig): Promise<SyncSummary> {
    const errors: SyncError[] = []
    let added = 0
    let updated = 0
    let unchanged = 0

    // Existing catalog state for this project: number -> { id, hash } for the sha diff.
    const existingRows = await Document.query()
      .where('project', project.key)
      .select('id', 'number', 'hash', 'content_html')
    const existing = new Map(
      existingRows.map((row) => [
        row.number,
        { id: row.id, hash: row.hash, contentHtml: row.contentHtml },
      ])
    )

    const files = await this.source.listSpecFiles(project)

    // Specs whose body we parsed this run, so we can resolve their references afterwards.
    const refsByNumber = new Map<string, string[]>()

    for (const file of files) {
      const stored = existing.get(file.number)
      // Skip only when both the blob is unchanged AND a render already exists — so enabling
      // rendering backfills already-ingested specs without clearing their hashes.
      if (stored && stored.hash === file.sha && stored.contentHtml !== null) {
        unchanged++
        continue
      }

      try {
        const raw = await this.source.fetchContent(project, file.sha)
        const { title, preamble } = parsePreamble(project.parser, raw)

        // Render the changed spec; a per-spec render failure is recorded and leaves the
        // display columns untouched (stale on update, null on insert) without aborting the sync.
        let rendered = null
        try {
          rendered = await this.rendering.render({
            raw: extractBody(project.parser, raw),
            format: file.sourceFormat as 'mediawiki' | 'markdown',
            parser: project.parser,
            numberBase: project.numberBase,
            imageBaseUrl: rawBaseUrl(project.repo, file.path),
          })
        } catch (error) {
          errors.push({ number: file.number, message: `render: ${(error as Error).message}` })
        }

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
            ...(rendered
              ? {
                  contentHtml: rendered.contentHtml,
                  contentText: rendered.contentText,
                  toc: rendered.toc,
                }
              : {}),
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

    let rendered = null
    try {
      rendered = await this.rendering.render({
        raw,
        format: home.format as 'mediawiki' | 'markdown',
        parser: project.parser,
        numberBase: project.numberBase,
        imageBaseUrl: rawBaseUrl(project.repo, project.repo.homeFile ?? ''),
      })
    } catch {
      // Leave home_html unchanged on a render failure; the raw home is still captured.
    }

    await ProjectMeta.updateOrCreate(
      { project: project.key },
      {
        homeContent: raw,
        homeFormat: home.format,
        homeSourceUrl: home.url,
        homeHash: home.sha,
        ...(rendered ? { homeHtml: rendered.contentHtml } : {}),
      }
    )
  }
}
