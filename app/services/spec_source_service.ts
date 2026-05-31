/**
 * Gateway to the upstream spec source (GitHub). Encapsulates Octokit so the rest of the
 * app depends on a small typed surface (list / fetch / locate-home), not on the REST client
 * — a later switch to GraphQL stays behind this seam.
 */
import { Octokit } from 'octokit'
import env from '#start/env'
import { canonicalize } from '#values/document_number'
import { toCommitRef } from '#values/commit_mapping'
import type { CommitDetail } from '#values/commit_mapping'
import type { ProjectConfig } from '#types/project'
import type { SpecFileRef, HomeFileRef, CommitRef } from '#types/ingestion'

export default class SpecSourceService {
  #octokit: Octokit | null = null

  /** Lazily build the client so a missing token errors at call time, never at boot. */
  private get client(): Octokit {
    if (!this.#octokit) {
      const auth = env.get('GITHUB_API_KEY')
      if (!auth) {
        throw new Error('GITHUB_API_KEY is not set — required to read the upstream spec source')
      }
      this.#octokit = new Octokit({ auth, userAgent: 'bips-xyz-ingestion' })
    }
    return this.#octokit
  }

  private formatForPath(path: string): string {
    return path.endsWith('.mediawiki') ? 'mediawiki' : 'markdown'
  }

  /** List the project's spec files from its repo tree (recursive), one ref per match. */
  async listSpecFiles(project: ProjectConfig): Promise<SpecFileRef[]> {
    const { owner, repo, branch, filePattern } = project.repo
    const { data } = await this.client.rest.git.getTree({
      owner,
      repo,
      tree_sha: branch ?? 'HEAD',
      recursive: 'true',
    })

    if (data.truncated) {
      throw new Error(`Tree for ${owner}/${repo} is truncated — too many files to list in one call`)
    }

    const pattern = new RegExp(filePattern)
    const refs: SpecFileRef[] = []

    for (const entry of data.tree) {
      if (entry.type !== 'blob' || !entry.path || !entry.sha) {
        continue
      }
      const match = entry.path.match(pattern)
      if (!match) {
        continue
      }
      const number = canonicalize(match[1], project.numberBase)
      if (number === null) {
        continue
      }
      refs.push({
        path: entry.path,
        number,
        sortOrder: Number.parseInt(number, project.numberBase),
        sha: entry.sha,
        sourceFormat: this.formatForPath(entry.path),
        sourceUrl: `https://github.com/${owner}/${repo}/blob/${branch ?? 'HEAD'}/${entry.path}`,
      })
    }

    return refs
  }

  /**
   * List the recent commits that touched a spec's file, newest first, up to `limit`. The commit
   * list carries no per-file line stats, so each commit is fetched in detail to read the spec
   * file's additions/deletions; the pure `toCommitRef` does the mapping.
   */
  async listSpecCommits(project: ProjectConfig, path: string, limit: number): Promise<CommitRef[]> {
    const { owner, repo, branch } = project.repo
    const { data: list } = await this.client.rest.repos.listCommits({
      owner,
      repo,
      sha: branch ?? 'HEAD',
      path,
      per_page: limit,
    })

    const refs: CommitRef[] = []
    for (const item of list) {
      const { data: detail } = await this.client.rest.repos.getCommit({
        owner,
        repo,
        ref: item.sha,
      })
      refs.push(toCommitRef(detail as unknown as CommitDetail, path))
    }
    return refs
  }

  /**
   * Total number of commits that touched a spec's file — fetched cheaply (no diffs): request one
   * commit and read the `rel="last"` page of the Link header, which equals the commit count when
   * `per_page=1`. Falls back to the returned length when there is no pagination (0 or 1 commit).
   */
  async countSpecCommits(project: ProjectConfig, path: string): Promise<number> {
    const { owner, repo, branch } = project.repo
    const res = await this.client.rest.repos.listCommits({
      owner,
      repo,
      sha: branch ?? 'HEAD',
      path,
      per_page: 1,
    })
    const last = res.headers.link?.match(/[?&]page=(\d+)>;\s*rel="last"/)
    return last ? Number(last[1]) : res.data.length
  }

  /** Fetch a blob's UTF-8 content by its git sha (100 MB limit vs 1 MB for getContent). */
  async fetchContent(project: ProjectConfig, fileSha: string): Promise<string> {
    const { owner, repo } = project.repo
    const { data } = await this.client.rest.git.getBlob({ owner, repo, file_sha: fileSha })
    return Buffer.from(data.content, 'base64').toString('utf-8')
  }

  /**
   * Locate the project's curated home file in the repo tree (sha only, no content fetch),
   * so the caller can skip the download when the sha matches what is already stored.
   */
  async findHome(project: ProjectConfig): Promise<HomeFileRef | null> {
    const { owner, repo, branch, homeFile } = project.repo
    if (!homeFile) {
      return null
    }
    const { data } = await this.client.rest.git.getTree({
      owner,
      repo,
      tree_sha: branch ?? 'HEAD',
      recursive: 'true',
    })
    const entry = data.tree.find((node) => node.path === homeFile && node.type === 'blob')
    if (!entry || !entry.sha) {
      return null
    }
    return {
      sha: entry.sha,
      format: this.formatForPath(homeFile),
      url: `https://github.com/${owner}/${repo}/blob/${branch ?? 'HEAD'}/${homeFile}`,
    }
  }
}
