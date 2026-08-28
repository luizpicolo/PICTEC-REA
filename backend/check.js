import { mkdir, writeFile, unlink, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { sha256File } from './src/crypto/sha256.js'
import { verifyManifestSignature } from './src/crypto/verify.js'
import { verifyTimestamp } from './src/ots/verify.js'
import { downloadFromIPFS } from './src/ipfs/download.js'
import db from './src/database/database.js'

export async function checkObra(req, res) {
  const { file } = await parseMultipart(req)

  if (!file?.content?.length)
    return sendJson(res, 400, {
      erro: 'Selecione um arquivo para verificar.'
    })

  await mkdir('./uploads', { recursive: true })

  const id = randomUUID()
  const filePath = `./uploads/verificar-${id}`
  const ipfsPath = `./uploads/ipfs-${id}`

  try {
    await writeFile(filePath, file.content)

    const hashArquivo = await sha256File(filePath)

    const obra = db
      .prepare('SELECT * FROM obras WHERE sha256 = ? LIMIT 1')
      .get(hashArquivo)

    if (!obra) {
      return sendJson(res, 200, {
        autentica: false,
        motivo: 'Arquivo não encontrado no registro.',
        sha256: hashArquivo
      })
    }

    const otsPath = obra.arquivo_timestamp
    const base = path.basename(otsPath)

    const manifestPath = base.endsWith('-prova.ots')
      ? `./records/${base.replace('-prova.ots', '-manifest.json')}`
      : './manifest.json'

    const signaturePath = base.endsWith('-prova.ots')
      ? `./records/${base.replace('-prova.ots', '-assinatura.sig')}`
      : './assinatura.sig'

    await stat(manifestPath)
    await stat(signaturePath)
    await stat(otsPath)

    const manifest = JSON.parse(
      await readFile(manifestPath, 'utf8')
    )

    const hashManifesto = await sha256File(manifestPath)

    const assinatura = await verifyManifestSignature(
      manifestPath,
      signaturePath
    )

    let timestamp = null
let timestampPendente = false

try {
  timestamp = await Promise.race([
    verifyTimestamp(manifestPath, otsPath),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    )
  ])
} catch {
  timestampPendente = true
  console.log('Timestamp ainda pendente.')
}

    const recuperado = await downloadFromIPFS(
      manifest.cid,
      ipfsPath
    )

    const hashIPFS = await sha256File(
      recuperado.path
    )

    const arquivo =
      hashArquivo === obra.sha256

    const manifesto =
      hashManifesto === obra.hash_manifesto &&
      manifest.title === obra.titulo &&
      manifest.author === obra.autor &&
      manifest.version === obra.versao &&
      manifest.cid === obra.cid &&
      manifest.sha256 === obra.sha256

    const ipfs =
      hashIPFS === obra.sha256

    const timestampValido =
      timestamp !== null

    const autentica =
      arquivo &&
      manifesto &&
      assinatura &&
      ipfs &&
      timestampValido

    return sendJson(res, 200, {
      autentica,
      sha256: hashArquivo,

      obra: {
        id: obra.id,
        titulo: obra.titulo,
        autor: obra.autor,
        versao: obra.versao
      },

      checks: {
        arquivo,
        manifesto,
        assinatura,
        ipfs,
        timestamp: timestampValido
      },

      timestamp,
      timestampPendente
    })

  } catch (error) {
    console.error('Erro ao verificar:', error)

    return sendJson(res, 500, {
      erro: error.message
    })

  } finally {
    await unlink(filePath).catch(() => {})
    await unlink(ipfsPath).catch(() => {})
  }
}

async function parseMultipart(req) {
  const match =
    (req.headers['content-type'] || '')
      .match(/boundary=(?:"([^"]+)"|([^;]+))/i)

  if (!match)
    throw new Error('Formato de envio inválido.')

  const boundary = Buffer.from(
    `--${match[1] || match[2]}`
  )

  const chunks = []

  for await (const chunk of req)
    chunks.push(chunk)

  const body = Buffer.concat(chunks)

  let file
  let cursor = 0

  while (cursor < body.length) {
    const start = body.indexOf(boundary, cursor)

    if (start < 0)
      break

    const headerStart =
      start + boundary.length + 2

    const headerEnd = body.indexOf(
      Buffer.from('\r\n\r\n'),
      headerStart
    )

    if (headerEnd < 0)
      break

    const next = body.indexOf(
      boundary,
      headerEnd + 4
    )

    if (next < 0)
      break

    const headers = body
      .subarray(headerStart, headerEnd)
      .toString()

    const disposition =
      headers.match(
        /Content-Disposition:[^\r\n]+/i
      )?.[0] || ''

    if (disposition.includes('filename=')) {
      file = {
        content: body.subarray(
          headerEnd + 4,
          next - 2
        )
      }
      break
    }

    cursor = next
  }

  return { file }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type':
      'application/json; charset=utf-8'
  })

  res.end(JSON.stringify(data))
}

