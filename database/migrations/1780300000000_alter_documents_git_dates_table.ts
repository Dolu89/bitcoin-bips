import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'documents'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // Spec dates derived from git history (nullable until a sync captures them):
      // first_commit_at = oldest commit on the file; last_commit_at = newest commit.
      table.dateTime('first_commit_at').nullable()
      table.dateTime('last_commit_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('first_commit_at')
      table.dropColumn('last_commit_at')
    })
  }
}
