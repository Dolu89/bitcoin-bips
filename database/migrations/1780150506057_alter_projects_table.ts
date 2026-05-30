import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'project_metas'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Raw per-project home content (e.g. NIP README), captured during sync. Rendering is
      // downstream; home_hash is the blob sha for incremental skip.
      table.text('home_content').nullable()
      table.string('home_format').nullable()
      table.string('home_source_url').nullable()
      table.string('home_hash').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('home_content')
      table.dropColumn('home_format')
      table.dropColumn('home_source_url')
      table.dropColumn('home_hash')
    })
  }
}
