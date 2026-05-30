import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.string('project').notNullable()
      table.string('number').notNullable()
      table.integer('sort_order').notNullable()
      table.string('title').notNullable()
      table.text('preamble').notNullable()
      table.string('source_format').notNullable()
      table.string('source_url').notNullable()
      table.text('content_html').notNullable()
      table.text('content_text').notNullable()
      table.text('toc').nullable()
      table.string('hash').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.unique(['project', 'number'], { indexName: 'documents_project_number_unique' })
      table.index(['project', 'sort_order'], 'documents_project_sort_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
