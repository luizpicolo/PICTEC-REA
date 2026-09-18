import Database from 'better-sqlite3'

const db = new Database('./database.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash TEXT NOT NULL,
    senha_salt TEXT NOT NULL,
    chave_publica TEXT NOT NULL,
    chave_privada_cifrada TEXT NOT NULL,
    criado_em TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    token_hash TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    expira_em TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

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

// Compatibilidade com bancos criados antes da autenticação.
const obraColumns = db.prepare('PRAGMA table_info(obras)').all().map(column => column.name)
if (!obraColumns.includes('usuario_id')) {
  db.exec('ALTER TABLE obras ADD COLUMN usuario_id INTEGER REFERENCES usuarios(id)')
}
if (!obraColumns.includes('arquivo_local')) {
  db.exec('ALTER TABLE obras ADD COLUMN arquivo_local TEXT')
}
if (!obraColumns.includes('nome_arquivo')) {
  db.exec('ALTER TABLE obras ADD COLUMN nome_arquivo TEXT')
}

export default db
