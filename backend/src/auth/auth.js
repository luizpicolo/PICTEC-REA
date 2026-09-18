import {
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPairSync,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from 'node:crypto'
import { promisify } from 'node:util'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import db from '../database/database.js'

const scrypt = promisify(scryptCallback)
const SESSION_DAYS = 7
const authDirectory = path.dirname(fileURLToPath(import.meta.url))
const localSecretPath = path.resolve(authDirectory, '..', '..', '.local-secrets', 'key-encryption-secret')

function encryptionKey() {
  let secret = process.env.PICTEC_KEY_ENCRYPTION_SECRET
  if (secret && secret.length < 32) {
    throw new Error('PICTEC_KEY_ENCRYPTION_SECRET deve ter pelo menos 32 caracteres.')
  }
  if (!secret) {
    // Ambiente local: gera uma única chave persistente. Em produção, configure a variável de ambiente.
    if (existsSync(localSecretPath)) secret = readFileSync(localSecretPath, 'utf8').trim()
    else {
      mkdirSync(path.dirname(localSecretPath), { recursive: true })
      secret = randomBytes(48).toString('base64url')
      writeFileSync(localSecretPath, `${secret}\n`, { encoding: 'utf8', mode: 0o600 })
    }
  }
  return createHash('sha256').update(secret).digest()
}

async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  const hash = await scrypt(password, salt, 64)
  return { salt, hash: Buffer.from(hash).toString('hex') }
}

function encryptPrivateKey(privateKey) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()])
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.')
}

export function decryptPrivateKey(payload) {
  const [iv, tag, encrypted] = payload.split('.')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8')
}

function newKeyPair() {
  return generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
}

function sessionFor(userId) {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const now = new Date()
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  db.prepare('INSERT INTO sessoes (token_hash, usuario_id, expira_em, criado_em) VALUES (?, ?, ?, ?)')
    .run(tokenHash, userId, expires.toISOString(), now.toISOString())
  return { token, expires: expires.toISOString() }
}

export async function register({ nome, email, senha }) {
  nome = String(nome || '').trim()
  email = String(email || '').trim().toLowerCase()
  if (nome.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || String(senha || '').length < 10) {
    throw new Error('Informe nome, e-mail válido e senha com pelo menos 10 caracteres.')
  }
  const { salt, hash } = await passwordHash(senha)
  const keys = newKeyPair()
  try {
    const result = db.prepare(`INSERT INTO usuarios
      (nome, email, senha_hash, senha_salt, chave_publica, chave_privada_cifrada, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(nome, email, hash, salt, keys.publicKey, encryptPrivateKey(keys.privateKey), new Date().toISOString())
    const session = sessionFor(result.lastInsertRowid)
    return { user: { id: result.lastInsertRowid, nome, email, chavePublica: keys.publicKey }, session }
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) throw new Error('Já existe uma conta com este e-mail.')
    throw error
  }
}

export async function login({ email, senha }) {
  const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(String(email || '').trim().toLowerCase())
  if (!user) throw new Error('E-mail ou senha inválidos.')
  const { hash } = await passwordHash(String(senha || ''), user.senha_salt)
  if (!timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.senha_hash, 'hex'))) {
    throw new Error('E-mail ou senha inválidos.')
  }
  const session = sessionFor(user.id)
  return { user: publicUser(user), session }
}

export function publicUser(user) {
  return { id: user.id, nome: user.nome, email: user.email, chavePublica: user.chave_publica }
}

export function userFromRequest(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const hash = createHash('sha256').update(token).digest('hex')
  const row = db.prepare(`SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.expira_em > ?`).get(hash, new Date().toISOString())
  return row || null
}

export function logout(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (token) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(createHash('sha256').update(token).digest('hex'))
}
