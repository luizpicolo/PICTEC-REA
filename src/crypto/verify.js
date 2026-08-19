import { readFile } from 'node:fs/promises'
import { verify } from 'node:crypto'

export async function verifyManifestSignature(
  manifestPath = './manifest.json',
  signaturePath = './assinatura.sig',
  publicKeyPath = './src/keys/public-key.pem'
) {
  const manifest = await readFile(manifestPath)
  const signatureBase64 = await readFile(signaturePath, 'utf-8')
  const publicKey = await readFile(publicKeyPath, 'utf-8')

  const signature = Buffer.from(
    signatureBase64.trim(),
    'base64'
  )

  return verify(
    null,
    manifest,
    publicKey,
    signature
  )
}