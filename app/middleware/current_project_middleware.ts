import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import type { ProjectConfig } from '#types/project'
import { findProjectByDomain } from '#config/projects'
import ProjectMeta from '#models/project_meta'

declare module '@adonisjs/core/http' {
  interface HttpContext {
    project?: ProjectConfig
  }
}

/**
 * Resolves the project from the request host on every request (server stack, so
 * 404s still get a themed page) and shares it + its last-update with all views.
 * Unknown or disabled hosts leave `ctx.project` undefined.
 */
export default class CurrentProjectMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    // Path (no query) for the canonical/og:url — shared on every request, project or not.
    ctx.view.share({ currentPath: ctx.request.url() })

    const project = findProjectByDomain(ctx.request.hostname() ?? '')

    if (project) {
      ctx.project = project
      const meta = await ProjectMeta.find(project.key)
      ctx.view.share({ project, lastUpdate: meta?.lastUpdate ?? null })
    }

    return next()
  }
}
