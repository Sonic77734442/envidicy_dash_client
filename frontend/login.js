const loginForm = document.getElementById('login-form')
const setPasswordForm = document.getElementById('set-password-form')
const statusEl = document.getElementById('login-status')
const loginModeBtn = document.getElementById('login-mode-btn')
const setPasswordModeBtn = document.getElementById('set-password-mode-btn')
const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

function setMode(mode) {
  const loginActive = mode !== 'set-password'
  if (loginForm) loginForm.hidden = !loginActive
  if (setPasswordForm) setPasswordForm.hidden = loginActive
  if (loginModeBtn) loginModeBtn.classList.toggle('active', loginActive)
  if (setPasswordModeBtn) setPasswordModeBtn.classList.toggle('active', !loginActive)
  if (statusEl) {
    statusEl.textContent = loginActive
      ? '??????? ????? ? ??????, ????? ??????????.'
      : '??????? ?????????????? email ? ??????? ????? ??????.'
  }
}

if (loginModeBtn) loginModeBtn.addEventListener('click', () => setMode('login'))
if (setPasswordModeBtn) setPasswordModeBtn.addEventListener('click', () => setMode('set-password'))

if (loginForm && statusEl) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const email = document.getElementById('login-email')?.value?.trim()
    const password = document.getElementById('login-password')?.value?.trim()

    if (!email || !password) {
      statusEl.textContent = '?????????, ??? ????????? ????? ? ??????.'
      return
    }

    statusEl.textContent = '????????? ??????...'
    try {
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
      statusEl.textContent = '???? ????????. ?????????????? ? ??????...'
      window.location.href = '/plan'
    } catch (e) {
      statusEl.textContent = e?.message || '?? ??????? ?????. ????????? ????? ? ??????.'
    }
  })
}

if (setPasswordForm && statusEl) {
  setPasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const email = document.getElementById('set-password-email')?.value?.trim()
    const next = document.getElementById('set-password-new')?.value?.trim()
    const confirm = document.getElementById('set-password-confirm')?.value?.trim()

    if (!email || !next) {
      statusEl.textContent = '????????? email ? ????? ??????.'
      return
    }
    if (next !== confirm) {
      statusEl.textContent = '?????? ?? ?????????.'
      return
    }

    statusEl.textContent = '????????? ??????...'
    try {
      const res = await fetch(`${apiBase}/auth/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, new_password: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'set-password failed')
      statusEl.textContent = '?????? ????????. ?????? ????? ?????.'
      setMode('login')
      const loginEmail = document.getElementById('login-email')
      if (loginEmail) loginEmail.value = email
      if (setPasswordForm) setPasswordForm.reset()
    } catch (e) {
      statusEl.textContent = e?.message || '?? ??????? ?????? ??????.'
    }
  })
}

setMode('login')
