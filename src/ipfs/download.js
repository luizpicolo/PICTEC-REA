import { create } from 'kubo-rpc-client'
import { writeFile } from 'node:fs/promises'

const ipfs = create({
  url: 'http://192.168.0.28:5001'
})

export async function downloadFromIPFS(cid, outputPath) {
  const chunks = []

  for await (const chunk of ipfs.cat(cid)) {
    chunks.push(chunk)
  }

  const file = Buffer.concat(chunks)

  await writeFile(outputPath, file)

  return {
    cid,
    path: outputPath,
    size: file.length
  }
}