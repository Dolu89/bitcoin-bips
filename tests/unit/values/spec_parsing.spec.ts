import { test } from '@japa/runner'
import { parsePreamble, extractReferences, extractBody } from '#values/spec_parsing'

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

const BIP_MARKDOWN = `\`\`\`
  BIP: 3
  Title: Updated BIP Process
  Authors: Murch <murch@murch.one>
  Status: Deployed
  Type: Process
\`\`\`

## Abstract

Body of the markdown BIP.`

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

  test('parses a markdown BIP preamble from a leading ``` fence', ({ assert }) => {
    const { title, preamble } = parsePreamble('bip', BIP_MARKDOWN)
    assert.equal(title, 'Updated BIP Process')
    assert.equal(preamble.Status, 'Deployed')
    assert.equal(preamble.Type, 'Process')
    assert.deepEqual(preamble.Author, ['Murch'])
  })

  test('canonicalizes a plural "Authors:" key to Author', ({ assert }) => {
    const raw = `<pre>\n  Title: X\n  Authors: Jesse Posner <jesse@vora.io>\n           Jurvis Tan <jurvis@block.xyz>\n</pre>`
    const { preamble } = parsePreamble('bip', raw)
    assert.deepEqual(preamble.Author, ['Jesse Posner', 'Jurvis Tan'])
    assert.isUndefined(preamble.Authors)
  })
})

test.group('values/spec_parsing extractBody', () => {
  test('drops the leading BIP <pre> preamble block', ({ assert }) => {
    const body = extractBody('bip', BIP_HEADER)
    assert.notInclude(body, 'BIP: 32')
    assert.notInclude(body, '<pre>')
    assert.include(body, '== Abstract ==')
    assert.include(body, 'Body text here.')
  })

  test('drops the leading markdown ``` preamble fence for a BIP', ({ assert }) => {
    const body = extractBody('bip', BIP_MARKDOWN)
    assert.notInclude(body, 'BIP: 3')
    assert.notInclude(body, '```')
    assert.include(body, '## Abstract')
    assert.include(body, 'Body of the markdown BIP.')
  })

  test('drops the leading NIP H1 title', ({ assert }) => {
    const raw = `# NIP-12: Generic Tag Queries\n\n## Section\n\nBody.`
    const body = extractBody('nip', raw)
    assert.notInclude(body, '# NIP-12')
    assert.include(body, '## Section')
  })

  test('drops the setext label, title and tag line for a NIP', ({ assert }) => {
    const body = extractBody('nip', NIP_SETEXT)
    assert.notInclude(body, 'NIP-01')
    assert.notInclude(body, 'Basic protocol flow description')
    assert.notInclude(body, '`draft`')
    assert.include(body, 'This NIP defines the basic protocol.')
  })
})

const NIP_SETEXT = `NIP-01
======

Basic protocol flow description
-------------------------------

\`draft\` \`mandatory\` \`relay\`

This NIP defines the basic protocol.`

test.group('values/spec_parsing parsePreamble (nip)', () => {
  test('takes the title from the first H1 with the NIP-<n>: prefix removed', ({ assert }) => {
    const raw = `# NIP-12: Generic Tag Queries\n\nDescription of the NIP.`
    const { title } = parsePreamble('nip', raw)
    assert.equal(title, 'Generic Tag Queries')
  })

  test('parses a setext title (skipping the NIP-<n> label) and classification tags', ({
    assert,
  }) => {
    const { title, preamble } = parsePreamble('nip', NIP_SETEXT)
    assert.equal(title, 'Basic protocol flow description')
    assert.equal(preamble.Status, 'draft')
    assert.deepEqual(preamble.Tags, ['mandatory', 'relay'])
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
