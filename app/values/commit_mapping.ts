import type { CommitRef } from '#types/ingestion'

/**
 * Minimal shape of a GitHub `getCommit` response that {@link toCommitRef} reads. Declared here,
 * decoupled from octokit's types, so the mapping stays a pure function testable with hand-built
 * fixtures.
 */
export type CommitDetail = {
  sha: string
  commit: { message: string; author: { name?: string | null; date?: string | null } | null }
  author: { login?: string | null } | null
  files?: { filename: string; additions: number; deletions: number }[]
}

/**
 * Transform a commit detail into a CommitRef, reading the additions/deletions of the spec's own
 * `path` only (a commit may touch several files). Falls back to 0/0 when the file is absent from
 * the commit (e.g. a rename), and to the login then 'unknown' when no author name is present.
 */
export function toCommitRef(detail: CommitDetail, path: string): CommitRef {
  const file = detail.files?.find((entry) => entry.filename === path)
  return {
    hash: detail.sha.slice(0, 7),
    message: detail.commit.message.split('\n')[0],
    author: detail.commit.author?.name ?? detail.author?.login ?? 'unknown',
    committedAt: detail.commit.author?.date ?? '',
    additions: file?.additions ?? 0,
    deletions: file?.deletions ?? 0,
  }
}
