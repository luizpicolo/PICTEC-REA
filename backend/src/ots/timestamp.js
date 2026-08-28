import OpenTimestamps from 'opentimestamps'
import { writeFile } from 'node:fs/promises'

export async function timestampHash(
  sha256,
  outputPath = './prova.ots'
) {
  const hash = Buffer.from(sha256, 'hex')

  const detached = OpenTimestamps.DetachedTimestampFile.fromHash(
    new OpenTimestamps.Ops.OpSHA256(),
    hash
  )

  await OpenTimestamps.stamp(detached)

  const otsFile = detached.serializeToBytes()

  await writeFile(outputPath, Buffer.from(otsFile))

  return {
    sha256,
    ots: outputPath
  }
}