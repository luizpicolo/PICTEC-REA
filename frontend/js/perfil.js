const perfilStatus = document.getElementById('perfil-status')

window.pictecSession.ready.then(usuario => {
  if (!usuario) {
    location.replace('login.html')
    return
  }
  document.getElementById('perfil-nome').textContent = usuario.nome
  document.getElementById('perfil-email').textContent = usuario.email
  document.getElementById('perfil-chave').textContent = usuario.chavePublica
  perfilStatus.hidden = true
})

document.getElementById('sair').addEventListener('click', () => window.pictecSession.logout())
