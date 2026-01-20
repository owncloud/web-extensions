/**
 * Type shims for external modules
 * These modules are provided at runtime by the oCIS web framework
 */

declare module 'vue-router' {
  export interface RouteRecordRaw {
    path: string
    name?: string
    component?: any
    redirect?: any
    props?: boolean | Record<string, any>
    meta?: Record<string, any>
    children?: RouteRecordRaw[]
  }
}

declare module 'vue3-gettext' {
  export function useGettext(): {
    $gettext: (msg: string) => string
    $ngettext: (singular: string, plural: string, n: number) => string
    $pgettext: (context: string, msg: string) => string
  }
}
