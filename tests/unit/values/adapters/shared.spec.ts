import { test } from '@japa/runner'
import { metaExcerpt, documentDescription } from '#values/adapters/shared'
import { DocumentFactory } from '#database/factories/document_factory'
import { projects } from '#config/projects'

const bips = projects.find((p) => p.key === 'bips')!
const nips = projects.find((p) => p.key === 'nips')!

test.group('values/adapters/shared metaExcerpt', () => {
  test('empty/blank input yields an empty excerpt')
    .with([null, undefined, '', '   \n\t '])
    .run(({ assert }, input) => {
      assert.equal(metaExcerpt(input as string | null | undefined), '')
    })

  test('short text passes through with whitespace collapsed, no ellipsis', ({ assert }) => {
    assert.equal(metaExcerpt('  Hello   world\n\tagain  '), 'Hello world again')
  })

  test('long text is cut to <= max at a word boundary and ends with an ellipsis', ({ assert }) => {
    const source = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')
    const max = 100
    const excerpt = metaExcerpt(source, max)

    assert.isAtMost(excerpt.length, max + 1) // +1 for the ellipsis char
    assert.isTrue(excerpt.endsWith('…'))

    const body = excerpt.slice(0, -1)
    assert.isTrue(source.startsWith(body)) // a real prefix — nothing mangled
    assert.isFalse(body.endsWith(' ')) // trailing space trimmed before the ellipsis
    assert.equal(source[body.length], ' ') // the cut fell on a word boundary
  })
})

test.group('values/adapters/shared documentDescription', () => {
  test('uses the body text (abstract/first paragraph) when present')
    .with([bips, nips])
    .run(async ({ assert }, project) => {
      const body =
        'This document defines a mechanism for deriving a tree of keypairs from a single seed, ' +
        'so a wallet can be backed up once and still produce unlimited addresses across accounts.'
      const doc = await DocumentFactory.merge({ number: '32', contentText: body }).makeStubbed()

      const description = documentDescription(project, doc)

      assert.isTrue(body.startsWith(description.replace(/…$/, '')))
      assert.isAtMost(description.length, 156)
    })

  test('falls back to a self-describing sentence when the body text is empty')
    .with([bips, nips])
    .run(async ({ assert }, project) => {
      const doc = await DocumentFactory.merge({
        number: '7',
        title: 'Example Title',
        contentText: null,
      }).makeStubbed()

      const description = documentDescription(project, doc)

      // Names the spec + the site, derived from config — not a hardcoded string.
      assert.include(description, `${project.specLabel} 7`)
      assert.include(description, 'Example Title')
      assert.include(description, project.name)
      assert.isAtLeast(description.length, 80)
    })
})
