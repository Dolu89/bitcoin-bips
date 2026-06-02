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
import type { ProjectAdapter } from '#types/project_adapter'
import type {
  SyncSummary,
  SyncError,
  SpecFileRef,
  ReindexOutcome,
  FullSyncReport,
} from '#types/ingestion'

/** Most recent commits captured per spec — the "recent window" cap (revisable). */
const RECENT_COMMIT_LIMIT = 5

/** Trailing-slash path prefix of a repo file's directory (`''` at the repo root). */
function repoDirPrefix(path: string): string {
  const dir = dirname(path)
  return dir === '.' ? '' : `${dir}/`
}

/** Raw-content base URL for a repo file's directory — relative images resolve against it. */
function rawBaseUrl(repo: ProjectConfig['repo'], path: string): string {
  return `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.branch ?? 'HEAD'}/${repoDirPrefix(path)}`
}

/** GitHub blob (human-viewable) base URL for a repo file's directory — non-spec links resolve against it. */
function blobBaseUrl(repo: ProjectConfig['repo'], path: string): string {
  return `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch ?? 'HEAD'}/${repoDirPrefix(path)}`
}

@inject()
export default class IngestionService {
  constructor(
    protected source: SpecSourceService,
    protected rendering: RenderingService,
    protected search: SearchService
  ) {}

  async syncProject(project: ProjectConfig): Promise<SyncSummary> {
    const adapter = adapterFor(project.adapter)
    const errors: SyncError[] = []
    let added = 0
    let updated = 0
    let unchanged = 0

    // Existing catalog state for this project: number -> { id, hash, rawContent, contentHtml, … }.
    // The blob sha drives the content diff; contentHtml and commitsCount let an unrendered or
    // commit-less spec be backfilled when activating those capabilities. rawContent lets a
    // render-only backfill re-render from the stored source, with no network round-trip.
    const existingRows = await Document.query()
      .where('project', project.key)
      .select('id', 'number', 'hash', 'raw_content', 'content_html', 'commit_count')
      .withCount('commits')
    const existing = new Map(
      existingRows.map((row) => [
        row.number,
        {
          id: row.id,
          hash: row.hash,
          rawContent: row.rawContent,
          contentHtml: row.contentHtml,
          commitsCount: Number(row.$extras.commits_count ?? 0),
          commitCount: row.commitCount,
        },
      ])
    )

    const files = await this.source.listSpecFiles(project)
    logger.info(`[${project.key}] ${files.length} spec files found; syncing changed ones…`)

    let seen = 0
    for (const file of files) {
      seen++
      // Progress beacon so a long first sync (every spec changed) never looks dead.
      if (seen % 25 === 0) {
        logger.info(
          `[${project.key}] ${seen}/${files.length} processed (added ${added}, updated ${updated})`
        )
      }
      const stored = existing.get(file.number)
      // Process the content when the blob changed or no render exists yet; capture commits when
      // the blob changed or none are stored yet (so enabling either capability backfills the
      // already-ingested catalog without clearing hashes). Skip only when neither is needed.
      const blobChanged = !stored || stored.hash !== file.sha
      const needsContent = blobChanged || stored.contentHtml === null
      const needsCommits = blobChanged || stored.commitsCount === 0 || stored.commitCount === null
      if (!needsContent && !needsCommits) {
        unchanged++
        continue
      }

      try {
        let doc: Document
        if (needsContent) {
          // Fetch only when the blob actually changed (or we have no stored source); a render-only
          // backfill re-renders from the stored rawContent, so it costs no GitHub round-trip.
          const raw =
            blobChanged || !stored?.rawContent
              ? await this.source.fetchContent(project, file.sha)
              : stored.rawContent
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
              linkBaseUrl: blobBaseUrl(project.repo, file.path),
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

    const links = await this.resolveLinks(project, adapter)
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
   * Rebuild the relatedOut pivot for the whole project from each spec's stored rawContent.
   * Decoupled from the per-run content diff so links self-heal: a spec whose content did not
   * change this sync — or whose pivot rows were lost to a schema rebuild — still gets its edges
   * re-resolved, since references are a regex over already-stored content (no network). A
   * reference to a number absent from the catalog is dropped (the pivot cannot hold an unresolved
   * ref). Returns the count of edges written.
   */
  private async resolveLinks(project: ProjectConfig, adapter: ProjectAdapter): Promise<number> {
    const docs = await Document.query()
      .where('project', project.key)
      .select('id', 'number', 'rawContent')
    const idByNumber = new Map(docs.map((doc) => [doc.number, doc.id]))

    let links = 0
    for (const doc of docs) {
      const targetIds = new Set<number>()
      for (const rawRef of adapter.extractReferences(doc.rawContent ?? '')) {
        const canonical = canonicalize(rawRef, project.numberBase)
        if (canonical === null || canonical === doc.number) {
          continue
        }
        const toId = idByNumber.get(canonical)
        if (toId) {
          targetIds.add(toId)
        }
      }
      await doc.related('relatedOut').sync([...targetIds])
      links += targetIds.size
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
    // No curated home configured → clear anything a previous config captured, so the index
    // falls back to the table variant. Keyed on config (not a null findHome) so a transient
    // fetch failure for a project that *does* have a homeFile never wipes its captured home.
    if (!project.repo.homeFile) {
      await this.clearHome(project)
      return
    }

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
        adapter: adapterFor(project.adapter),
        numberBase: project.numberBase,
        imageBaseUrl: rawBaseUrl(project.repo, project.repo.homeFile ?? ''),
        linkBaseUrl: blobBaseUrl(project.repo, project.repo.homeFile ?? ''),
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

  /**
   * Null out a previously captured home (e.g. its homeFile was removed from config). No-op when
   * already empty — homeContent is the sentinel since the capture path always writes it together
   * with the rest, so a null one means the whole group is clear and no write is needed.
   */
  private async clearHome(project: ProjectConfig): Promise<void> {
    const meta = await ProjectMeta.find(project.key)
    if (!meta || meta.homeContent === null) {
      return
    }
    meta.homeContent = null
    meta.homeFormat = null
    meta.homeSourceUrl = null
    meta.homeHash = null
    meta.homeHtml = null
    await meta.save()
  }
}
