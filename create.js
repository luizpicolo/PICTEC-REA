import { sha256File } from './src/crypto/sha256.js'
import { uploadToIPFS } from './src/ipfs/ipfs.js'
import { createManifest } from './src/manifest/create.js'
import { timestampHash } from './src/ots/timestamp.js'
import { createPackage } from './src/package/createZip.js'

const filePath = './file.pdf'
const sha256 = await sha256File(filePath)
const ipfs = await uploadToIPFS(filePath)

const manifest = await createManifest({
  title: 'Livro de JavaScript',
  author: 'Luiz Picolo',
  cid: ipfs.cid,
  sha256,
  version: '1.0.0'
})

const timestamp = await timestampHash(await sha256File('./manifest.json'), './prova.ots')
const packageFile = await createPackage('./pacote.zip')

console.log(manifest)

