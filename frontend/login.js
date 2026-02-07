const form = document.getElementById('login-form')
const statusEl = document.getElementById('login-status')
const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

if (form && statusEl) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const email = document.getElementById('login-email')?.value?.trim()
    const password = document.getElementById('login-password')?.value?.trim()

    if (!email || !password) {
      statusEl.textContent = 'Проверьте, что заполнены почта и пароль.'
      return
    }

    statusEl.textContent = 'Проверяем данные...'
    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) throw new Error('login failed')
      const data = await res.json()
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('auth_email', data.email)
      localStorage.setItem('auth_user_id', String(data.id))
      statusEl.textContent = 'Вход выполнен. Перенаправляем в панель...'
      window.location.href = '/plan'
    } catch (e) {
      statusEl.textContent = 'Не удалось войти. Проверьте почту и пароль.'
    }
  })
}

