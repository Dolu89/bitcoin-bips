import type { ApplicationService } from '@adonisjs/core/types'
import { projects } from '#config/projects'

/** Validates `config/projects.ts` at boot: unique keys/domains, required fields, at least one enabled. */
export default class ProjectsProvider {
  constructor(protected app: ApplicationService) {}

  async boot() {
    if (!projects.some((project) => project.enabled)) {
      throw new Error('config/projects: at least one project must be enabled')
    }

    const keys = new Set<string>()
    const domains = new Set<string>()

    for (const project of projects) {
      for (const field of ['key', 'name', 'domain', 'color', 'logo'] as const) {
        if (!project[field]) {
          throw new Error(`config/projects: project "${project.key || '?'}" is missing "${field}"`)
        }
      }
      if (keys.has(project.key)) {
        throw new Error(`config/projects: duplicate key "${project.key}"`)
      }
      if (domains.has(project.domain)) {
        throw new Error(`config/projects: duplicate domain "${project.domain}"`)
      }
      keys.add(project.key)
      domains.add(project.domain)
    }
  }
}
