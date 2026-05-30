import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'documents.history': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
  }
  GET: {
    'documents.history': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
  }
  HEAD: {
    'documents.history': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}