// Test fixtures are raw Graph drives; buildSpace is the same conversion web-client applies in
// graph.drives.listAllDrives, so the rows under test come from real SpaceResources.
import { buildSpace, SpaceResource } from '@ownclouders/web-client'
import type { Drive } from '@ownclouders/web-client/graph/generated'

/** Loose subset of a libregraph Drive, as oCIS returns it from /graph/v1beta1/drives */
export interface DriveFixture {
  id?: string
  name?: string
  driveType?: string
  driveAlias?: string
  lastModifiedDateTime?: string
  owner?: { user?: { id?: string; displayName?: string } }
  quota?: { total?: number; used?: number; state?: string }
  root?: { deleted?: { state?: string }; permissions?: unknown[] }
}

export const spaces = (drives: DriveFixture[]): SpaceResource[] =>
  drives.map((d) =>
    buildSpace({ ...(d as unknown as Drive), serverUrl: 'https://cloud.example.org' }, {})
  )
