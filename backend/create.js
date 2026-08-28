
import Busboy from 'busboy'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { sha256File } from './src/crypto/sha256.js'
import { uploadToIPFS } from './src/ipfs/ipfs.js'
import { createManifest } from './src/manifest/create.js'
import { timestampHash } from './src/ots/timestamp.js'
import db from './src/database/database.js'

export async function createObra(req, res) {
  const { fields, file } = await upload(req)

  if (!fields.titulo || !fields.autor || !file)
    return send(res, 400, { erro: 'Preencha título, autor e selecione um arquivo.' })

  await mkdir('./uploads', { recursive: true })
  await mkdir('./records', { recursive: true })

  const id = randomUUID()
  const filePath = `./uploads/${id}`
  const manifestPath = `./records/${id}-manifest.json`
  const signaturePath = `./records/${id}-assinatura.sig`
  const otsPath = `./records/${id}-prova.ots`

  try {
    await writeFile(filePath, file)

    const sha256 = await sha256File(filePath)
    const ipfs = await uploadToIPFS(filePath)

    const manifest = await createManifest({
      title: fields.titulo,
      author: fields.autor,
      cid: ipfs.cid,
      sha256,
      version: fields.versao || '1.0.0',
      manifestPath,
      signaturePath
    })

    const manifestHash = await sha256File(manifestPath)
    const timestamp = await timestampHash(manifestHash, otsPath)

    const result = db.prepare(`
      INSERT INTO obras
      (titulo, autor, cid, sha256, versao, hash_manifesto, arquivo_timestamp, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      manifest.title,
      manifest.author,
      manifest.cid,
      manifest.sha256,
      manifest.version,
      manifestHash,
      timestamp.ots,
      manifest.createdAt
    )

    send(res, 201, {
      id: result.lastInsertRowid,
      titulo: manifest.title,
      autor: manifest.author,
      versao: manifest.version,
      cid: manifest.cid,
      sha256: manifest.sha256,
      hashManifesto: manifestHash,
      timestamp: timestamp.ots,
      criadoEm: manifest.createdAt
    })
  } catch (error) {
    console.error(error)
    send(res, 500, { erro: error.message })
  } finally {
    await unlink(filePath).catch(() => {})
  }
}

function upload(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers })
    const fields = {}
    let file

    bb.on('field', (name, value) => fields[name] = value)
    bb.on('file', (name, stream) => {
      const chunks = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => file = Buffer.concat(chunks))
    })
    bb.on('finish', () => resolve({ fields, file }))
    bb.on('error', reject)

    req.pipe(bb)
  })
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
  })
  res.end(JSON.stringify(data))
}

