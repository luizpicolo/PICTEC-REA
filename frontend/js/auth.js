const status = document.getElementById('auth-status')
function setStatus(message, type) { status.textContent = message; status.className = `status show ${type}` }
function saveSession(data) { localStorage.setItem('pictec_token', data.token); localStorage.setItem('pictec_user', JSON.stringify(data.usuario)) }
async function submit(form, endpoint) {
  const button = form.querySelector('button'); button.disabled = true
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.erro || 'Não foi possível concluir a solicitação.')
    saveSession(data); location.href = 'enviar.html'
  } catch (error) { setStatus(error.message, 'error') } finally { button.disabled = false }
}
document.getElementById('login-form').addEventListener('submit', event => { event.preventDefault(); submit(event.currentTarget, '/api/login') })
document.getElementById('register-form').addEventListener('submit', event => { event.preventDefault(); submit(event.currentTarget, '/api/cadastro') })
