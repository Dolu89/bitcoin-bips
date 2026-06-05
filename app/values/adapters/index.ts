/**
 * The project-adapter registry — the ONLY place that maps an adapter id to its implementation.
 *
 * To add a project:
 *   1. Create `app/values/adapters/<id>.ts` exporting a `ProjectAdapter` (all the project's
 *      custom data + display code lives there — see `#types/project_adapter`).
 *   2. Register it in `REGISTRY` below.
 *   3. Add a `config/projects.ts` entry with `adapter: '<id>'`.
 * No shared controller or template changes.
 */
import type { ProjectAdapter } from '#types/project_adapter'
import { bipAdapter } from '#values/adapters/bip'
import { nipAdapter } from '#values/adapters/nip'

const REGISTRY: Record<string, ProjectAdapter> = {
  bip: bipAdapter,
  nip: nipAdapter,
}

/** Resolve the adapter for an id (a project's `adapter` field). Throws on an unknown id. */
export function adapterFor(id: string): ProjectAdapter {
  const adapter = REGISTRY[id]
  if (!adapter) {
    throw new Error(`project adapter "${id}" is not registered (config/projects.ts → adapter)`)
  }
  return adapter
}

/** The registered adapter ids — used by the boot-time config validation. */
export const registeredAdapters = Object.keys(REGISTRY)
