import type { Ability } from '@ownclouders/web-client'

export const APP_ID = 'space-report'

/** Listing all spaces needs Drives.List.all (Admin and Space Admin roles). */
export const canView = (ability: Ability) => ability.can('read-all', 'Drive')
