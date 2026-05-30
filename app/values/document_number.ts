/**
 * Canonical form of a spec number: strip leading zeros, and for hex (base 16)
 * lowercase it, so any casing or zero-padding in a URL resolves to the same row.
 * Returns `null` when invalid for the base (e.g. `7d` on a decimal project),
 * which the controller turns into a 404.
 */
export function canonicalize(raw: string, base: 10 | 16): string | null {
  const value = raw.trim().toLowerCase()
  const pattern = base === 16 ? /^[0-9a-f]+$/ : /^[0-9]+$/
  if (!pattern.test(value)) {
    return null
  }
  return value.replace(/^0+/, '') || '0'
}
