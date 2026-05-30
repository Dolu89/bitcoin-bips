import { test } from '@japa/runner'
import { parsePreamble, extractReferences } from '#values/spec_parsing'

const BIP_HEADER = `<pre>
  BIP: 32
  Title: Hierarchical Deterministic Wallets
  Author: Pieter Wuille <pieter@example.com>
  Status: Final
  Type: Informational
  Layer: Applications
  Created: 2012-02-11
</pre>
== Abstract ==
Body text here.`

const BIP_MULTI_AUTHOR = `<pre>
  BIP: 2
  Title: BIP process
  Author: Luke Dashjr <luke@example.com>
          Amir Taaki <amir@example.com>, Jane Roe (jane)
  Status: Active
  Created: 2016-02-03
</pre>`

test.group('values/spec_parsing parsePreamble (bip)', () => {
  test('extracts the title and preamble fields from the <pre> block', ({ assert }) => {
    const { title, preamble } = parsePreamble('bip', BIP_HEADER)

    assert.equal(title, 'Hierarchical Deterministic Wallets')
    assert.equal(preamble.Status, 'Final')
    assert.equal(preamble.Type, 'Informational')
    assert.equal(preamble.Layer, 'Applications')
    assert.equal(preamble.Created, '2012-02-11')
  })

  test('normalizes the author line into a clean list — {label}')
    .with([
      {
        label: 'single author',
        raw: BIP_HEADER,
        expected: ['Pieter Wuille'],
      },
      {
        label: 'multi-author + folded continuation line',
        raw: BIP_MULTI_AUTHOR,
        expected: ['Luke Dashjr', 'Amir Taaki', 'Jane Roe'],
      },
    ])
    .run(({ assert }, { raw, expected }) => {
      const { preamble } = parsePreamble('bip', raw)
      assert.deepEqual(preamble.Author, expected)
    })
})

test.group('values/spec_parsing parsePreamble (nip)', () => {
  test('takes the title from the first H1 with the NIP-<n>: prefix removed', ({ assert }) => {
    const raw = `# NIP-12: Generic Tag Queries\n\nDescription of the NIP.`
    const { title } = parsePreamble('nip', raw)
    assert.equal(title, 'Generic Tag Queries')
  })
})

test.group('values/spec_parsing extractReferences', () => {
  test('returns raw numbers of cited specs — {label}')
    .with([
      {
        label: 'BIP-0032',
        parser: 'bip' as const,
        body: 'See BIP-0032 for details.',
        expected: ['0032'],
      },
      { label: 'BIP 141', parser: 'bip' as const, body: 'Defined in BIP 141.', expected: ['141'] },
      { label: 'wiki [[32]]', parser: 'bip' as const, body: 'Refer to [[32]].', expected: ['32'] },
      { label: 'no citation', parser: 'bip' as const, body: 'No references at all.', expected: [] },
    ])
    .run(({ assert }, { parser, body, expected }) => {
      assert.deepEqual(extractReferences(parser, body), expected)
    })
})
