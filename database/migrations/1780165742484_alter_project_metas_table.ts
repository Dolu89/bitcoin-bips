import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'project_metas'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Rendered curated home (e.g. NIP README) — produced from home_content at sync by the
      // rendering capability. Null when the home is derived from the catalog (BIP).
      table.text('home_html').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('home_html')
    })
  }
}
