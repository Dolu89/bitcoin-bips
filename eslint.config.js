import { configApp } from '@adonisjs/eslint-config'

export default [{ ignores: ['design-system/**', '.flow/**', '.claude/**'] }, ...configApp()]
