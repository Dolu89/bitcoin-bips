import type { CheerioAPI } from 'cheerio'
import type { Preamble } from '#types/preamble'

/**
 * A project adapter holds ALL the code specific to one kind of spec project (BIPs, NIPs, …).
 * The codebase is split into two layers:
 *
 *   1. DATA (this interface, the methods below) — parsing and transforming a project's raw source.
 *      Custom per project: each adapter does whatever its conventions require.
 *   2. DISPLAY (shared) — the controllers and Edge templates render a fixed, typed "slot contract"
 *      and NEVER branch on project identity. It is each adapter's job to fill the slots it can.
 *
 * Consequence: adding a project = write one `app/values/adapters/<id>.ts` implementing this
 * interface + register it in `app/values/adapters/index.ts` + add a `config/projects.ts` entry
 * with `adapter: '<id>'`. Zero edits to shared controllers/templates.
 *
 * An adapter is stateless: one instance serves every project that selects it, so per-project data
 * (label, numberBase, repo, …) is passed in as arguments rather than captured.
 *
 * The display-side methods (buildDocumentView, …) are added in a later phase; this file currently
 * declares the data-side contract only.
 */
export interface ProjectAdapter {
  /** Registry id, matched against `ProjectConfig.adapter`. */
  readonly id: string

  /** Parse the raw source into the descriptive title + the preamble metadata map. */
  parsePreamble(raw: string): { title: string; preamble: Preamble }

  /** The spec body to render — the source with its leading preamble/title block removed. */
  extractBody(raw: string): string

  /** Raw (non-canonical) numbers of same-project specs this one cites. De-duplicated. */
  extractReferences(raw: string): string[]

  /** Rewrite in-place the links to same-project spec files onto on-site URLs (`/<number>`). */
  rewriteInternalLinks($: CheerioAPI, numberBase: 10 | 16): void
}
