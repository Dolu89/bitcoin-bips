/**
 * Gateway to the search index (Meilisearch). Encapsulates the official client so the rest of the
 * app depends on a small typed surface (search / reindex), not on the SDK — the same seam pattern
 * as SpecSourceService over Octokit. Single index `documents`; per-project scope is a filter.
 */
import { Meilisearch } from 'meilisearch'
import type { Hit } from 'meilisearch'
import env from '#start/env'
import Document from '#models/document'
import { searchRecord } from '#values/search_record'
import type { ProjectConfig } from '#types/project'
import type { SearchHit, SearchRecord } from '#types/search'

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
    const documents = await Document.query().where('project', project.key)
    const records = documents.map((doc) => searchRecord(project, doc))
    if (records.length) {
      await this.client.index(INDEX).addDocuments(records, { primaryKey: 'id' })
    }
    return records.length
  }

  /** Full-text search scoped to one project. Returns [] when the index is missing/unreachable. */
  async search(projectKey: string, query: string): Promise<SearchHit[]> {
    let hits: Hit<SearchRecord>[]
    try {
      const response = await this.client.index(INDEX).search<SearchRecord>(query, {
        filter: `project = "${projectKey}"`,
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
    return hits.map((hit) => this.toHit(hit))
  }

  /**
   * Map a raw hit to the view model. `_formatted` carries `<mark>` highlight markup; the source
   * fields (title/content_text/authors) are plain text from ingestion, so the markup is safe to
   * render trusted.
   */
  private toHit(hit: Hit<SearchRecord>): SearchHit {
    const formatted = hit._formatted
    const authors = hit.authors ?? []
    const authorsHtml = (formatted?.authors as string[] | undefined) ?? authors
    return {
      number: hit.number,
      titleHtml: formatted?.title ?? hit.title,
      excerptHtml: (formatted?.content_text as string | undefined) ?? '',
      status: hit.status,
      type: hit.type,
      layer: hit.layer,
      authors: authors.map((name, index) => ({ name, html: authorsHtml[index] ?? name })),
    }
  }
}
