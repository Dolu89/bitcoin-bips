import type { ApplicationService } from '@adonisjs/core/types'
import { projects } from '#config/projects'
import { registeredAdapters } from '#values/adapters'

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
      // Ingestion source: owner/repo/filePattern required, and the pattern must compile.
      for (const field of ['owner', 'repo', 'filePattern'] as const) {
        if (!project.repo?.[field]) {
          throw new Error(`config/projects: project "${project.key}" is missing "repo.${field}"`)
        }
      }
      try {
        new RegExp(project.repo.filePattern)
      } catch {
        throw new Error(
          `config/projects: project "${project.key}" has an invalid "repo.filePattern"`
        )
      }

      // The adapter id must resolve to a registered adapter (app/values/adapters/index.ts).
      if (!registeredAdapters.includes(project.adapter)) {
        throw new Error(
          `config/projects: project "${project.key}" has an unknown adapter "${project.adapter}" ` +
            `(registered: ${registeredAdapters.join(', ')})`
        )
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
