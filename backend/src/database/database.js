import Database from 'better-sqlite3'

const db = new Database('./database.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS obras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    autor TEXT NOT NULL,
    versao TEXT NOT NULL,
    cid TEXT NOT NULL UNIQUE,
    sha256 TEXT NOT NULL,
    hash_manifesto TEXT NOT NULL,
    arquivo_timestamp TEXT NOT NULL,
    criado_em TEXT NOT NULL
  )
`)

export default db