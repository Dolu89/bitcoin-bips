/**
 * In-memory test double for SpecSourceService (the GitHub boundary). Serves a configurable
 * spec-file set + blob contents + home ref, with no network. Counts content fetches split by
 * spec vs home so tests can prove the sha-skip branches; can throw on a designated sha to
 * exercise per-spec error handling.
 *
 * Lives in app/services (not tests/) so it shares the #services alias and the container swap
 * resolves a real subclass of SpecSourceService.
 */
import SpecSourceService from '#services/spec_source_service'
import type { ProjectConfig } from '#types/project'
import type { SpecFileRef, HomeFileRef, CommitRef } from '#types/ingestion'

/** A canned commit served per project + file path; same shape as a persisted CommitRef. */
export type FakeCommit = CommitRef

export type FakeSpec = {
  /** Pre-canonicalized spec number. */
  number: string
  sortOrder?: number
  sha: string
  content: string
  sourceFormat?: string
  sourceUrl?: string
}

export type FakeHome = {
  sha: string
  content: string
  format?: string
  url?: string
}

export type FakeSource = {
  /** Spec files served per project key. */
  specs?: Record<string, FakeSpec[]>
  /** Home file served per project key. */
  home?: Record<string, FakeHome>
  /** Blob shas whose fetchContent should throw (per-spec error path). */
  failingShas?: string[]
  /** Commits served per project key, then per file path (the spec's `path`). */
  commits?: Record<string, Record<string, FakeCommit[]>>
  /** Total commit count per project key, then per file path; defaults to the served commits' length. */
  commitTotals?: Record<string, Record<string, number>>
  /**
   * First (oldest) commit ISO date per project key, then per file path. Absent → null (no API call,
   * unlike the real service which would hit GitHub). Lets tests assert the captured `firstCommitAt`.
   */
  firstCommitDates?: Record<string, Record<string, string>>
  /** File paths whose listSpecCommits should throw (commit-capture error path). */
  failingCommitPaths?: string[]
  /** Project keys whose listSpecFiles should throw (whole-project upstream failure). */
  failingListProjects?: string[]
}

export default class FakeSpecSourceService extends SpecSourceService {
  specFetchCount = 0
  homeFetchCount = 0
  commitFetchCount = 0

  constructor(private fixture: FakeSource = {}) {
    super()
  }

  async listSpecCommits(project: ProjectConfig, path: string, limit: number): Promise<CommitRef[]> {
    if (this.fixture.failingCommitPaths?.includes(path)) {
      throw new Error(`Simulated commit failure for path ${path}`)
    }
    this.commitFetchCount += 1
    const commits = this.fixture.commits?.[project.key]?.[path] ?? []
    return commits.slice(0, limit)
  }

  async countSpecCommits(project: ProjectConfig, path: string): Promise<number> {
    const explicit = this.fixture.commitTotals?.[project.key]?.[path]
    if (explicit !== undefined) {
      return explicit
    }
    return this.fixture.commits?.[project.key]?.[path]?.length ?? 0
  }

  async firstCommitDate(project: ProjectConfig, path: string): Promise<string | null> {
    return this.fixture.firstCommitDates?.[project.key]?.[path] ?? null
  }

  async listSpecFiles(project: ProjectConfig): Promise<SpecFileRef[]> {
    if (this.fixture.failingListProjects?.includes(project.key)) {
      throw new Error(`Simulated listing failure for project ${project.key}`)
    }
    const specs = this.fixture.specs?.[project.key] ?? []
    return specs.map((spec) => ({
      path: `${spec.number}`,
      number: spec.number,
      sortOrder: spec.sortOrder ?? Number.parseInt(spec.number, project.numberBase),
      sha: spec.sha,
      sourceFormat: spec.sourceFormat ?? 'mediawiki',
      sourceUrl: spec.sourceUrl ?? `https://example.test/${project.key}/${spec.number}`,
    }))
  }

  async fetchContent(project: ProjectConfig, fileSha: string): Promise<string> {
    if (this.fixture.failingShas?.includes(fileSha)) {
      throw new Error(`Simulated fetch failure for sha ${fileSha}`)
    }

    const home = this.fixture.home?.[project.key]
    if (home && home.sha === fileSha) {
      this.homeFetchCount += 1
      return home.content
    }

    const spec = this.fixture.specs?.[project.key]?.find((s) => s.sha === fileSha)
    if (!spec) {
      throw new Error(`No fake content for sha ${fileSha}`)
    }
    this.specFetchCount += 1
    return spec.content
  }

  async findHome(project: ProjectConfig): Promise<HomeFileRef | null> {
    const home = this.fixture.home?.[project.key]
    if (!home) {
      return null
    }
    return {
      sha: home.sha,
      format: home.format ?? 'markdown',
      url: home.url ?? `https://example.test/${project.key}/home`,
    }
  }
}
