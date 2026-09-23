import { catalogOptions, fileFormat, matchesResource } from './catalog.mjs';

const form = document.getElementById('catalog-form');
const list = document.getElementById('lista');
const status = document.getElementById('catalog-status');
let resources = null;

for (const [name, values] of Object.entries(catalogOptions)) {
  for (const value of values) form.elements[name].add(new Option(value, value));
}

const formatGroups = {
  'Documentos': ['PDF', 'DOCX'],
  'Apresentações': ['PPTX'],
  'Planilhas': ['XLSX'],
  'Imagens': ['JPG', 'JPEG', 'PNG'],
  'Áudio': ['MP3'],
  'Vídeo': ['MP4'],
  'Compactados': ['ZIP']
};

for (const [label, formats] of Object.entries(formatGroups)) {
  const group = document.createElement('optgroup');
  group.label = label;
  for (const format of formats) group.append(new Option(format, format));
  form.elements.formato.append(group);
}

function restoreFilters() {
  const params = new URLSearchParams(location.search);
  for (const key of ['q', 'materia', 'formato', 'tipo', 'nivel_ensino']) {
    const field = form.elements[key];
    const value = params.get(key) || '';
    if (field.tagName === 'SELECT' && value && !Array.from(field.options).some(option => option.value === value)) {
      field.add(new Option(value, value));
    }
    field.value = value;
  }
}

function currentFilters() {
  const params = new URLSearchParams();
  for (const [key, value] of new FormData(form)) if (value.trim()) params.set(key, value.trim());
  return params;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function render() {
  if (!resources) return;
  const filters = currentFilters();
  const results = resources.filter(resource => matchesResource(resource, filters));
  status.textContent = `${results.length} recurso(s) encontrado(s)${filters.size ? ' com a busca e os filtros selecionados' : ''}.`;
  if (!results.length) {
    list.innerHTML = filters.size
      ? '<article class="card"><h3>Nenhum recurso encontrado.</h3><p>Tente outras palavras ou limpe os filtros acima.</p></article>'
      : '<article class="card"><h3>Nenhuma obra registrada ainda.</h3><p>Compartilhe o primeiro recurso.</p><a class="button primary" href="enviar.html">Publicar recurso</a></article>';
    return;
  }
  list.innerHTML = results.map(resource => {
    const id = encodeURIComponent(resource.id);
    return `<article class="card">
      <h3>${escapeHtml(resource.titulo)}</h3>
      <p><strong>Autor:</strong> ${escapeHtml(resource.autor)}</p>
      <div class="resource-tags">${['materia', 'formato', 'tipo', 'nivel_ensino'].filter(key => resource[key]).map(key => `<span>${escapeHtml(resource[key])}</span>`).join('')}</div>
      <p class="resource-description">${escapeHtml(resource.descricao || 'Descrição não informada neste registro.')}</p>
      <details class="resource-record"><summary>Dados do registro</summary>
        <p><strong>Versão:</strong> ${escapeHtml(resource.versao)}</p>
        <p><strong>CID:</strong> ${escapeHtml(resource.cid)}</p>
        <p><strong>SHA-256:</strong> ${escapeHtml(resource.sha256)}</p>
        <p><strong>Registrada em:</strong> ${escapeHtml(new Date(resource.criado_em).toLocaleString('pt-BR'))}</p>
      </details>
      <div class="download-actions">
        ${resource.tem_copia_local ? `<a class="button secondary" href="/api/obras/${id}/download?fonte=local">Baixar cópia local</a>` : ''}
        <a class="button secondary" href="/api/obras/${id}/download?fonte=ipfs">Baixar do IPFS</a>
        <a class="button primary" href="/api/obras/${id}/provas">Baixar pacote de prova</a>
      </div>
    </article>`;
  }).join('');
}

function applyFilters() {
  const params = currentFilters();
  const query = params.toString();
  history.pushState(null, '', `${location.pathname}${query ? '?' + query : ''}`);
  render();
}

form.addEventListener('submit', event => { event.preventDefault(); applyFilters(); });
form.addEventListener('change', event => { if (event.target.tagName === 'SELECT') applyFilters(); });
form.addEventListener('reset', event => {
  event.preventDefault();
  for (const key of ['q', 'materia', 'formato', 'tipo', 'nivel_ensino']) form.elements[key].value = '';
  applyFilters();
});
window.addEventListener('popstate', () => { restoreFilters(); render(); });
restoreFilters();
status.textContent = 'Carregando recursos...';

try {
  const response = await fetch('/api/obras');
  if (!response.ok) throw new Error('Falha ao carregar');
  resources = (await response.json()).map(resource => ({
    ...resource,
    formato: resource.formato || (resource.nome_arquivo ? fileFormat(resource.nome_arquivo) : '')
  }));
  for (const value of [...new Set(resources.map(resource => resource.formato).filter(Boolean))].sort()) {
    if (!Array.from(form.elements.formato.options).some(option => option.value === value)) form.elements.formato.add(new Option(value, value));
  }
  restoreFilters();
  render();
} catch {
  status.textContent = 'Não foi possível carregar os recursos. Atualize a página para tentar novamente.';
  list.innerHTML = '<article class="card"><h3>Catálogo indisponível</h3><p>Verifique a conexão com o servidor.</p></article>';
} finally {
  list.setAttribute('aria-busy', 'false');
}
