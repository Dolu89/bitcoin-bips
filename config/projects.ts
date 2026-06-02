import env from '#start/env'
import type { ProjectConfig } from '#types/project'

/** The mirrored specs projects. Adding a project = one entry here. Validated at boot. */
export const projects: ProjectConfig[] = [
  {
    key: 'bips',
    name: 'BIPs',
    tagline: 'bitcoin improvement proposals',
    domain: env.get('BIPS_DOMAIN') ?? 'bips.xyz',
    analyticsId: env.get('BIPS_ANALYTICS_ID'),
    enabled: true,
    color: '#FF9500',
    logo: '/logos/bitcoin-coin.svg',
    specLabel: 'BIP',
    repo: {
      owner: 'bitcoin',
      repo: 'bips',
      branch: 'master',
      filePattern: '^bip-(\\d+)\\.(mediawiki|md)$',
    },
    numberBase: 10,
    adapter: 'bip',
  },
  {
    key: 'nips',
    name: 'NIPs',
    tagline: 'nostr implementation possibilities',
    domain: env.get('NIPS_DOMAIN') ?? 'nips.nostr.com',
    analyticsId: env.get('NIPS_ANALYTICS_ID'),
    enabled: true,
    color: '#8E44AD',
    logo: '/logos/nostr.svg',
    specLabel: 'NIP',
    repo: {
      owner: 'nostr-protocol',
      repo: 'nips',
      branch: 'master',
      filePattern: '^([0-9a-fA-F]+)\\.md$',
      homeFile: 'README.md',
    },
    numberBase: 16,
    adapter: 'nip',
  },
]

/** The enabled project served on a hostname, or undefined (→ 404 via require_project). */
export function findProjectByDomain(hostname: string): ProjectConfig | undefined {
  return projects.find((project) => project.enabled && project.domain === hostname)
}
