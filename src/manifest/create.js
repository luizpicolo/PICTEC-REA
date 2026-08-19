import { readFile, writeFile } from 'node:fs/promises'
import { sign } from 'node:crypto'

export async function createManifest({ title, author, cid, sha256, version = '1.0.0' }) {
  const manifest = {
    title,
    author,
    cid,
    sha256,
    version,
    createdAt: new Date().toISOString()
  }

  await writeFile('./manifest.json', JSON.stringify(manifest, null, 2), 'utf-8')

  const data = await readFile('./manifest.json')
  const privateKey = await readFile('./src/keys/private-key.pem', 'utf-8')
  const signature = sign(null, data, privateKey)

  await writeFile('./assinatura.sig', signature.toString('base64'), 'utf-8')

  return manifest
}