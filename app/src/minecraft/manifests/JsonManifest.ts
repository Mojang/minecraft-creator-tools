import { z } from "zod";

//Zod schemas:
const VersionSchema = z.union([z.string(), z.array(z.number())]);

const HeaderSchema = z.object({
  name: z.string(),
  uuid: z.string(),
  version: VersionSchema,
  description: z.string().optional(),
  base_game_version: VersionSchema.optional(),
  lock_template_options: z.boolean().optional(),
  allow_random_seed: z.boolean().optional(),
  min_engine_version: VersionSchema.optional(),
  max_engine_version: VersionSchema.optional(),
  platform_locked: z.boolean().optional(),
  packScope: z.string().optional(),
});
const ModuleSchema = z.array(
  z.object({
    type: z.string(),
    uuid: z.string(),
    version: VersionSchema,
    description: z.string().optional(),
    language: z.string().optional(),
    entry: z.string().optional(),
  })
);

const SubpackSchema = z.array(
  z.object({
    folder_name: z.string(),
    name: z.string(),
    memory_tier: z.number().optional(),
    memory_performance_tier: z.number().optional(),
  })
);

const DependenciesSchema = z.array(
  z.object({
    uuid: z.string().optional(),
    module_name: z.string().optional(),
    version: VersionSchema,
  })
);

const MetadataSchema = z.object({
  authors: z.array(z.string()).optional(),
  product_type: z.string().optional(),
});

const SettingsSchema = z.array(
  z.object({
    type: z.string(),
    text: z.string(),
    name: z.string().optional(),
    default: z.union([z.boolean(), z.number(), z.string()]).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    options: z
      .array(
        z.object({
          name: z.string().optional(),
          text: z.string().optional(),
        })
      )
      .optional(),
  })
);

export const ManifestSchema = z.object({
  format_version: z.number(),
  header: HeaderSchema,
  modules: ModuleSchema,
  dependencies: DependenciesSchema.optional(),
  subpacks: SubpackSchema.optional(),
  capabilities: z.array(z.string()).optional(),
  metadata: MetadataSchema.optional(),
  settings: SettingsSchema.optional(),
});

export type JsonManifest = z.infer<typeof ManifestSchema>;
