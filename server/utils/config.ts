import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { AppConfig } from '../../types/config';

const patreonCollectionSchema = z.object({
  id: z.string(),
  tag: z.string().optional(),
  name: z.string(),
  campaignId: z.string(),
  complete: z.boolean().optional(),
});

const patreonConfigSchema = z.object({
  sessionCookie: z.string(),
  collections: z.array(patreonCollectionSchema),
});

const wattpadCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  complete: z.boolean().optional(),
});

const wattpadConfigSchema = z.object({
  sessionCookie: z.string().optional(),
  collections: z.array(wattpadCollectionSchema),
});

const appConfigSchema = z
  .object({
    password: z.string(),
    patreon: patreonConfigSchema.optional(),
    wattpad: wattpadConfigSchema.optional(),
    discord: z
      .object({
        webhookUrl: z.string(),
      })
      .optional(),
  })
  .superRefine((cfg, ctx) => {
    if (!cfg.patreon && !cfg.wattpad) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one of `patreon` or `wattpad` config blocks must be present',
      });
    }
  });

/**
 * Load and validate configuration from config.json.
 * This is the only place config.json should be read from disk.
 */
export async function loadConfig(rootDir: string): Promise<AppConfig> {
  const configPath = join(rootDir, 'config.json');
  const configData = await fs.readFile(configPath, 'utf-8');
  const raw = JSON.parse(configData);

  const result = appConfigSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid config.json: ${issues}`);
  }

  return result.data;
}
