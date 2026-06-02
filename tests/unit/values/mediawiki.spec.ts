import { test } from '@japa/runner'
import { normalizeForPandoc, linkifyRootRelativeLinks } from '#values/mediawiki'

const BLOB = 'https://github.com/bitcoin/bips/blob/master/'
const TREE = 'https://github.com/bitcoin/bips/tree/master/'

test.group('values/mediawiki normalizeForPandoc', () => {
  test('repairs a cite attribute missing its "="', ({ assert }) => {
    const out = normalizeForPandoc('a<ref name"smaller">note</ref>')
    assert.include(out, '<ref name="smaller">')
    assert.notInclude(out, 'name"smaller"')
  })

  test('flattens a multi-line ref body to a single line', ({ assert }) => {
    const out = normalizeForPandoc('A.<ref>\n  line one\n  line two\n</ref> B.')
    assert.notMatch(out, /<ref>[\s\S]*\n[\s\S]*<\/ref>/)
    assert.include(out, 'line one line two')
  })

  test('drops the references placeholder', ({ assert }) => {
    assert.equal(normalizeForPandoc('x<references/>y'), 'xy')
    assert.equal(normalizeForPandoc('x<references group="n">stuff</references>y'), 'xy')
  })

  test('leaves a well-formed single-line ref untouched', ({ assert }) => {
    const input = 'a<ref>See [https://x y].</ref>b'
    assert.equal(normalizeForPandoc(input), input)
  })
})

test.group('values/mediawiki linkifyRootRelativeLinks', () => {
  test('rewrites a root-relative file link to a /blob URL', ({ assert }) => {
    const out = linkifyRootRelativeLinks(
      'Updated [/bip-0075/paymentrequest.proto paymentrequest.proto] contains…',
      BLOB
    )
    assert.include(out, `[${BLOB}bip-0075/paymentrequest.proto paymentrequest.proto]`)
  })

  test('rewrites a root-relative directory link (no extension) to a /tree URL', ({ assert }) => {
    const out = linkifyRootRelativeLinks('in [/bip-0119/vectors the vectors directory] for…', BLOB)
    assert.include(out, `[${TREE}bip-0119/vectors the vectors directory]`)
  })

  test('flattens link text that spans multiple lines', ({ assert }) => {
    const out = linkifyRootRelativeLinks(
      '[/bip-0119/vectors the bip-0119/vectors\ndirectory]',
      BLOB
    )
    assert.include(out, `[${TREE}bip-0119/vectors the bip-0119/vectors directory]`)
  })

  test('leaves a proper external link untouched', ({ assert }) => {
    const input = 'see [https://utxos.org utxos.org informational site]'
    assert.equal(linkifyRootRelativeLinks(input, BLOB), input)
  })
})
