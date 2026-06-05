/**
 * In-memory test double for SearchService (the Meilisearch boundary). A real in-memory search:
 * `search` filters seeded records by project + naive substring match (so per-project scoping and
 * author re-search are exercised, not faked green). `reindexProject` records its calls and folds
 * the project's DB rows into the store; `throwOnReindex` simulates an unreachable index.
 *
 * Lives in app/services (not tests/) so it shares the #services alias and the container swap
 * resolves a real subclass — mirrors FakeSpecSourceService.
 */
import SearchService from '#services/search_service'
import Document from '#models/document'
import { adapterFor } from '#values/adapters'
import type { ProjectConfig } from '#types/project'
import type { SearchHitView } from '#types/view_models'

/** A searchable record held in the fake's store. `excerpt` stands in for content_text. */
export type FakeSearchRecord = {
  project: string
  number: string
  title: string
  authors: string[]
  excerpt?: string
  status?: string
  type?: string
  layer?: string
}

export type FakeSearchOptions = {
  /** Pre-seeded records, queried by `search`. */
  records?: FakeSearchRecord[]
  /** When true, `reindexProject` throws (search-index-unreachable simulation). */
  throwOnReindex?: boolean
}

export default class FakeSearchService extends SearchService {
  #store: FakeSearchRecord[]
  #throwOnReindex: boolean
  reindexCalls: { project: string; count: number; catalogTotal: number }[] = []

  constructor(options: FakeSearchOptions = {}) {
    super()
    this.#store = [...(options.records ?? [])]
    this.#throwOnReindex = options.throwOnReindex ?? false
  }

  async configureIndex(): Promise<void> {
    // no-op — the fake holds records in memory
  }

  async reindexProject(project: ProjectConfig): Promise<number> {
    const adapter = adapterFor(project.adapter)
    // Snapshot the whole catalog size at call time so callers can prove the reindex ran after
    // every project's ingest completed (cross-project ordering), not just this project's.
    const counted = await Document.query().count('* as total')
    const catalogTotal = Number(counted[0].$extras.total)
    if (this.#throwOnReindex) {
      // Record the attempt before failing so callers can prove the hook invoked reindex.
      this.reindexCalls.push({ project: project.key, count: 0, catalogTotal })
      throw new Error('search index unreachable (fake)')
    }
    const documents = await Document.query().where('project', project.key)
    for (const doc of documents) {
      const record = adapter.buildSearchRecord(project, doc)
      this.#store.push({
        project: record.project,
        number: record.number,
        title: record.title,
        authors: record.authors,
        excerpt: record.content_text,
        status: record.status,
        type: record.type,
        layer: record.layer,
      })
    }
    this.reindexCalls.push({ project: project.key, count: documents.length, catalogTotal })
    return documents.length
  }

  async search(project: ProjectConfig, query: string): Promise<SearchHitView[]> {
    const needle = query.trim().toLowerCase()
    return this.#store
      .filter((record) => record.project === project.key)
      .filter((record) => {
        const haystack = [record.title, record.authors.join(' '), record.excerpt ?? '']
          .join(' ')
          .toLowerCase()
        return haystack.includes(needle)
      })
      .map((record) => ({
        number: record.number,
        eyebrow: `${project.specLabel} ${record.number}`,
        titleHtml: record.title,
        excerptHtml: record.excerpt ?? '',
        badges: record.status ? [{ label: record.status }] : [],
        meta: [record.type, record.layer].filter(Boolean).join(' · ') || undefined,
        authors: record.authors.map((name) => ({ name, html: name })),
      }))
  }
}
