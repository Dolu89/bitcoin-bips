import { test } from '@japa/runner'
import { toCommitRef } from '#values/commit_mapping'
import type { CommitDetail } from '#values/commit_mapping'

function baseCommit(files?: CommitDetail['files']): CommitDetail {
  return {
    sha: '1234567abcdefabcdef',
    commit: { message: 'Subject line', author: { name: 'Alice', date: '2023-06-12T00:00:00Z' } },
    author: { login: 'alice' },
    files,
  }
}

test.group('values/commit_mapping toCommitRef file diff', () => {
  test('reads the spec file diff — {label}')
    .with([
      {
        label: 'file present among others',
        files: [
          { filename: 'other.md', additions: 99, deletions: 5 },
          { filename: 'bip-0001.mediawiki', additions: 12, deletions: 3 },
        ],
        path: 'bip-0001.mediawiki',
        additions: 12,
        deletions: 3,
      },
      {
        label: 'path absent from files',
        files: [{ filename: 'other.md', additions: 99, deletions: 5 }],
        path: 'bip-0001.mediawiki',
        additions: 0,
        deletions: 0,
      },
      {
        label: 'files undefined',
        files: undefined,
        path: 'bip-0001.mediawiki',
        additions: 0,
        deletions: 0,
      },
    ])
    .run(({ assert }, row) => {
      const ref = toCommitRef(baseCommit(row.files), row.path)
      assert.equal(ref.additions, row.additions)
      assert.equal(ref.deletions, row.deletions)
    })
})

test.group('values/commit_mapping toCommitRef fields', () => {
  test('shapes hash, message, author, date — {label}')
    .with([
      {
        label: 'author name present',
        detail: {
          sha: 'abcdef1234567890abcdef',
          commit: {
            message: 'First line\n\nbody',
            author: { name: 'Alice', date: '2023-06-12T10:00:00Z' },
          },
          author: { login: 'alice' },
        } as CommitDetail,
        hash: 'abcdef1',
        message: 'First line',
        author: 'Alice',
        committedAt: '2023-06-12T10:00:00Z',
      },
      {
        label: 'falls back to login',
        detail: {
          sha: '0011223344556677',
          commit: { message: 'Fix typo', author: { name: null, date: '2019-03-04T00:00:00Z' } },
          author: { login: 'bob' },
        } as CommitDetail,
        hash: '0011223',
        message: 'Fix typo',
        author: 'bob',
        committedAt: '2019-03-04T00:00:00Z',
      },
      {
        label: 'falls back to unknown',
        detail: {
          sha: 'deadbeefcafef00d',
          commit: { message: 'Initial', author: { name: null, date: '2011-08-19T00:00:00Z' } },
          author: null,
        } as CommitDetail,
        hash: 'deadbee',
        message: 'Initial',
        author: 'unknown',
        committedAt: '2011-08-19T00:00:00Z',
      },
    ])
    .run(({ assert }, row) => {
      const ref = toCommitRef(row.detail, 'irrelevant.md')
      assert.equal(ref.hash, row.hash)
      assert.equal(ref.message, row.message)
      assert.equal(ref.author, row.author)
      assert.equal(ref.committedAt, row.committedAt)
    })
})
