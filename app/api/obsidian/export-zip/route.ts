// POST /api/obsidian/export-zip
//
// Accepts a VaultInput payload (gathered client-side from localStorage),
// builds the multi-file vault, zips it with JSZip, returns the ZIP blob.
// One-way export only — does NOT write into the user's real Obsidian vault.

import JSZip from 'jszip'
import { buildVaultBundle, type VaultInput } from '@/lib/obsidian-vault'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let input: VaultInput
  try {
    input = (await request.json()) as VaultInput
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!input || typeof input !== 'object') {
    return Response.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const { files, generatedAt } = buildVaultBundle(input)

  const zip = new JSZip()
  for (const f of files) zip.file(f.path, f.content)

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const date = generatedAt.slice(0, 10)
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

  return new Response(ab, {
    status: 200,
    headers: {
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="picard-vault-${date}.zip"`,
      'Cache-Control':       'no-store',
    },
  })
}
