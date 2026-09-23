import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, verify } from 'node:crypto';
import Database from 'better-sqlite3';
import { matchesResource, readMetadata, fileFormat } from '../../frontend/js/catalog.mjs';
import { createManifest } from '../src/manifest/create.js';

const resource = {
  titulo: 'Frações', autor: 'Ana', descricao: 'Exercícios com áudio, legendas e leitor de tela.',
  materia: 'Matemática', formato: 'PDF', tipo: 'Exercícios', nivel_ensino: 'Ensino Médio'
};

test('busca encontra termos assistivos sem acentos, combinando palavras e filtros', () => {
  assert.ok(matchesResource(resource, new URLSearchParams('q=audio+fracoes&materia=Matemática&formato=pdf&tipo=Exercícios&nivel_ensino=Ensino+Médio')));
  assert.ok(matchesResource(resource, { q: 'LEITOR DE TELA' }));
  assert.equal(matchesResource(resource, { q: 'libras' }), false);
  assert.equal(matchesResource(resource, { q: 'audio', materia: 'Biologia' }), false);
  assert.equal(matchesResource(resource, { formato: 'DOCX' }), false);
});

test('registros antigos continuam acessíveis sem metadados', () => {
  assert.ok(matchesResource({ titulo: 'Livro antigo', autor: 'Maria' }, {}));
  assert.ok(matchesResource({ titulo: 'Livro antigo' }, { q: 'antigo' }));
  assert.equal(matchesResource({ titulo: 'Livro antigo' }, { tipo: 'Livro' }), false);
});

test('cadastro valida classificações e deriva formato do arquivo', () => {
  assert.equal(readMetadata(resource, 'aula.PdF').formato, 'PDF');
  assert.equal(fileFormat('arquivo'), 'Sem extensão');
  assert.equal(fileFormat('arquivo.'), 'Sem extensão');
  assert.throws(() => readMetadata({ ...resource, materia: 'inválida' }, 'x.pdf'));
  assert.throws(() => readMetadata({ ...resource, descricao: ' ' }, 'x.pdf'));
  assert.throws(() => readMetadata({ ...resource, descricao: 'x'.repeat(5001) }, 'x.pdf'));
});

test('migração preserva registros e pode executar novamente', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pictec-migration-'));
  try {
    const db = new Database(join(dir, 'database.db'));
    db.exec(`CREATE TABLE obras (id INTEGER PRIMARY KEY, titulo TEXT, autor TEXT, versao TEXT, cid TEXT, sha256 TEXT, hash_manifesto TEXT, arquivo_timestamp TEXT, criado_em TEXT);
      INSERT INTO obras (id, titulo) VALUES (1, 'Recurso antigo');`);
    db.close();
    const url = new URL('../src/database/database.js', import.meta.url).href;
    for (let i = 0; i < 2; i++) execFileSync(process.execPath, ['--input-type=module', '-e', `import db from '${url}'; db.close();`], { cwd: dir });
    const migrated = new Database(join(dir, 'database.db'));
    const row = migrated.prepare('SELECT * FROM obras').get();
    assert.equal(row.titulo, 'Recurso antigo');
    for (const key of ['descricao', 'materia', 'formato', 'tipo', 'nivel_ensino']) assert.equal(row[key], '');
    migrated.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('metadados educacionais fazem parte do manifesto assinado', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pictec-manifest-'));
  try {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const manifestPath = join(dir, 'manifest.json');
    const signaturePath = join(dir, 'signature.txt');
    const metadata = readMetadata(resource, 'aula.pdf');
    await createManifest({ title: 'Frações', author: 'Ana', cid: 'test', sha256: 'test', metadata, manifestPath, signaturePath, privateKey, publicKey: publicKey.export({ type: 'spki', format: 'pem' }) });
    const data = readFileSync(manifestPath);
    assert.deepEqual(JSON.parse(data).educationalMetadata, metadata);
    assert.ok(verify(null, data, publicKey, Buffer.from(readFileSync(signaturePath, 'utf8'), 'base64')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
