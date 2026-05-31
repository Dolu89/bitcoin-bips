import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
    })
  }
}