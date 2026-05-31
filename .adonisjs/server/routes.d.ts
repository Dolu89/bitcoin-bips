import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'robots.show': { paramsTuple?: []; params?: {} }
    'search.show': { paramsTuple?: []; params?: {} }
    'documents.history': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'robots.show': { paramsTuple?: []; params?: {} }
    'search.show': { paramsTuple?: []; params?: {} }
    'documents.history': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'robots.show': { paramsTuple?: []; params?: {} }
    'search.show': { paramsTuple?: []; params?: {} }
    'documents.history': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
    'documents.show': { paramsTuple: [ParamValue]; params: {'number': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}