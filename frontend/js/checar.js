const formulario = document.getElementById('formulario-checagem')
const botao = document.getElementById('botao-verificar')
const status = document.getElementById('status')
const resultado = document.getElementById('resultado')

formulario.addEventListener('submit', async event => {
  event.preventDefault()
  const arquivo = document.getElementById('arquivo').files[0]
  if (!arquivo) return

  botao.disabled = true
  botao.textContent = 'Verificando...'
  resultado.hidden = true
  status.textContent = 'Verificando integridade, assinatura, IPFS e timestamp...'
  status.className = 'status show loading'

  try {
    const resposta = await fetch('/api/verificar', { method: 'POST', body: new FormData(formulario) })
    const dados = await resposta.json()
    if (!resposta.ok) throw new Error(dados.erro || 'Erro ao verificar o arquivo.')

    const c = dados.checks || {}
    status.textContent = dados.autentica ? '✓ Arquivo autêntico' : '✕ Arquivo não autenticado'
    status.className = `status show ${dados.autentica ? 'success' : 'error'}`
    resultado.hidden = false
    resultado.innerHTML = `
      <strong>${dados.autentica ? 'Registro válido' : 'Registro não confirmado'}</strong>
      ${dados.obra ? `<div>Título: ${dados.obra.titulo}</div><div>Autor: ${dados.obra.autor}</div><div>Versão: ${dados.obra.versao}</div>` : ''}
      <div>Arquivo: ${c.arquivo ? '✓' : '✕'}</div>
      <div>Manifesto: ${c.manifesto ? '✓' : '✕'}</div>
      <div>Assinatura: ${c.assinatura ? '✓' : '✕'}</div>
      <div>IPFS: ${c.ipfs ? '✓' : '✕'}</div>
      <div>Timestamp: ${c.timestamp ? '✓' : '✕'}</div>
      <div>SHA-256: ${dados.sha256 || '—'}</div>
    `
  } catch (error) {
    status.textContent = `Erro: ${error.message}`
    status.className = 'status show error'
  } finally {
    botao.disabled = false
    botao.textContent = 'Verificar arquivo'
  }
})
