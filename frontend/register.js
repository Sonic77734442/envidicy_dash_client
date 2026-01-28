const form = document.getElementById('register-form')
const statusEl = document.getElementById('register-status')
const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

if (form && statusEl) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const name = document.getElementById('register-name')?.value?.trim()
    const company = document.getElementById('register-company')?.value?.trim()
    const email = document.getElementById('register-email')?.value?.trim()
    const password = document.getElementById('register-password')?.value?.trim()
    const confirm = document.getElementById('register-password-confirm')?.value?.trim()

    if (!email || !password) {
      statusEl.textContent = 'Заполните обязательные поля.'
      return
    }

    if (password !== confirm) {
      statusEl.textContent = 'Пароли не совпадают. Проверьте ввод.'
      return
    }

    statusEl.textContent = 'Создаем аккаунт...'
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('register failed')
      const data = await res.json()
      localStorage.setItem('auth_token', data.token)
      localStorage.setItem('auth_email', data.email)
      localStorage.setItem('auth_user_id', String(data.id))
      statusEl.textContent = 'Аккаунт создан. Сохраняем профиль...'
      if (name || company) {
        try {
          await fetch(`${apiBase}/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
            body: JSON.stringify({ name: name || null, company: company || null, language: 'ru' }),
          })
        } catch (e) {
          // ignore profile failure
        }
      }
      statusEl.textContent = 'Аккаунт создан. Перенаправляем...'
      window.location.href = './index.html'
    } catch (e) {
      if (e.name === 'AbortError') {
        statusEl.textContent = 'Сервер не отвечает. Проверьте что API запущен на :8000.'
      } else {
        statusEl.textContent = 'Не удалось создать аккаунт. Проверьте данные.'
      }
      console.error('Register failed', e)
    } finally {
      clearTimeout(timeoutId)
    }
  })
}
