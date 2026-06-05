import type { CheerioAPI } from 'cheerio'
import type Document from '#models/document'
import type { Preamble } from '#types/preamble'
import type { ProjectConfig } from '#types/project'
import type { SearchRecord } from '#types/search'
import type { CatalogView, DocumentView, SearchHitView } from '#types/view_models'

/**
 * A project adapter holds ALL the code specific to one kind of spec project (BIPs, NIPs, …).
 * The codebase is split into two layers:
 *
 *   1. DATA — parsing/transforming a project's raw source (parsePreamble, extractBody,
 *      extractReferences, rewriteInternalLinks). Custom per project.
 *   2. DISPLAY — turning a stored Document into the typed "slot contract" (`#types/view_models`)
 *      that the shared controllers + Edge templates render. The frontend NEVER branches on project
 *      identity; it is each adapter's job to fill the slots it can (buildDocumentView,
 *      buildCatalogView, buildSearchRecord, buildSearchHit).
 *
 * Consequence: adding a project = write one `app/values/adapters/<id>.ts` implementing this
 * interface + register it in `app/values/adapters/index.ts` + add a `config/projects.ts` entry
 * with `adapter: '<id>'`. Zero edits to shared controllers/templates.
 *
 * An adapter is stateless: one instance serves every project that selects it, so per-project data
 * (label, numberBase, repo, …) is passed in as arguments via `ProjectConfig` rather than captured.
 * Internal helpers (value→Badge/tone mapping, date formatting, …) stay PRIVATE to each adapter
 * module; only these methods are part of the contract.
 */
export interface ProjectAdapter {
  /** Registry id, matched against `ProjectConfig.adapter`. */
  readonly id: string

  // ── Data ──────────────────────────────────────────────────────────────────────────────────

  /** Parse the raw source into the descriptive title + the preamble metadata map. */
  parsePreamble(raw: string): { title: string; preamble: Preamble }

  /** The spec body to render — the source with its leading preamble/title block removed. */
  extractBody(raw: string): string

  /** Raw (non-canonical) numbers of same-project specs this one cites. De-duplicated. */
  extractReferences(raw: string): string[]

  /** Rewrite in-place the links to same-project spec files onto on-site URLs (`/<number>`). */
  rewriteInternalLinks($: CheerioAPI, numberBase: 10 | 16): void

  // ── Display ───────────────────────────────────────────────────────────────────────────────

  /** Build the spec-reading page view-model from a document and its related specs (both directions). */
  buildDocumentView(
    document: Document,
    project: ProjectConfig,
    relatedOut: Document[],
    relatedIn: Document[]
  ): DocumentView

  /** Build the index/catalog view-model from the project's documents. */
  buildCatalogView(project: ProjectConfig, documents: Document[]): CatalogView

  /** Project a document into the Meilisearch index record. */
  buildSearchRecord(project: ProjectConfig, document: Document): SearchRecord

  /** Map a stored search record (+ its `<mark>` highlighted fields) to the results view-model. */
  buildSearchHit(
    project: ProjectConfig,
    record: SearchRecord,
    formatted: Partial<SearchRecord> | undefined
  ): SearchHitView
}
