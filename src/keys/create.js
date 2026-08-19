import { generateKeyPairSync } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
})

await writeFile('./src/keys/private-key.pem', privateKey)
await writeFile('./src/keys/public-key.pem', publicKey)

console.log('Chaves geradas.')