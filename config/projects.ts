import env from '#start/env'
import type { ProjectConfig } from '#types/project'

/** The mirrored specs projects. Adding a project = one entry here. Validated at boot. */
export const projects: ProjectConfig[] = [
  {
    key: 'bips',
    name: 'BIPs',
    tagline: 'bitcoin improvement proposals',
    domain: env.get('BIPS_DOMAIN') ?? 'bips.xyz',
    enabled: true,
    color: '#FF9500',
    logo: '/logos/bitcoin-coin.svg',
    specLabel: 'BIP',
    repo: { owner: 'bitcoin', repo: 'bips' },
    numberBase: 10,
    display: [
      { key: 'Status', label: 'Status', placement: 'header', kind: 'status' },
      { key: 'Type', label: 'Type', placement: 'header' },
      { key: 'Layer', label: 'Layer', placement: 'header' },
      { key: 'Author', label: 'Authors', placement: 'about', kind: 'authors' },
      { key: 'Created', label: 'Created', placement: 'about' },
    ],
  },
  {
    key: 'nips',
    name: 'NIPs',
    tagline: 'nostr implementation possibilities',
    domain: env.get('NIPS_DOMAIN') ?? 'nips.nostr.com',
    enabled: true,
    color: '#8E44AD',
    logo: '/logos/nostr.svg',
    specLabel: 'NIP',
    repo: { owner: 'nostr-protocol', repo: 'nips' },
    numberBase: 16,
    display: [],
  },
]

/** The enabled project served on a hostname, or undefined (→ 404 via require_project). */
export function findProjectByDomain(hostname: string): ProjectConfig | undefined {
  return projects.find((project) => project.enabled && project.domain === hostname)
}
