import { test } from '@japa/runner'
import { githubCommitLinks } from '#values/github_links'

test.group('values/github_links githubCommitLinks', () => {
  test('derives history url, commit base, and the file diff anchor', ({ assert }) => {
    const links = githubCommitLinks(
      'https://github.com/bitcoin/bips/blob/master/bip-0001.mediawiki'
    )
    assert.equal(
      links.historyUrl,
      'https://github.com/bitcoin/bips/commits/master/bip-0001.mediawiki'
    )
    assert.equal(links.commitBaseUrl, 'https://github.com/bitcoin/bips/commit/')
    // GitHub anchors a file's diff with diff-<sha256(path)>; pinned against a real commit URL.
    assert.equal(
      links.diffAnchor,
      '#diff-d119d47e4db65fdc12330fe860690ab3c370b8ea587802242d0deb077fd73996'
    )
  })

  test('works for a hex-numbered NIP path', ({ assert }) => {
    const links = githubCommitLinks('https://github.com/nostr-protocol/nips/blob/master/01.md')
    assert.equal(links.historyUrl, 'https://github.com/nostr-protocol/nips/commits/master/01.md')
    assert.equal(links.commitBaseUrl, 'https://github.com/nostr-protocol/nips/commit/')
    assert.match(links.diffAnchor, /^#diff-[0-9a-f]{64}$/)
  })
})
