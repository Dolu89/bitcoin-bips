import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import Document from '#models/document'
import { DateTime } from 'luxon'

/**
 * Dev sample data so the reading page is viewable before ingestion exists.
 * Ingestion (a separate change) replaces this with real mirrored specs.
 */
export default class extends BaseSeeder {
  async run() {
    await db.from('document_links').delete()
    await db.from('document_commits').delete()
    await Document.query().where('project', 'bips').delete()

    const bip1 = await Document.create({
      project: 'bips',
      number: '1',
      sortOrder: 1,
      title: 'BIP Purpose and Guidelines',
      preamble: JSON.stringify({
        Author: ['Amir Taaki <amir@example.com>', 'Luke Dashjr <luke@example.com>'],
        Status: 'Active',
        Type: 'Process',
        Layer: 'Consensus (soft fork)',
        Created: '2011-08-19',
      }),
      sourceFormat: 'mediawiki',
      sourceUrl: 'https://github.com/bitcoin/bips/blob/master/bip-0001.mediawiki',
      contentHtml:
        '<section id="abstract" class="bip-section"><h2 class="bip-section__h"><a class="bip-section__anchor" href="#abstract">#</a>Abstract</h2><p>A BIP is a design document providing information to the Bitcoin community, or describing a new feature for Bitcoin or its processes or environment.</p></section>' +
        '<section id="copyright" class="bip-section"><h2 class="bip-section__h"><a class="bip-section__anchor" href="#copyright">#</a>Copyright</h2><p>This BIP is in the public domain.</p></section>',
      contentText:
        'A BIP is a design document providing information to the Bitcoin community. This BIP is in the public domain.',
      toc: '<ul><li><a href="#abstract">Abstract</a></li><li><a href="#copyright">Copyright</a></li></ul>',
      hash: 'devseedhash0001',
    })

    const bip2 = await Document.create({
      project: 'bips',
      number: '2',
      sortOrder: 2,
      title: 'BIP process, revised',
      preamble: JSON.stringify({
        Author: ['Luke Dashjr <luke@example.com>'],
        Status: 'Final',
        Type: 'Process',
        Created: '2016-02-03',
      }),
      sourceFormat: 'mediawiki',
      sourceUrl: 'https://github.com/bitcoin/bips/blob/master/bip-0002.mediawiki',
      contentHtml:
        '<section id="intro" class="bip-section"><h2 class="bip-section__h">Introduction</h2><p>This document replaces BIP 1 with a more thorough process.</p></section>',
      contentText: 'This document replaces BIP 1 with a more thorough process.',
      toc: null,
      hash: 'devseedhash0002',
    })

    await bip1.related('relatedOut').attach([bip2.id])

    await bip1.related('commits').createMany([
      {
        hash: 'a1b2c3d',
        message: 'Clarify the BIP status workflow',
        author: 'Luke Dashjr',
        committedAt: DateTime.fromISO('2023-06-12'),
        additions: 42,
        deletions: 8,
      },
      {
        hash: '9f8e7d6',
        message: 'Fix typos in the abstract',
        author: 'Amir Taaki',
        committedAt: DateTime.fromISO('2019-03-04'),
        additions: 5,
        deletions: 5,
      },
      {
        hash: '0011223',
        message: 'Initial BIP 1 draft',
        author: 'Amir Taaki',
        committedAt: DateTime.fromISO('2011-08-19'),
        additions: 120,
        deletions: 0,
      },
    ])
  }
}
