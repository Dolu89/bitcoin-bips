import { test } from '@japa/runner'
import { normalizeForPandoc } from '#values/mediawiki'

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
