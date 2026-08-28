import { readFile } from 'node:fs/promises'
import OpenTimestamps from 'opentimestamps'

export async function verifyTimestamp(
  manifestPath = './manifest.json',
  proofPath = './prova.ots'
) {
  const manifest = await readFile(manifestPath)
  const proof = await readFile(proofPath)

  const detached = OpenTimestamps.DetachedTimestampFile.fromBytes(
    new OpenTimestamps.Ops.OpSHA256(),
    manifest
  )

  const detachedOts =
    OpenTimestamps.DetachedTimestampFile.deserialize(proof)

  const result = await OpenTimestamps.verify(
    detachedOts,
    detached
  )

  if (!result?.bitcoin) {
    return null
  }

  return {
    block: result.bitcoin.height,
    date: new Date(result.bitcoin.timestamp * 1000).toISOString()
  }
}