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
