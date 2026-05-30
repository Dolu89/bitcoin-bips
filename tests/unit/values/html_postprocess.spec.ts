import { test } from '@japa/runner'
import * as cheerio from 'cheerio'
import {
  slugify,
  assignAnchorsAndBuildToc,
  rewriteInternalLinks,
  rewriteImages,
  extractText,
} from '#values/html_postprocess'

test.group('values/html_postprocess slugify', () => {
  test('slugify normalizes "{input}" to "{expected}"')
    .with([
      { input: 'Motivation', expected: 'motivation' },
      { input: 'Backwards Compatibility', expected: 'backwards-compatibility' },
      { input: 'Tx_Format (v2)', expected: 'tx-format-v2' },
      { input: '  Spaces  ', expected: 'spaces' },
    ])
    .run(({ assert }, { input, expected }) => {
      assert.equal(slugify(input), expected)
      assert.equal(slugify(input), slugify(input))
    })
})

test.group('values/html_postprocess assignAnchorsAndBuildToc', () => {
  test('anchors and TOC share identical ids', ({ assert }) => {
    const $ = cheerio.load('<h2>Motivation</h2><h3>Goals</h3><h2>Rationale</h2>', null, false)

    const toc = assignAnchorsAndBuildToc($)

    assert.equal($('h2').eq(0).attr('id'), 'motivation')
    assert.equal($('h3').eq(0).attr('id'), 'goals')
    assert.equal($('h2').eq(1).attr('id'), 'rationale')

    const $toc = cheerio.load(toc, null, false)
    const hrefs = $toc('a')
      .map((_, a) => $toc(a).attr('href'))
      .get()
    assert.sameMembers(hrefs, ['#motivation', '#goals', '#rationale'])
    // h3 nests under the preceding h2.
    assert.equal($toc('li ul a[href="#goals"]').length, 1)
  })

  test('duplicate headings get unique, matching ids', ({ assert }) => {
    const $ = cheerio.load('<h2>Notes</h2><h2>Notes</h2>', null, false)

    const toc = assignAnchorsAndBuildToc($)

    assert.equal($('h2').eq(0).attr('id'), 'notes')
    assert.equal($('h2').eq(1).attr('id'), 'notes-2')

    const $toc = cheerio.load(toc, null, false)
    const hrefs = $toc('a')
      .map((_, a) => $toc(a).attr('href'))
      .get()
    assert.sameMembers(hrefs, ['#notes', '#notes-2'])
  })

  test('no headings yields an empty TOC', ({ assert }) => {
    const $ = cheerio.load('<p>Body only.</p>', null, false)
    assert.equal(assignAnchorsAndBuildToc($), '')
  })
})

test.group('values/html_postprocess rewriteInternalLinks', () => {
  test('internal BIP link "{href}" → "{expected}"')
    .with([
      { href: 'bip-0001.mediawiki', expected: '/1' },
      { href: 'bip-0032.mediawiki#abstract', expected: '/32#abstract' },
      { href: 'bip-141.md', expected: '/141' },
      { href: 'https://example.com', expected: 'https://example.com' },
      { href: '#section', expected: '#section' },
      { href: 'mailto:a@b.c', expected: 'mailto:a@b.c' },
    ])
    .run(({ assert }, { href, expected }) => {
      const $ = cheerio.load(`<a href="${href}">x</a>`, null, false)
      rewriteInternalLinks($, 'bip', 10)
      assert.equal($('a').attr('href'), expected)
    })

  test('internal NIP links rewritten in hex', ({ assert }) => {
    const $ = cheerio.load('<a href="01.md">x</a><a href="0a.md">y</a>', null, false)
    rewriteInternalLinks($, 'nip', 16)
    assert.equal($('a').eq(0).attr('href'), '/1')
    assert.equal($('a').eq(1).attr('href'), '/a')
  })
})

test.group('values/html_postprocess rewriteImages', () => {
  test('relative images rewritten to the raw repo base, absolutes untouched', ({ assert }) => {
    const base = 'https://raw.githubusercontent.com/bitcoin/bips/master/'
    const $ = cheerio.load(
      '<img src="bip-0174/coinjoin.png"><img src="https://x/y.png"><img src="data:image/png;base64,AA">',
      null,
      false
    )

    rewriteImages($, base)

    assert.equal($('img').eq(0).attr('src'), `${base}bip-0174/coinjoin.png`)
    assert.equal($('img').eq(1).attr('src'), 'https://x/y.png')
    assert.equal($('img').eq(2).attr('src'), 'data:image/png;base64,AA')
  })
})

test.group('values/html_postprocess extractText', () => {
  test('strips markup and normalizes whitespace', ({ assert }) => {
    const $ = cheerio.load('<h2>Title</h2>\n<p>Hello   <b>world</b>.</p>', null, false)
    const text = extractText($)
    assert.include(text, 'Title')
    assert.include(text, 'Hello world.')
    assert.notInclude(text, '<')
    assert.notInclude(text, '>')
  })
})
