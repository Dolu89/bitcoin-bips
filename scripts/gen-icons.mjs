// Generates the raster favicon set + social card PNGs from the committed source SVGs.
//
//   node scripts/gen-icons.mjs
//
// Requires `rsvg-convert` (librsvg) on PATH. Re-run after editing any source SVG:
//   public/icons/<key>/favicon.svg   →  icon-{32,180,192,512}.png + favicon.ico
//   public/og/<key>.svg              →  public/og/<key>.png (1200×630)
// Outputs are committed so production never needs the toolchain.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const KEYS = ['bips', 'nips']

/** Render an SVG to a PNG of the given pixel dimensions via librsvg. */
function renderPng(src, out, width, height) {
  execFileSync('rsvg-convert', ['-w', String(width), '-h', String(height), src, '-o', out])
}

/** Pack square PNG buffers into a single multi-resolution .ico (PNG-encoded entries). */
function buildIco(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(pngs.length, 4) // image count

  const entries = []
  let offset = 6 + pngs.length * 16
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0) // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // palette count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8) // image byte size
    entry.writeUInt32LE(offset, 12) // image byte offset
    offset += data.length
    entries.push(entry)
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
}

const tmp = mkdtempSync(join(tmpdir(), 'gen-icons-'))
try {
  for (const key of KEYS) {
    const iconDir = join(root, 'public', 'icons', key)
    const favicon = join(iconDir, 'favicon.svg')

    // Browser/manifest/apple PNGs.
    for (const size of [32, 180, 192, 512]) {
      renderPng(favicon, join(iconDir, `icon-${size}.png`), size, size)
    }

    // favicon.ico — multi-res (16/32/48) PNG-encoded.
    const icoSizes = [16, 32, 48]
    const pngs = icoSizes.map((size) => {
      const out = join(tmp, `${key}-${size}.png`)
      renderPng(favicon, out, size, size)
      return { size, data: readFileSync(out) }
    })
    writeFileSync(join(iconDir, 'favicon.ico'), buildIco(pngs))

    // Social card.
    renderPng(
      join(root, 'public', 'og', `${key}.svg`),
      join(root, 'public', 'og', `${key}.png`),
      1200,
      630
    )

    console.log(`✓ ${key}: icons + favicon.ico + og/${key}.png`)
  }
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
