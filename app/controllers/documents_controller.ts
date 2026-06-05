import type { HttpContext } from '@adonisjs/core/http'
import Document from '#models/document'
import { canonicalize } from '#values/document_number'
import { githubCommitLinks } from '#values/github_links'
import { adapterFor } from '#values/adapters'

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
      .preload('relatedOut', (q) =>
        q.select('id', 'number', 'title', 'preamble').orderBy('sort_order', 'asc')
      )
      .preload('relatedIn', (q) =>
        q.select('id', 'number', 'title', 'preamble').orderBy('sort_order', 'asc')
      )
      .firstOrFail()

    // Conditional GET — content changes only on sync (hash = source blob sha). The git-sourced
    // dates are backfilled without touching the hash, so fold them into the ETag too.
    const etag = `${document.hash}-${document.firstCommitAt?.toMillis() ?? 0}-${document.lastCommitAt?.toMillis() ?? 0}`
    response.header('Cache-Control', 'public, no-cache')
    response.header('ETag', etag)
    if (request.header('if-none-match') === etag) {
      response.status(304)
      return
    }

    // The project's adapter owns the whole view-model; the controller stays project-agnostic.
    const documentView = adapterFor(project.adapter).buildDocumentView(
      document,
      project,
      document.relatedOut,
      document.relatedIn
    )

    return view.render('pages/documents/show', {
      document,
      view: documentView,
      historyCount: Number(document.commitCount ?? 0),
    })
  }

  async raw({ params, response, request, project }: HttpContext) {
    if (!project) {
      return response.notFound()
    }

    const number = canonicalize(params.number, project.numberBase)
    if (number === null) {
      return response.notFound()
    }

    // Canonical URL: redirect non-canonical forms (leading zeros / hex casing) to the .md route.
    if (params.number !== number) {
      return response.redirect().status(301).toRoute('documents.raw', { number })
    }

    const document = await Document.query()
      .where('project', project.key)
      .where('number', number)
      .firstOrFail()

    // The Markdown is pre-rendered at sync (content_markdown); Markdown-native specs keep it null
    // and fall back to their already-Markdown source. No Pandoc on the request path.
    const body = document.contentMarkdown ?? document.rawContent
    if (body === null) {
      return response.notFound()
    }

    // Content changes only on sync (hash = source blob sha) — same conditional-GET shape as `show`.
    const etag = document.hash
    response.header('Cache-Control', 'public, no-cache')
    response.header('ETag', etag)
    if (request.header('if-none-match') === etag) {
      response.status(304)
      return
    }

    response.header('Content-Type', 'text/plain; charset=utf-8')
    return body
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
      // Show at most the 5 most recent (newest-first via the relation's onQuery), regardless of
      // how many rows are stored — `total` still reflects the real count.
      .preload('commits', (q) => q.limit(5))
      .firstOrFail()

    // Bare drawer body — injected client-side into the history drawer.
    return view.render('partials/documents/history', {
      document,
      commits: document.commits,
      total: document.commitCount,
      links: githubCommitLinks(document.sourceUrl),
    })
  }
}
