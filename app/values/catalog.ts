import type Document from '#models/document'
import type { ProjectConfig } from '#types/project'

/**
 * Build the home catalog view-model from a project's documents: one row per spec (number, title,
 * status, per-column cells), the header-placement display columns, and the de-duplicated set of
 * present statuses for the filter chips. Pure — callers own the DB query. Shared by the index and
 * search controllers so both render the same catalog from one source.
 */
export function catalogView(project: ProjectConfig, documents: Document[]) {
  const tableColumns = project.display.filter((entry) => entry.placement === 'header')
  const statusKey = project.display.find((entry) => entry.kind === 'status')?.key

  const rows = documents.map((doc) => {
    const preamble = doc.preambleData
    const statusRaw = statusKey ? preamble[statusKey] : undefined
    const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw
    const cells = tableColumns.map((col) => {
      const value = preamble[col.key]
      return { label: col.label, value, kind: col.kind }
    })
    return { number: doc.number, title: doc.title, status, cells }
  })

  const statuses = statusKey
    ? [
        ...new Set(
          documents
            .map((d) => d.preambleData[statusKey])
            .filter(Boolean)
            .map((v) => (Array.isArray(v) ? v[0] : v))
        ),
      ]
    : []

  return { rows, tableColumns, statuses, total: documents.length }
}
