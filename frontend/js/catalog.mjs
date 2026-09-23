export const catalogOptions = {
  materia: ['Matemática', 'Língua Portuguesa', 'Biologia', 'Física', 'Química', 'História', 'Geografia', 'Ciências', 'Artes', 'Educação Física', 'Inglês', 'Espanhol', 'Filosofia', 'Sociologia', 'Programação', 'Interdisciplinar', 'Outra'],
  tipo: ['Apresentação', 'Exercícios', 'Plano de aula', 'Livro', 'Apostila', 'Artigo', 'Vídeo', 'Áudio', 'Jogo educativo', 'Infográfico', 'Outro'],
  nivel_ensino: ['Educação Infantil', 'Ensino Fundamental — Anos iniciais', 'Ensino Fundamental — Anos finais', 'Ensino Médio', 'Educação Profissional e Técnica', 'Ensino Superior', 'EJA', 'Formação continuada', 'Todos os níveis']
};

export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export function fileFormat(filename) {
  const name = String(filename ?? '').split(/[\\/]/).pop();
  const extension = name.includes('.') ? name.split('.').pop() : '';
  return /^[a-z0-9]{1,16}$/i.test(extension) ? extension.toUpperCase() : 'Sem extensão';
}

export function matchesResource(resource, filters) {
  const get = key => filters instanceof URLSearchParams ? filters.get(key) : filters[key];
  const haystack = normalize([resource.titulo, resource.autor, resource.descricao, resource.materia, resource.tipo, resource.nivel_ensino].join(' '));
  const words = normalize(get('q')).split(/\s+/).filter(Boolean);
  return words.every(word => haystack.includes(word)) &&
    ['materia', 'formato', 'tipo', 'nivel_ensino'].every(key => !get(key) || normalize(resource[key]) === normalize(get(key)));
}

export function readMetadata(fields, filename) {
  const descricao = String(fields.descricao ?? '').trim();
  if (!descricao || descricao.length > 5000) throw new Error('Informe uma descrição com até 5.000 caracteres.');
  const metadata = { descricao, formato: fileFormat(filename) };
  for (const [key, values] of Object.entries(catalogOptions)) {
    if (!values.includes(fields[key])) throw new Error('Selecione matéria, tipo de recurso e nível de ensino válidos.');
    metadata[key] = fields[key];
  }
  return metadata;
}
