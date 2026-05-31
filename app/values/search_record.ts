import type Document from '#models/document'
import type { ProjectConfig } from '#types/project'
import type { SearchRecord } from '#types/search'

/** First scalar of a preamble value that may be a string or string[]. */
function scalar(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value[0] : value
}

/**
 * Project a Document into the Meilisearch index shape. Status and authors are derived from the
 * project's display config (by `kind`); type/layer read the canonical BIP preamble keys (absent
 * for projects that don't define them). Pure — no DB, no client.
 */
export function searchRecord(project: ProjectConfig, document: Document): SearchRecord {
  const preamble = document.preambleData

  const statusKey = project.display.find((entry) => entry.kind === 'status')?.key
  const status = statusKey ? scalar(preamble[statusKey]) : undefined

  const authorsKey = project.display.find((entry) => entry.kind === 'authors')?.key
  let authors: string[] = []
  if (authorsKey) {
    const raw = preamble[authorsKey]
    if (raw !== undefined) {
      authors = (Array.isArray(raw) ? raw : [raw])
        .flatMap((value) => value.split(','))
        .map((author) => author.replace(/<[^>]*>/g, '').trim())
        .filter(Boolean)
    }
  }

  return {
    id: document.id,
    project: document.project,
    number: document.number,
    title: document.title,
    authors,
    content_text: document.contentText ?? '',
    status,
    type: scalar(preamble['Type']),
    layer: scalar(preamble['Layer']),
  }
}
