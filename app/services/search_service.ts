/**
 * Gateway to the search index (Meilisearch). Encapsulates the official client so the rest of the
 * app depends on a small typed surface (search / reindex), not on the SDK — the same seam pattern
 * as SpecSourceService over Octokit. Single index `documents`; per-project scope is a filter.
 */
import { Meilisearch } from 'meilisearch'
import type { Hit } from 'meilisearch'
import env from '#start/env'
import Document from '#models/document'
import { adapterFor } from '#values/adapters'
import type { ProjectConfig } from '#types/project'
import type { SearchRecord } from '#types/search'
import type { SearchHitView } from '#types/view_models'

const INDEX = 'documents'

export default class SearchService {
  #client: Meilisearch | null = null

  /** Lazily build the client so a missing host errors at call time, never at boot. */
  private get client(): Meilisearch {
    if (!this.#client) {
      const host = env.get('MEILISEARCH_HOST')
      if (!host) {
        throw new Error('MEILISEARCH_HOST is not set — required for the search index')
      }
      this.#client = new Meilisearch({ host, apiKey: env.get('MEILISEARCH_API_KEY') })
    }
    return this.#client
  }

  /** Idempotently apply index settings: title-first searchable ranking + filterable facets. */
  async configureIndex(): Promise<void> {
    await this.client.index(INDEX).updateSettings({
      searchableAttributes: ['title', 'authors', 'content_text'],
      filterableAttributes: ['project', 'status', 'type', 'layer'],
    })
  }

  /** Project every spec of `project` into the index. Returns the number of records pushed. */
  async reindexProject(project: ProjectConfig): Promise<number> {
    await this.configureIndex()
    const adapter = adapterFor(project.adapter)
    const documents = await Document.query().where('project', project.key)
    const records = documents.map((doc) => adapter.buildSearchRecord(project, doc))
    if (records.length) {
      await this.client.index(INDEX).addDocuments(records, { primaryKey: 'id' })
    }
    return records.length
  }

  /** Full-text search scoped to one project. Returns [] when the index is missing/unreachable. */
  async search(project: ProjectConfig, query: string): Promise<SearchHitView[]> {
    const adapter = adapterFor(project.adapter)
    let hits: Hit<SearchRecord>[]
    try {
      const response = await this.client.index(INDEX).search<SearchRecord>(query, {
        filter: `project = "${project.key}"`,
        attributesToHighlight: ['title', 'authors', 'content_text'],
        attributesToCrop: ['content_text'],
        cropLength: 40,
        highlightPreTag: '<mark class="hl">',
        highlightPostTag: '</mark>',
      })
      hits = response.hits
    } catch {
      return []
    }
    return hits.map((hit) => adapter.buildSearchHit(project, hit, hit._formatted))
  }
}
