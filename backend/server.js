import http from 'node:http'
import { stat, unlink, readFile } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { ZipArchive } from 'archiver'
import { createObra } from './create.js'
import { checkObra } from './check.js'
import { login, logout, publicUser, register, userFromRequest } from './src/auth/auth.js'
import db from './src/database/database.js'
import { downloadFromIPFS } from './src/ipfs/download.js'

const frontend = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend')
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'POST' && url.pathname === '/api/cadastro') return authAction(req, res, register)
  if (req.method === 'POST' && url.pathname === '/api/login') return authAction(req, res, login)
  if (req.method === 'POST' && url.pathname === '/api/logout') {
    logout(req)
    return json(res, 204)
  }
  if (req.method === 'GET' && url.pathname === '/api/me') {
    const user = userFromRequest(req)
    return user ? json(res, 200, { usuario: publicUser(user) }) : json(res, 401, { erro: 'Sessão inválida ou expirada.' })
  }
  if (req.method === 'GET' && url.pathname === '/api/obras') {
    return json(res, 200, db.prepare(`SELECT obras.id, obras.titulo, obras.autor, obras.versao, obras.cid,
      obras.sha256, obras.criado_em, obras.arquivo_local IS NOT NULL AS tem_copia_local, usuarios.nome AS usuario_nome FROM obras
      LEFT JOIN usuarios ON usuarios.id = obras.usuario_id ORDER BY obras.id DESC`).all())
  }
  if (req.method === 'POST' && url.pathname === '/api/obras') {
    req.user = userFromRequest(req)
    return createObra(req, res)
  }
  if (req.method === 'POST' && url.pathname === '/api/verificar') return checkObra(req, res)
  const downloadMatch = url.pathname.match(/^\/api\/obras\/(\d+)\/(download|provas)$/)
  if (req.method === 'GET' && downloadMatch) {
    return downloadObra(res, Number(downloadMatch[1]), downloadMatch[2], url.searchParams.get('fonte'))
  }
  if (req.method !== 'GET') return res.end('Método não permitido.')

  const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
  if (relative.includes('..')) return res.end('Caminho inválido.')
  const file = path.join(frontend, relative)

  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error()
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' })
    createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404)
    res.end('Página não encontrada.')
  }
})

async function authAction(req, res, action) {
  try {
    const body = await readJson(req)
    const { user, session } = await action(body)
    json(res, 200, { usuario: user, token: session.token, expiraEm: session.expires })
  } catch (error) {
    json(res, 400, { erro: error.message || 'Não foi possível concluir a solicitação.' })
  }
}

async function readJson(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > 16 * 1024) throw new Error('Solicitação inválida.')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new Error('Dados inválidos.') }
}

function json(res, status, data = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(status === 204 ? undefined : JSON.stringify(data))
}

function obraById(id) {
  return db.prepare(`SELECT obras.*, usuarios.chave_publica FROM obras
    LEFT JOIN usuarios ON usuarios.id = obras.usuario_id WHERE obras.id = ?`).get(id)
}

function attachment(res, filename, contentType) {
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
  })
}

async function downloadFileName(obra, filePath) {
  if (obra.nome_arquivo) return obra.nome_arquivo
  const header = await readFile(filePath)
  let extension = ''
  if (header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) extension = '.png'
  else if (header.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) extension = '.jpg'
  else if (header.subarray(0, 5).toString() === '%PDF-') extension = '.pdf'
  else if (header.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) extension = '.zip'
  return `obra-${obra.id}${extension}`
}

function contentTypeFor(filename) {
  const extension = path.extname(filename).toLowerCase()
  return mime[extension] || (extension === '.pdf' ? 'application/pdf' : 'application/octet-stream')
}

async function downloadObra(res, id, type, source) {
  const obra = obraById(id)
  if (!obra) return json(res, 404, { erro: 'Obra não encontrada.' })

  if (type === 'provas') return downloadProofPackage(res, obra)
  try {
    if (source === 'local') {
      if (!obra.arquivo_local) return json(res, 404, { erro: 'Esta obra não possui cópia local.' })
      await stat(obra.arquivo_local)
      const name = await downloadFileName(obra, obra.arquivo_local)
      attachment(res, name, contentTypeFor(name))
      return createReadStream(obra.arquivo_local).pipe(res)
    }
    if (source === 'ipfs') {
      const temporary = `./uploads/download-${randomUUID()}`
      await downloadFromIPFS(obra.cid, temporary)
      const name = await downloadFileName(obra, temporary)
      attachment(res, name, contentTypeFor(name))
      const stream = createReadStream(temporary)
      stream.on('error', () => res.destroy())
      stream.on('close', () => unlink(temporary).catch(() => {}))
      return stream.pipe(res)
    }
    return json(res, 400, { erro: 'Informe fonte=local ou fonte=ipfs.' })
  } catch (error) {
    console.error('Erro ao baixar obra:', error)
    if (!res.headersSent) return json(res, 502, { erro: 'Não foi possível obter o arquivo solicitado.' })
    res.destroy()
  }
}

async function downloadProofPackage(res, obra) {
  const otsPath = obra.arquivo_timestamp
  const base = path.basename(otsPath || '')
  const manifestPath = base.endsWith('-prova.ots') ? `./records/${base.replace('-prova.ots', '-manifest.json')}` : null
  const signaturePath = base.endsWith('-prova.ots') ? `./records/${base.replace('-prova.ots', '-assinatura.sig')}` : null
  try {
    await Promise.all([stat(otsPath), stat(manifestPath), stat(signaturePath)])
  } catch {
    return json(res, 404, { erro: 'Os arquivos de prova desta obra não estão disponíveis.' })
  }

  attachment(res, `provas-obra-${obra.id}.zip`, 'application/zip')
  const archive = new ZipArchive({ zlib: { level: 9 } })
  archive.on('error', error => { console.error('Erro ao gerar ZIP:', error); res.destroy(error) })
  archive.file(manifestPath, { name: 'manifest.json' })
  archive.file(signaturePath, { name: 'assinatura.sig' })
  archive.file(otsPath, { name: 'prova.ots' })
  if (obra.chave_publica) archive.append(obra.chave_publica, { name: 'chave-publica.pem' })
  archive.append('Este pacote contém as evidências de integridade e autoria da obra.\n', { name: 'LEIA-ME.txt' })
  archive.pipe(res)
  await archive.finalize()
}

server.listen(3000, () => console.log('PICTEC-REA em http://localhost:3000'))
