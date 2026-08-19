import { readFile } from 'node:fs/promises'
import { sha256File } from './src/crypto/sha256.js'
import { verifyManifestSignature } from './src/crypto/verify.js'
import { verifyTimestamp } from './src/ots/verify.js'
import { downloadFromIPFS } from './src/ipfs/download.js'

const valid = await verifyManifestSignature()
const manifest = JSON.parse(await readFile('./manifest.json', 'utf-8'))
const result = await verifyTimestamp('./manifest.json', './prova.ots')

const file = await downloadFromIPFS(
  manifest.cid,
  './recuperado.pdf'
)

console.log(valid)
console.log(result)
console.log(file)
console.log(await sha256File(file.path) == await sha256File('./file.pdf'))