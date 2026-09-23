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

// Migração atômica para preservar registros e evitar concorrência na inicialização.
db.transaction(() => {
  const columns = new Set(db.prepare('PRAGMA table_info(obras)').all().map(column => column.name))
  const additions = {
    usuario_id: 'INTEGER REFERENCES usuarios(id)',
    arquivo_local: 'TEXT',
    nome_arquivo: 'TEXT',
    descricao: "TEXT NOT NULL DEFAULT ''",
    materia: "TEXT NOT NULL DEFAULT ''",
    formato: "TEXT NOT NULL DEFAULT ''",
    tipo: "TEXT NOT NULL DEFAULT ''",
    nivel_ensino: "TEXT NOT NULL DEFAULT ''"
  }
  for (const [column, definition] of Object.entries(additions)) {
    if (!columns.has(column)) db.exec(`ALTER TABLE obras ADD COLUMN ${column} ${definition}`)
  }
}).immediate()

export default db
