const loginForm = document.getElementById('login-form')
const statusEl = document.getElementById('login-status')
const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'
const search = new URLSearchParams(window.location.search)

async function getAccessStatus(email) {
  const res = await fetch(`${apiBase}/auth/access-status?email=${encodeURIComponent(email)}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.detail || 'status check failed')
  return data
}

function initStatusMessage() {
  const email = search.get('email') || ''
  const passwordSet = search.get('password_set') === '1'
  const loginEmail = document.getElementById('login-email')
  if (loginEmail && email) loginEmail.value = email
  if (!statusEl) return
  if (passwordSet) {
    statusEl.textContent = '\u041f\u0430\u0440\u043e\u043b\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0435\u043d. \u0422\u0435\u043f\u0435\u0440\u044c \u0432\u043e\u0439\u0434\u0438\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u043e\u0431\u044b\u0447\u043d\u044b\u0439 \u043b\u043e\u0433\u0438\u043d.'
    return
  }
  statusEl.textContent = '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 email \u0438 \u043f\u0430\u0440\u043e\u043b\u044c, \u0447\u0442\u043e\u0431\u044b \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0438\u0442\u044c.'
}

if (loginForm && statusEl) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const email = document.getElementById('login-email')?.value?.trim()
    const password = document.getElementById('login-password')?.value?.trim()

    if (!email || !password) {
      statusEl.textContent = '\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435, \u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430, email \u0438 \u043f\u0430\u0440\u043e\u043b\u044c.'
      return
    }

    statusEl.textContent = '\u0412\u044b\u043f\u043e\u043b\u043d\u044f\u0435\u0442\u0441\u044f \u0432\u0445\u043e\u0434...'
    try {
      const accessStatus = await getAccessStatus(email)
      if (accessStatus?.exists && accessStatus?.needs_password) {
        window.location.href = `/set-password?email=${encodeURIComponent(accessStatus.email || email)}`
        return
      }

      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'login failed')
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('auth_email', data.email)
      localStorage.setItem('auth_user_id', String(data.id))
      statusEl.textContent = '\u0412\u0445\u043e\u0434 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d. \u041f\u0435\u0440\u0435\u043d\u0430\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435...'
      window.location.href = '/plan'
    } catch (e) {
      statusEl.textContent = e?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0432\u043e\u0439\u0442\u0438. \u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043f\u043e\u0447\u0442\u0443 \u0438 \u043f\u0430\u0440\u043e\u043b\u044c.'
    }
  })
}

initStatusMessage()
