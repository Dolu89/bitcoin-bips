/**
 * The shape of one spec as projected into the Meilisearch `documents` index. Derived from a
 * Document's `preamble` via the project's display config — see `app/values/search_record.ts`.
 */
export type SearchRecord = {
  /** Document primary key — the Meilisearch document id. */
  id: number
  project: string
  number: string
  title: string
  authors: string[]
  /** Plain-text body for full-text search + excerpts (empty string when unrendered). */
  content_text: string
  status?: string
  type?: string
  layer?: string
}

/** One author within a search hit: the plain name (for re-search) + its highlighted markup. */
export type SearchHitAuthor = {
  name: string
  html: string
}

/**
 * A search result shaped for the results view. `titleHtml` / `excerptHtml` carry Meilisearch
 * highlight `<mark>` markup over otherwise-escaped plain text.
 */
export type SearchHit = {
  number: string
  titleHtml: string
  excerptHtml: string
  status?: string
  type?: string
  layer?: string
  authors: SearchHitAuthor[]
}
