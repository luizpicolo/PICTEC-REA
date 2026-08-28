import http from 'node:http'
import { stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createObra } from './create.js'
import { checkObra } from './check.js'

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

  if (req.method === 'POST' && url.pathname === '/api/obras') return createObra(req, res)
  if (req.method === 'POST' && url.pathname === '/api/verificar') return checkObra(req, res)
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

server.listen(3000, () => console.log('PICTEC-REA em http://localhost:3000'))
