import { z } from 'zod'

export const JitsiConferenceConfigSchema = z.object({
  url: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  priority: z.number().optional()
})
