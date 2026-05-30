import type { HttpContext } from '@adonisjs/core/http'
import Document from '#models/document'
import { canonicalize } from '#values/document_number'
import type { Field, RelatedItem } from '#types/document_display'

export default class DocumentsController {
  async show({ params, view, response, request, project }: HttpContext) {
    if (!project) {
      return response.notFound()
    }

    const number = canonicalize(params.number, project.numberBase)
    if (number === null) {
      return response.notFound()
    }

    // Canonical URL: redirect non-canonical forms (hex casing / leading zeros).
    if (params.number !== number) {
      return response.redirect().status(301).toRoute('documents.show', { number })
    }

    const document = await Document.query()
      .where('project', project.key)
      .where('number', number)
      .withCount('commits')
      .preload('relatedOut', (q) =>
        q.select('id', 'number', 'title', 'preamble').orderBy('sort_order', 'asc')
      )
      .firstOrFail()

    // Conditional GET — content changes only on sync (hash = source blob sha).
    response.header('Cache-Control', 'public, no-cache')
    response.header('ETag', document.hash)
    if (request.header('if-none-match') === document.hash) {
      response.status(304)
      return
    }

    // Derive display props by walking the project's preamble display config.
    const preamble = document.preambleData
    const headerFields: Field[] = []
    const aboutFields: Field[] = []
    let authors: string[] = []
    let status: string | undefined
    let tags: string[] = []

    for (const entry of project.display) {
      const value = preamble[entry.key]
      if (value === undefined) {
        continue
      }
      if (entry.kind === 'authors') {
        authors = (Array.isArray(value) ? value : [value])
          .flatMap((v) => v.split(','))
          .map((author) => author.replace(/<[^>]*>/g, '').trim())
          .filter(Boolean)
        continue
      }
      if (entry.kind === 'status') {
        status = Array.isArray(value) ? value[0] : value
        continue
      }
      if (entry.kind === 'tags') {
        tags = Array.isArray(value) ? value : [value]
        continue
      }
      const bucket = entry.placement === 'header' ? headerFields : aboutFields
      bucket.push({ label: entry.label, value })
    }

    const statusKey = project.display.find((entry) => entry.kind === 'status')?.key
    const related: RelatedItem[] = document.relatedOut.map((spec) => {
      const raw = statusKey ? spec.preambleData[statusKey] : undefined
      return {
        number: spec.number,
        title: spec.title,
        status: Array.isArray(raw) ? raw[0] : raw,
      }
    })

    return view.render('pages/documents/show', {
      document,
      status,
      authors,
      tags,
      headerFields,
      aboutFields,
      related,
      historyCount: Number(document.$extras.commits_count ?? 0),
    })
  }

  async history({ params, response, view, project }: HttpContext) {
    if (!project) {
      return response.notFound()
    }

    const number = canonicalize(params.number, project.numberBase)
    if (number === null) {
      return response.notFound()
    }

    const document = await Document.query()
      .where('project', project.key)
      .where('number', number)
      .preload('commits')
      .firstOrFail()

    // Bare drawer body — injected client-side into the history drawer.
    return view.render('partials/documents/history', {
      document,
      commits: document.commits,
    })
  }
}
