import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'document_commits'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table
        .integer('document_id')
        .unsigned()
        .notNullable()
        .references('documents.id')
        .onDelete('CASCADE')
      table.string('hash').notNullable()
      table.text('message').notNullable()
      table.string('author').notNullable()
      table.timestamp('committed_at').notNullable()
      table.integer('additions').notNullable().defaultTo(0)
      table.integer('deletions').notNullable().defaultTo(0)
      table.timestamp('created_at').notNullable().defaultTo(this.now())

      table.index(['document_id', 'committed_at'], 'document_commits_doc_date_idx')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
