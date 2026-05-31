import type { ProjectConfig } from '#types/project'

/** The attributes of an active Umami `<script>` tag. */
export type UmamiTag = { src: string; websiteId: string }

/**
 * The Umami tag params when analytics is active for this project, else `null`.
 * Pure: `enabled` (production flag) and `scriptUrl` (shared instance URL) are
 * injected by the caller — see the `analyticsTag` Edge global in `start/view.ts`.
 */
export function umamiTag(
  project: ProjectConfig | undefined,
  opts: { enabled: boolean; scriptUrl: string | null }
): UmamiTag | null {
  if (!opts.enabled) return null
  if (!opts.scriptUrl) return null
  if (!project?.analyticsId) return null
  return { src: opts.scriptUrl, websiteId: project.analyticsId }
}
