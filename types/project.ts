/** Typed contract for a mirrored specs project; one entry per project in `config/projects.ts`. */
export type ProjectConfig = {
  key: string
  /** Short brand / acronym, e.g. `BIPs`. Used in the header and as `og:site_name`. */
  name: string
  /** Expanded brand name, e.g. `Bitcoin Improvement Proposals`. Used as the page-title suffix. */
  fullName: string
  tagline: string
  domain: string
  enabled: boolean

  color: string
  logo: string
  specLabel: string

  /** One-sentence site description — meta description + Open Graph/Twitter default. */
  description: string
  /** Social card image, served from `public/` (1200×630). Path or absolute URL. */
  ogImage: string

  /** Umami `data-website-id` for this project. Absent = no analytics tag (see `app/values/analytics.ts`). */
  analyticsId?: string

  repo: {
    owner: string
    repo: string
    branch?: string
    /** Anchored regex source matching a spec file; capture group 1 = raw spec number. */
    filePattern: string
    /** Curated home file in the repo (e.g. 'README.md'). Absent = home derived from the catalog. */
    homeFile?: string
  }

  /** 10 = decimal spec numbers (BIPs), 16 = hex (NIPs). */
  numberBase: 10 | 16

  /**
   * Id of the project's adapter (`app/values/adapters/<id>.ts`), resolved via `adapterFor`. The
   * adapter owns ALL per-project data + display code. Two projects may share one adapter (a fork
   * reusing `'bip'`). Validated at boot against the registry. See `#types/project_adapter`.
   */
  adapter: string
}
