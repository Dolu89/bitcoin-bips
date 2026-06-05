import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // GFM rendered from the MediaWiki source at sync time; null for Markdown-native specs
      // (served verbatim from raw_content). Lets the `.md` view skip per-request Pandoc.
      table.text('content_markdown').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('content_markdown')
    })
  }
}
