/**
 * The display CONTRACT: the typed "slots" that the shared controllers + Edge templates render.
 *
 * The frontend renders these shapes and NEVER branches on project identity. It is each project
 * adapter's job (`app/values/adapters/<id>.ts`) to fill the slots it can from a stored Document.
 * Adding a project never touches a template; adding a new *slot kind* (rare) does — that is a
 * deliberate, shared frontend decision, not a per-project one.
 */

/**
 * A generic coloured label. `tone` is a FINITE palette owned by the design system (each tone has
 * light+dark CSS), so colours stay out of application code and contrast is guaranteed. The adapter
 * maps a project value (a status, a classification tag, …) to a tone. Absent tone → `neutral`.
 * There is intentionally no "status" concept here: not every project has a status; a status is just
 * one badge among others.
 */
export type BadgeTone = 'neutral' | 'accent' | 'positive' | 'caution' | 'danger' | 'info'
export type Badge = { label: string; tone?: BadgeTone }

/** A labelled key/value header chip (uncoloured), e.g. `Type — Standards Track`. */
export type HeaderChip = { label?: string; value: string }

/**
 * One row of the "About" rail — a discriminated union the template renders by switching on `type`.
 * The source link is itself a slot (`link`), so the rail is entirely adapter-driven.
 */
export type AboutSlot =
  | { type: 'authors'; label: string; authors: string[] }
  | { type: 'text'; label: string; value: string }
  | { type: 'badges'; label: string; badges: Badge[] }
  | { type: 'date'; label: string; display: string }
  | { type: 'link'; label: string; href: string; text: string; external?: boolean }

/** The collapsible raw-preamble panel; an adapter sets `show:false` to hide it (e.g. NIPs). */
export type PreamblePanel = { show: boolean; rows: { label: string; value: string }[] }

/**
 * A related spec. `direction` distinguishes outgoing (this spec cites it) from incoming (cited by),
 * so the view can group the two separately.
 */
export type RelatedSpec = {
  number: string
  eyebrow: string
  title: string
  badges: Badge[]
  direction: 'in' | 'out'
}

/** Everything the spec-reading page needs. The controller produces ONLY this (via the adapter). */
export type DocumentView = {
  eyebrow: string
  title: string
  /** Plain-text card/meta description (Open Graph + `<meta name="description">`). ~110-160 chars. */
  description: string
  badges: Badge[]
  headerChips: HeaderChip[]
  aboutSlots: AboutSlot[]
  preamble: PreamblePanel
  related: RelatedSpec[]
}

/** A catalog table column header. */
export type CatalogColumn = { label: string }

/**
 * A catalog table cell: coloured badges, clickable author chips (each links to a search for that
 * name — the catalog equivalent of the document page's author rail), or plain text.
 */
export type CatalogCell =
  | { type: 'badges'; badges: Badge[] }
  | { type: 'authors'; authors: string[] }
  | { type: 'text'; value?: string }

/** A catalog table row. `filterKey` is the value the status-filter chips match against. */
export type CatalogRow = {
  number: string
  title: string
  filterKey?: string
  cells: CatalogCell[]
}

/** A status-filter chip on the catalog. */
export type CatalogFilter = { key: string; label: string }

/** Everything the index (catalog) page needs. */
export type CatalogView = {
  introHtml: string
  columns: CatalogColumn[]
  rows: CatalogRow[]
  filters: CatalogFilter[]
  total: number
}

/** One author within a search hit: the plain name (for re-search) + its highlighted markup. */
export type SearchHitAuthor = { name: string; html: string }

/**
 * A search result shaped for the results view. `titleHtml`/`excerptHtml` carry Meilisearch `<mark>`
 * markup over otherwise-escaped plain text. `badges` is filled freely per project (BIP → status,
 * NIP → tags, …); `meta` is a free single-line string (e.g. BIP `Standards Track · Applications`).
 */
export type SearchHitView = {
  number: string
  eyebrow: string
  titleHtml: string
  excerptHtml: string
  badges: Badge[]
  meta?: string
  authors: SearchHitAuthor[]
}
