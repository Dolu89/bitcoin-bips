import { test } from '@japa/runner'
import { canonicalize } from '#values/document_number'

test.group('values/document_number canonicalize', () => {
  test('canonicalize("{input}", {base}) → {expected}')
    .with([
      { input: '0032', base: 10 as const, expected: '32' },
      { input: '141', base: 10 as const, expected: '141' },
      { input: '7d', base: 10 as const, expected: null },
      { input: '007D', base: 16 as const, expected: '7d' },
      { input: '7d', base: 16 as const, expected: '7d' },
      { input: '0', base: 10 as const, expected: '0' },
      { input: '0000', base: 10 as const, expected: '0' },
      { input: '', base: 16 as const, expected: null },
      { input: 'xyz', base: 16 as const, expected: null },
    ])
    .run(({ assert }, { input, base, expected }) => {
      assert.equal(canonicalize(input, base), expected)
    })
})
