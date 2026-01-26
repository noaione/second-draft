import { defineContentConfig, defineCollection } from '@nuxt/content'
import { z } from 'zod'

export default defineContentConfig({
  collections: {
    content: defineCollection({
      type: 'page',
      source: '**/*.md',
      schema: z.object({
        title: z.string().min(1),
        postId: z.string(),
        author: z.string(),
        collectionName: z.string(),
        collectionId: z.string(),
        publishedAt: z.string().refine((date) => !isNaN(Date.parse(date)), {
          message: 'publishedAt must be a valid ISO 8601 date string',
        }),
      }),
    }),
  },
})
