import { readFile, writeFile } from 'node:fs/promises'
import { sign } from 'node:crypto'

export async function createManifest({
  title,
  author,
  cid,
  sha256,
  version = '1.0.0',
  manifestPath = './manifest.json',
  signaturePath = './assinatura.sig'
}) {
  const manifest = {
    title,
    author,
    cid,
    sha256,
    version,
    createdAt: new Date().toISOString()
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

  const data = await readFile(manifestPath)
  const privateKey = await readFile('./src/keys/private-key.pem', 'utf-8')
  const signature = sign(null, data, privateKey)

  await writeFile(signaturePath, signature.toString('base64'), 'utf-8')

  return manifest
}
