import { create } from 'kubo-rpc-client'
import { createReadStream } from 'node:fs'

const client = create({
  url: 'http://192.168.0.28:5001'
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