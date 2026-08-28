import { create } from 'kubo-rpc-client'
import { createReadStream } from 'node:fs'

const client = create({
  url: 'http://127.0.0.1:5001'
})

export async function uploadToIPFS(filePath) {
  const file = createReadStream(filePath)

  const { cid, size } = await client.add(file)

  await client.pin.add(cid)

  return {
    cid: cid.toString(),
    size
  }
}