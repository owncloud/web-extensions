import { z } from 'zod'

export const ExternalSiteSchema = z.object({
  name: z.string(),
  target: z.enum(['embedded', 'external']),
  url: z.string(),
  color: z.string().optional(),
  icon: z.string().optional(),
  priority: z.number().optional()
})

export const ExternalSitesConfigSchema = z.object({
  sites: z.array(ExternalSiteSchema)
})
