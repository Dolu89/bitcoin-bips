import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'project_metas'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.string('project').primary()
      table.timestamp('last_update').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
