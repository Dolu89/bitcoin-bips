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
import type { SpecFileRef, HomeFileRef } from '#types/ingestion'

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
}

export default class FakeSpecSourceService extends SpecSourceService {
  specFetchCount = 0
  homeFetchCount = 0

  constructor(private fixture: FakeSource = {}) {
    super()
  }

  async listSpecFiles(project: ProjectConfig): Promise<SpecFileRef[]> {
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
