import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DocumentCommitSchema } from '#database/schema'
import Document from '#models/document'

export default class DocumentCommit extends DocumentCommitSchema {
  @belongsTo(() => Document)
  declare document: BelongsTo<typeof Document>
}
