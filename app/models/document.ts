import { hasMany, manyToMany } from '@adonisjs/lucid/orm'
import type { HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'
import { DocumentSchema } from '#database/schema'
import DocumentCommit from '#models/document_commit'
import type { Preamble } from '#types/preamble'

export default class Document extends DocumentSchema {
  /** Parsed view of the `preamble` JSON column. */
  get preambleData(): Preamble {
    try {
      return JSON.parse(this.preamble || '{}') as Preamble
    } catch {
      return {}
    }
  }

  /** Specs this one references (outgoing edges). */
  @manyToMany(() => Document, {
    pivotTable: 'document_links',
    pivotForeignKey: 'from_document_id',
    pivotRelatedForeignKey: 'to_document_id',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare relatedOut: ManyToMany<typeof Document>

  /** Specs that reference this one (incoming edges). */
  @manyToMany(() => Document, {
    pivotTable: 'document_links',
    pivotForeignKey: 'to_document_id',
    pivotRelatedForeignKey: 'from_document_id',
    pivotTimestamps: { createdAt: 'created_at', updatedAt: false },
  })
  declare relatedIn: ManyToMany<typeof Document>

  /** Commits that touched this spec, newest first. */
  @hasMany(() => DocumentCommit, { onQuery: (query) => query.orderBy('committed_at', 'desc') })
  declare commits: HasMany<typeof DocumentCommit>
}
