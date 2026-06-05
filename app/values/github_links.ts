import { createHash } from 'node:crypto'

export type GithubCommitLinks = {
  /** GitHub commit history for the file — the "view all" target. */
  historyUrl: string
  /** Prefix for a single commit page; append a commit sha (short or full). */
  commitBaseUrl: string
  /** Fragment that scrolls a commit page to this file's diff (`diff-` + sha256 of the path). */
  diffAnchor: string
}

/**
 * Derive a file's GitHub commit links from its blob source URL
 * (`https://github.com/<owner>/<repo>/blob/<branch>/<path>`). Pure — the diff anchor matches
 * GitHub's `diff-<sha256(path)>` scheme, so a commit link lands directly on this file's changes.
 */
export function githubCommitLinks(sourceUrl: string): GithubCommitLinks {
  const [prefix, rest] = sourceUrl.split('/blob/')
  const path = rest ? rest.split('/').slice(1).join('/') : ''
  return {
    historyUrl: sourceUrl.replace('/blob/', '/commits/'),
    commitBaseUrl: `${prefix}/commit/`,
    diffAnchor: `#diff-${createHash('sha256').update(path).digest('hex')}`,
  }
}
