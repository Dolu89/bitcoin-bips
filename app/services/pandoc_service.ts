/**
 * Thin boundary over the system `pandoc` binary (not an npm package — no harness cookbook).
 * Converts a spec's raw source to HTML at sync time. Highlighting is delegated to Shiki
 * downstream, so `--syntax-highlighting=none` is passed here — that flag needs pandoc ≥3.1.8
 * (the Docker image pins a 3.x build). Isolated as its own class so tests swap a fake (same
 * pattern as SpecSourceService) and never shell out.
 */
import { spawn } from 'node:child_process'
import { normalizeForPandoc, shieldRawImages } from '#values/mediawiki'

const TIMEOUT_MS = 15_000

export default class PandocService {
  async toHtml(raw: string, format: 'mediawiki' | 'markdown'): Promise<string> {
    const reader = format === 'mediawiki' ? 'mediawiki' : 'gfm'
    const args = ['-f', reader, '-t', 'html5', '--syntax-highlighting=none', '--wrap=none']
    // gfm passes raw <img> through; the mediawiki reader escapes it to text, so shield each tag
    // across the conversion and restore it afterward (preserving src/alt). See shieldRawImages.
    if (format !== 'mediawiki') {
      return this.run(args, raw)
    }
    const { source, restore } = shieldRawImages(normalizeForPandoc(raw))
    return restore(await this.run(args, source))
  }

  async toMarkdown(raw: string, format: 'mediawiki' | 'markdown'): Promise<string> {
    // Markdown sources are already GFM — pass them through untouched; only mediawiki needs Pandoc.
    if (format === 'markdown') {
      return raw
    }
    // Shield raw <img> as in toHtml — the mediawiki reader would otherwise emit it as escaped
    // `\<img …\>` text; restored, it stays a valid inline-HTML image tag in the GFM projection.
    const { source, restore } = shieldRawImages(normalizeForPandoc(raw))
    return restore(await this.run(['-f', 'mediawiki', '-t', 'gfm', '--wrap=none'], source))
  }

  private run(args: string[], input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('pandoc', args, { timeout: TIMEOUT_MS })
      let out = ''
      let err = ''
      child.stdout.on('data', (chunk) => {
        out += chunk
      })
      child.stderr.on('data', (chunk) => {
        err += chunk
      })
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) {
          resolve(out)
        } else {
          reject(new Error(`pandoc exited with ${code}: ${err.trim()}`))
        }
      })
      child.stdin.write(input)
      child.stdin.end()
    })
  }
}
