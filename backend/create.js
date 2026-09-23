import { readMetadata } from '../frontend/js/catalog.mjs'

import Busboy from 'busboy'
import { mkdir, writeFile, unlink, rename } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { sha256File } from './src/crypto/sha256.js'
import { uploadToIPFS } from './src/ipfs/ipfs.js'
import { createManifest } from './src/manifest/create.js'
import { timestampHash } from './src/ots/timestamp.js'
import db from './src/database/database.js'
import { decryptPrivateKey } from './src/auth/auth.js'

export async function createObra(req, res) {
  if (!req.user) return send(res, 401, { erro: 'Faça login para enviar uma obra.' })
  const { fields, file } = await upload(req)

  if (!fields.titulo || !fields.autor || !file)
    return send(res, 400, { erro: 'Preencha título, autor e selecione um arquivo.' })

  let metadata
  try {
    metadata = readMetadata(fields, file.name)
  } catch (error) {
    return send(res, 400, { erro: error.message })
  }

  await mkdir('./uploads', { recursive: true })
  await mkdir('./records', { recursive: true })
  await mkdir('./obras', { recursive: true })

  const id = randomUUID()
  const filePath = `./uploads/${id}`
  const manifestPath = `./records/${id}-manifest.json`
  const signaturePath = `./records/${id}-assinatura.sig`
  const otsPath = `./records/${id}-prova.ots`
  const fileName = safeFileName(file.name)
  const localPath = `./obras/${id}-${fileName}`
  let storedLocally = false

  try {
    await writeFile(filePath, file.content)

    const sha256 = await sha256File(filePath)
    const ipfs = await uploadToIPFS(filePath)

    const manifest = await createManifest({
      metadata,
      title: fields.titulo,
      author: fields.autor,
      cid: ipfs.cid,
      sha256,
      version: fields.versao || '1.0.0',
      manifestPath,
      signaturePath,
      privateKey: decryptPrivateKey(req.user.chave_privada_cifrada),
      publicKey: req.user.chave_publica
    })

    const manifestHash = await sha256File(manifestPath)
    const timestamp = await timestampHash(manifestHash, otsPath)

    const result = db.prepare(`
      INSERT INTO obras
      (titulo, autor, cid, sha256, versao, hash_manifesto, arquivo_timestamp, criado_em, usuario_id, arquivo_local, nome_arquivo, descricao, materia, formato, tipo, nivel_ensino)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      manifest.title,
      manifest.author,
      manifest.cid,
      manifest.sha256,
      manifest.version,
      manifestHash,
      timestamp.ots,
      manifest.createdAt,
      req.user.id,
      localPath,
      fileName,
      metadata.descricao,
      metadata.materia,
      metadata.formato,
      metadata.tipo,
      metadata.nivel_ensino
    )

    await rename(filePath, localPath)
    storedLocally = true

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
    if (!storedLocally) await unlink(filePath).catch(() => {})
  }
}

function upload(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers })
    const fields = {}
    let file

    bb.on('field', (name, value) => fields[name] = value)
    bb.on('file', (name, stream, info) => {
      const chunks = []
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('end', () => file = { content: Buffer.concat(chunks), name: info.filename })
    })
    bb.on('finish', () => resolve({ fields, file }))
    bb.on('error', reject)

    req.pipe(bb)
  })
}

function safeFileName(name) {
  const clean = path.basename(String(name || 'obra')).replace(/[^a-zA-Z0-9._-]/g, '_')
  return clean || 'obra'
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8'
  })
  res.end(JSON.stringify(data))
}
