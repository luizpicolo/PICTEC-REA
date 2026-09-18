(() => {
  const token = localStorage.getItem('pictec_token')
  let user = null

  function renderAccountLink(account) {
    const nav = document.querySelector('.nav')
    if (!nav) return
    let link = nav.querySelector('[data-account-link]') || nav.querySelector('a[href="login.html"]')
    if (!link) {
      link = document.createElement('a')
      nav.append(link)
    }
    link.dataset.accountLink = 'true'
    link.href = account ? 'perfil.html' : 'login.html'
    link.textContent = account ? 'Perfil' : 'Entrar'
    link.title = account ? `Conta: ${account.nome}` : 'Entrar ou criar conta'
  }

  async function loadSession() {
    if (!token) {
      renderAccountLink(null)
      window.dispatchEvent(new CustomEvent('pictec-session-ready', { detail: null }))
      return null
    }
    try {
      const response = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) throw new Error('Sessão expirada')
      const data = await response.json()
      user = data.usuario
      localStorage.setItem('pictec_user', JSON.stringify(user))
    } catch {
      localStorage.removeItem('pictec_token')
      localStorage.removeItem('pictec_user')
    }
    renderAccountLink(user)
    window.dispatchEvent(new CustomEvent('pictec-session-ready', { detail: user }))
    return user
  }

  window.pictecSession = {
    get user() { return user },
    get token() { return localStorage.getItem('pictec_token') },
    async logout() {
      const currentToken = localStorage.getItem('pictec_token')
      if (currentToken) await fetch('/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${currentToken}` } }).catch(() => {})
      localStorage.removeItem('pictec_token')
      localStorage.removeItem('pictec_user')
      location.href = 'index.html'
    }
  }
  window.pictecSession.ready = loadSession()
})()
