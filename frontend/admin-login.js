const apiBase = window.API_BASE || 'http://127.0.0.1:8000'
const params = new URLSearchParams(window.location.search)
const adminKey = params.get('key')
if (!adminKey) {
  window.location.href = './login.html'
} else {
  fetch(`${apiBase}/admin/check-key?key=${encodeURIComponent(adminKey)}`)
    .then((res) => {
      if (!res.ok) throw new Error('invalid')
    })
    .catch(() => {
      window.location.href = './login.html'
    })
}
const resetForm = document.getElementById('reset-form')
const resetStatus = document.getElementById('reset-status')

if (resetForm && resetStatus) {
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const email = document.getElementById('reset-email')?.value?.trim()
    const password = document.getElementById('reset-password')?.value?.trim()
    const token = document.getElementById('reset-token')?.value?.trim()
    if (!email || !password || !token) {
      resetStatus.textContent = 'Заполните все поля.'
      return
    }
    resetStatus.textContent = 'Сбрасываем пароль...'
    try {
      const res = await fetch(`${apiBase}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, new_password: password }),
      })
      if (!res.ok) throw new Error('reset failed')
      resetStatus.textContent = 'Пароль обновлен. Теперь можно войти.'
    } catch (e) {
      resetStatus.textContent = 'Не удалось сбросить пароль. Проверьте токен.'
    }
  })
}
