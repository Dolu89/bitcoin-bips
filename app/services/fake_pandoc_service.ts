/**
 * In-memory test double for PandocService (the system-binary boundary). Returns deterministic
 * HTML without shelling out, records calls, and can be told to throw for a given input to
 * exercise the per-spec render-failure path. Lives in app/services (not tests/) so the
 * `#services` alias + container swap resolve a real subclass of PandocService.
 */
import PandocService from '#services/pandoc_service'

export type FakePandocOptions = {
  /** HTML to return for a given raw input; defaults to a one-section body so output is non-empty. */
  render?: (raw: string, format: 'mediawiki' | 'markdown') => string
  /** Throw (simulated conversion failure) when this predicate matches the raw input. */
  shouldThrow?: (raw: string) => boolean
}

export default class FakePandocService extends PandocService {
  calls: Array<{ raw: string; format: 'mediawiki' | 'markdown' }> = []

  constructor(private options: FakePandocOptions = {}) {
    super()
  }

  async toHtml(raw: string, format: 'mediawiki' | 'markdown'): Promise<string> {
    this.calls.push({ raw, format })
    if (this.options.shouldThrow?.(raw)) {
      throw new Error('fake pandoc conversion failure')
    }
    if (this.options.render) {
      return this.options.render(raw, format)
    }
    return `<h2>Section</h2>\n<p>${raw}</p>`
  }

  async toMarkdown(raw: string, format: 'mediawiki' | 'markdown'): Promise<string> {
    this.calls.push({ raw, format })
    return format === 'markdown' ? raw : `# Converted\n\n${raw}`
  }
}
