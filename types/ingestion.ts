/** A spec file located in a project's repo tree, before its content is fetched. */
export type SpecFileRef = {
  /** Path within the repo, e.g. `bip-0032.mediawiki`. */
  path: string
  /** Canonical spec number (leading zeros stripped, hex lowercased). */
  number: string
  /** Numeric sort key, `parseInt(number, numberBase)`. */
  sortOrder: number
  /** Git blob sha — the incremental-diff key, stored as `documents.hash`. */
  sha: string
  /** `mediawiki` | `markdown`, derived from the file extension. */
  sourceFormat: string
  /** Link to the source file on the project's repo. */
  sourceUrl: string
}

/** A located home file (e.g. NIP README) in a project's repo tree, before content fetch. */
export type HomeFileRef = {
  sha: string
  format: string
  url: string
}

/** A commit that touched a spec's source file, captured during sync and ready to persist. */
export type CommitRef = {
  /** Short commit identifier (first 7 chars). */
  hash: string
  /** First line of the commit message. */
  message: string
  /** Commit author display name (falls back to login, then 'unknown'). */
  author: string
  /** ISO-8601 author date; the caller stores it as `committed_at`. */
  committedAt: string
  /** Lines added to the spec's file in this commit. */
  additions: number
  /** Lines removed from the spec's file in this commit. */
  deletions: number
}

/** Per-spec failure collected during a sync, so one bad file does not fail the run. */
export type SyncError = {
  number: string
  message: string
}

/** Outcome of syncing one project. */
export type SyncSummary = {
  project: string
  added: number
  updated: number
  unchanged: number
  links: number
  errors: SyncError[]
}

/** Outcome of rebuilding the search index for one project during a full sync. */
export type ReindexOutcome = {
  project: string
  count: number
  /** Set when the reindex failed; captured (not thrown) so the run continues. */
  error?: string
}

/** Aggregate report of a full ordered sync: every project ingest, then every reindex. */
export type FullSyncReport = {
  ingest: SyncSummary[]
  reindex: ReindexOutcome[]
}
