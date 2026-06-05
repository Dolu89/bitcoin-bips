import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_links'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('from_document_id')
        .unsigned()
        .notNullable()
        .references('documents.id')
        .onDelete('CASCADE')
      table
        .integer('to_document_id')
        .unsigned()
        .notNullable()
        .references('documents.id')
        .onDelete('CASCADE')
      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.unique(['from_document_id', 'to_document_id'], {
        indexName: 'document_links_from_to_unique',
      })
      table.index(['to_document_id'], 'document_links_to_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
