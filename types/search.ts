/**
 * The wire shape of one spec as stored in the Meilisearch `documents` index. Built per project by
 * each adapter's `buildSearchRecord` (see `app/values/adapters/<id>.ts`); the index settings in
 * `SearchService.configureIndex` make `project`/`status`/`type`/`layer` filterable. The view-facing
 * result shape is `SearchHitView` in `#types/view_models`, produced by `buildSearchHit`.
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
  /** Opaque facet columns an adapter may fill (kept for the fixed filterable index settings). */
  status?: string
  type?: string
  layer?: string
}
