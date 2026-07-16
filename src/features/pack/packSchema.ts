import { z } from 'zod'

export const PackFileSchema = z.object({
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.string().min(1),
})

export const PackManifestSchema = z.object({
  format: z.literal('weikefu-pack'),
  formatVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1),
  version: z.string().min(1),
  minAppVersion: z.string().min(1),
  createdAt: z.iso.datetime(),
  sourceFingerprints: z.array(z.object({
    name: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })),
  files: z.array(PackFileSchema).min(1),
})

export type PackManifest = z.infer<typeof PackManifestSchema>

export type ImportedPackFile = {
  path: string
  kind: string
  bytes: Uint8Array
}
