import factory from '@adonisjs/lucid/factories'
import Document from '#models/document'

/**
 * Builds `documents` rows for tests. Covers every non-null column; rendered columns
 * (contentHtml / contentText / toc) and rawContent default to null and are merged per test.
 */
export const DocumentFactory = factory
  .define(Document, async ({ faker }) => {
    const number = String(faker.number.int({ min: 1, max: 9999 }))
    return {
      project: 'bips',
      number,
      sortOrder: Number.parseInt(number, 10),
      title: faker.lorem.sentence(),
      preamble: JSON.stringify({ Status: 'Draft' }),
      sourceFormat: 'mediawiki',
      sourceUrl: `https://github.com/bitcoin/bips/blob/master/bip-${number}.mediawiki`,
      hash: faker.git.commitSha(),
    }
  })
  .build()
