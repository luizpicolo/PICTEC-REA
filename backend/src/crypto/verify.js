import { readFile } from 'node:fs/promises'
import { verify } from 'node:crypto'

export async function verifyManifestSignature(
  manifestPath = './manifest.json',
  signaturePath = './assinatura.sig',
  publicKey
) {
  const manifest = await readFile(manifestPath)
  const signatureBase64 = await readFile(signaturePath, 'utf-8')
  const publicKeyPem = publicKey || await readFile('./src/keys/public-key.pem', 'utf-8')

  const signature = Buffer.from(
    signatureBase64.trim(),
    'base64'
  )

  return verify(
    null,
    manifest,
    publicKeyPem,
    signature
  )
}
