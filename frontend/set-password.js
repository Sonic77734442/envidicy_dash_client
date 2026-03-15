const form = document.getElementById('set-password-form')
const statusEl = document.getElementById('set-password-status')
const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'
const search = new URLSearchParams(window.location.search)

function init() {
  const email = search.get('email') || ''
  const emailInput = document.getElementById('set-password-email')
  if (emailInput && email) emailInput.value = email
}

if (form && statusEl) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const email = document.getElementById('set-password-email')?.value?.trim()
    const next = document.getElementById('set-password-new')?.value?.trim()
    const confirm = document.getElementById('set-password-confirm')?.value?.trim()

    if (!email || !next) {
      statusEl.textContent = '\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 email \u0438 \u043d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c.'
      return
    }
    if (next !== confirm) {
      statusEl.textContent = '\u041f\u0430\u0440\u043e\u043b\u0438 \u043d\u0435 \u0441\u043e\u0432\u043f\u0430\u0434\u0430\u044e\u0442.'
      return
    }

    statusEl.textContent = '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435 \u043f\u0430\u0440\u043e\u043b\u044f...'
    try {
      const res = await fetch(`${apiBase}/auth/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, new_password: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'set-password failed')
      window.location.href = `/login?email=${encodeURIComponent(email)}&password_set=1`
    } catch (e) {
      statusEl.textContent = e?.message || '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0434\u0430\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c.'
    }
  })
}

init()
