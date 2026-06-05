import { ProjectMetaSchema } from '#database/schema'

export default class ProjectMeta extends ProjectMetaSchema {
  static primaryKey = 'project'
  static selfAssignPrimaryKey = true
}
