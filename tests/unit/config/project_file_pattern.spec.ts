import { test } from '@japa/runner'
import { projects } from '#config/projects'
import { canonicalize } from '#values/document_number'

const nips = projects.find((p) => p.key === 'nips')!

test.group('config/projects nips filePattern', () => {
  test('matches a real NIP filename "{file}" and canonicalizes to {expected}')
    .with([
      { file: '01.md', expected: '1' },
      { file: 'fe.md', expected: 'fe' },
      // Uppercase-hex NIPs that exist in the repo — must not be dropped.
      { file: '7D.md', expected: '7d' },
      { file: 'C7.md', expected: 'c7' },
    ])
    .run(({ assert }, { file, expected }) => {
      const match = file.match(new RegExp(nips.repo.filePattern))
      assert.isNotNull(match)
      assert.equal(canonicalize(match![1], nips.numberBase), expected)
    })

  test('does not match non-spec files')
    .with([{ file: 'README.md' }, { file: 'BREAKING.md' }])
    .run(({ assert }, { file }) => {
      assert.isNull(file.match(new RegExp(nips.repo.filePattern)))
    })
})
