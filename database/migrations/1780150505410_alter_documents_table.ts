import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Raw ingested source — the ingestion source of truth. Rendering (content_html /
      // content_text / toc) is a downstream capability, so those become nullable here.
      table.text('raw_content').nullable()
      table.setNullable('content_html')
      table.setNullable('content_text')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('raw_content')
      table.dropNullable('content_html')
      table.dropNullable('content_text')
    })
  }
}
