/**
 * Orchestrates an on-demand sync: lists upstream spec files, diffs by blob sha, upserts
 * changed specs (raw content + metadata; rendering deferred), resolves intra-project
 * references into the relatedOut pivot, captures the project home, and reports a summary.
 * Never deletes specs that vanished upstream (out of scope).
 */
import { inject } from '@adonisjs/core'
import { dirname } from 'node:path/posix'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import logger from '@adonisjs/core/services/logger'
import Document from '#models/document'
import ProjectMeta from '#models/project_meta'
import SpecSourceService from '#services/spec_source_service'
import RenderingService from '#services/rendering_service'
import SearchService from '#services/search_service'
import { adapterFor } from '#values/adapters'
import { canonicalize } from '#values/document_number'
import type { ProjectConfig } from '#types/project'
import type {
  SyncSummary,
  SyncError,
  SpecFileRef,
  ReindexOutcome,
  FullSyncReport,
} from '#types/ingestion'

/** Most recent commits captured per spec — the "recent window" cap (revisable). */
const RECENT_COMMIT_LIMIT = 5

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
    protected rendering: RenderingService,
    protected search: SearchService
  ) {}

  async syncProject(project: ProjectConfig): Promise<SyncSummary> {
    const adapter = adapterFor(project.parser)
    const errors: SyncError[] = []
    let added = 0
    let updated = 0
    let unchanged = 0

    // Existing catalog state for this project: number -> { id, hash, contentHtml, commitsCount }.
    // The blob sha drives the content diff; contentHtml and commitsCount let an unrendered or
    // commit-less spec be backfilled when activating those capabilities.
    const existingRows = await Document.query()
      .where('project', project.key)
      .select('id', 'number', 'hash', 'content_html', 'commit_count')
      .withCount('commits')
    const existing = new Map(
      existingRows.map((row) => [
        row.number,
        {
          id: row.id,
          hash: row.hash,
          contentHtml: row.contentHtml,
          commitsCount: Number(row.$extras.commits_count ?? 0),
          commitCount: row.commitCount,
        },
      ])
    )

    const files = await this.source.listSpecFiles(project)

    // Specs whose body we parsed this run, so we can resolve their references afterwards.
    const refsByNumber = new Map<string, string[]>()

    for (const file of files) {
      const stored = existing.get(file.number)
      // Process the content when the blob changed or no render exists yet; capture commits when
      // the blob changed or none are stored yet (so enabling either capability backfills the
      // already-ingested catalog without clearing hashes). Skip only when neither is needed.
      const needsContent = !stored || stored.hash !== file.sha || stored.contentHtml === null
      const needsCommits =
        !stored ||
        stored.hash !== file.sha ||
        stored.commitsCount === 0 ||
        stored.commitCount === null
      if (!needsContent && !needsCommits) {
        unchanged++
        continue
      }

      try {
        let doc: Document
        if (needsContent) {
          const raw = await this.source.fetchContent(project, file.sha)
          const { title, preamble } = adapter.parsePreamble(raw)

          // Render the changed spec; a per-spec render failure is recorded and leaves the
          // display columns untouched (stale on update, null on insert) without aborting the sync.
          let rendered = null
          try {
            rendered = await this.rendering.render({
              raw: adapter.extractBody(raw),
              format: file.sourceFormat as 'mediawiki' | 'markdown',
              adapter,
              numberBase: project.numberBase,
              imageBaseUrl: rawBaseUrl(project.repo, file.path),
            })
          } catch (error) {
            errors.push({ number: file.number, message: `render: ${(error as Error).message}` })
          }

          doc = await Document.updateOrCreate(
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

          refsByNumber.set(file.number, adapter.extractReferences(raw))
          if (stored) {
            updated++
          } else {
            added++
          }
        } else {
          // Commit-only backfill: content is unchanged and already rendered.
          doc = await Document.findOrFail(stored!.id)
          unchanged++
        }

        if (needsCommits) {
          await this.captureCommits(project, file, doc, errors)
        }
      } catch (error) {
        errors.push({ number: file.number, message: (error as Error).message })
      }
    }

    const links = await this.resolveLinks(project, refsByNumber)
    await this.captureHome(project)

    await ProjectMeta.updateOrCreate({ project: project.key }, { lastUpdate: DateTime.now() })

    // Refresh the search index best-effort — a down/missing Meilisearch must not fail the sync.
    // Logged and swallowed, never added to `errors` (reserved for per-spec ingestion failures).
    try {
      await this.search.reindexProject(project)
    } catch (error) {
      logger.warn(`[${project.key}] search reindex failed: ${(error as Error).message}`)
    }

    return { project: project.key, added, updated, unchanged, links, errors }
  }

  async syncAll(): Promise<SyncSummary[]> {
    const { projects } = await import('#config/projects')
    const summaries: SyncSummary[] = []
    for (const project of projects.filter((p) => p.enabled)) {
      // A whole-project failure (e.g. the upstream listing throws) is captured as an error
      // summary so one broken project never aborts the sync of the others.
      try {
        summaries.push(await this.syncProject(project))
      } catch (error) {
        summaries.push({
          project: project.key,
          added: 0,
          updated: 0,
          unchanged: 0,
          links: 0,
          errors: [{ number: '*', message: (error as Error).message }],
        })
      }
    }
    return summaries
  }

  /**
   * Full ordered sync for an external scheduler: ingest every enabled project, then — and only
   * once all ingests have completed — rebuild the search index for each. A whole-project ingest
   * failure (captured by syncAll) and a reindex failure are both recorded in the report rather
   * than aborting; the caller (the command) turns the report into an exit code.
   */
  async syncEverything(): Promise<FullSyncReport> {
    const { projects } = await import('#config/projects')
    const ingest = await this.syncAll()
    const reindex: ReindexOutcome[] = []
    for (const project of projects.filter((p) => p.enabled)) {
      // A reindex failure is captured (not swallowed like the per-project hook) so the command
      // can surface it and fail its exit code.
      try {
        const count = await this.search.reindexProject(project)
        reindex.push({ project: project.key, count })
      } catch (error) {
        reindex.push({ project: project.key, count: 0, error: (error as Error).message })
      }
    }
    return { ingest, reindex }
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

  /**
   * Replace a spec's stored commit history with the recent window fetched from the source.
   * Best-effort: the network fetch runs outside the transaction (no slow I/O inside it), and any
   * failure is recorded for this spec while the previously-captured history is left intact.
   */
  private async captureCommits(
    project: ProjectConfig,
    file: SpecFileRef,
    doc: Document,
    errors: SyncError[]
  ): Promise<void> {
    try {
      const commits = await this.source.listSpecCommits(project, file.path, RECENT_COMMIT_LIMIT)
      const total = await this.source.countSpecCommits(project, file.path)
      // first commit is immutable → fetch only when not yet captured (the network call stays out of
      // the transaction). last commit moves with each change → refreshed from the newest of the
      // newest-first window every sync.
      const firstCommitAt =
        doc.firstCommitAt ??
        (await this.source
          .firstCommitDate(project, file.path)
          .then((iso) => (iso ? DateTime.fromISO(iso) : null)))
      await db.transaction(async (trx) => {
        doc.useTransaction(trx)
        await doc.related('commits').query().delete()
        if (commits.length > 0) {
          await doc.related('commits').createMany(
            commits.map((commit) => ({
              hash: commit.hash,
              message: commit.message,
              author: commit.author,
              committedAt: DateTime.fromISO(commit.committedAt),
              additions: commit.additions,
              deletions: commit.deletions,
            }))
          )
        }
        doc.commitCount = total
        doc.firstCommitAt = firstCommitAt
        if (commits.length > 0) {
          doc.lastCommitAt = DateTime.fromISO(commits[0].committedAt)
        }
        await doc.save()
      })
    } catch (error) {
      errors.push({ number: file.number, message: `commits: ${(error as Error).message}` })
    }
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
        adapter: adapterFor(project.parser),
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
