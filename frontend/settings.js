const apiBase = window.API_BASE || 'http://127.0.0.1:8000'

renderHeader({
  eyebrow: 'Envidicy · Profile',
  title: 'Настройки',
  subtitle: 'Управляйте данными, безопасностью и документами.',
  buttons: [],
})

const tabs = document.querySelectorAll('.tab-button')
const panels = document.querySelectorAll('.tab-panel')

const profile = {
  name: document.getElementById('profile-name'),
  company: document.getElementById('profile-company'),
  email: document.getElementById('profile-email'),
  language: document.getElementById('profile-language'),
  whatsapp: document.getElementById('profile-whatsapp'),
  telegram: document.getElementById('profile-telegram'),
  save: document.getElementById('profile-save'),
  status: document.getElementById('profile-status'),
}

const password = {
  current: document.getElementById('password-current'),
  next: document.getElementById('password-new'),
  confirm: document.getElementById('password-confirm'),
  save: document.getElementById('password-save'),
  status: document.getElementById('password-status'),
}

const docs = {
  body: document.getElementById('docs-body'),
  empty: document.getElementById('docs-empty'),
}

const feesBody = document.getElementById('fees-body')

function authHeaders() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function activateTab(name) {
  tabs.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name)
  })
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.tabPanel === name)
  })
}

tabs.forEach((btn) => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab))
})

async function loadProfile() {
  try {
    const res = await fetch(`${apiBase}/profile`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = './login.html'
      return
    }
    if (!res.ok) throw new Error('profile failed')
    const data = await res.json()
    if (profile.name) profile.name.value = data.name || ''
    if (profile.company) profile.company.value = data.company || ''
    if (profile.email) profile.email.value = data.email || ''
    if (profile.language) profile.language.value = data.language || 'ru'
    if (profile.whatsapp) profile.whatsapp.value = data.whatsapp_phone || ''
    if (profile.telegram) profile.telegram.value = data.telegram_handle || ''
  } catch (e) {
    if (profile.status) profile.status.textContent = 'Не удалось загрузить профиль.'
  }
}

async function saveProfile() {
  if (profile.status) profile.status.textContent = 'Сохраняем...'
  const payload = {
    name: profile.name?.value?.trim() || null,
    company: profile.company?.value?.trim() || null,
    language: profile.language?.value || 'ru',
    whatsapp_phone: profile.whatsapp?.value?.trim() || null,
    telegram_handle: profile.telegram?.value?.trim() || null,
  }
  try {
    const res = await fetch(`${apiBase}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (res.status === 401) {
      window.location.href = './login.html'
      return
    }
    if (!res.ok) throw new Error('save failed')
    if (profile.status) profile.status.textContent = 'Профиль обновлен.'
  } catch (e) {
    if (profile.status) profile.status.textContent = 'Не удалось сохранить изменения.'
  }
}

async function changePassword() {
  const current = password.current?.value?.trim()
  const next = password.next?.value?.trim()
  const confirm = password.confirm?.value?.trim()
  if (!current || !next) {
    if (password.status) password.status.textContent = 'Заполните текущий и новый пароль.'
    return
  }
  if (next !== confirm) {
    if (password.status) password.status.textContent = 'Пароли не совпадают.'
    return
  }
  if (password.status) password.status.textContent = 'Обновляем пароль...'
  try {
    const res = await fetch(`${apiBase}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ current_password: current, new_password: next }),
    })
    if (res.status === 401) {
      window.location.href = './login.html'
      return
    }
    if (!res.ok) throw new Error('change failed')
    const data = await res.json()
    if (data?.token) localStorage.setItem('auth_token', data.token)
    if (password.status) password.status.textContent = 'Пароль обновлен.'
    if (password.current) password.current.value = ''
    if (password.next) password.next.value = ''
    if (password.confirm) password.confirm.value = ''
  } catch (e) {
    if (password.status) password.status.textContent = 'Не удалось обновить пароль.'
  }
}

function renderFees() {
  if (!feesBody) return
  const rows = [
    { platform: 'Meta', fee: '10%', note: 'Facebook / Instagram' },
    { platform: 'Google Ads', fee: '10%', note: 'Search / Display / YouTube' },
    { platform: 'TikTok Ads', fee: '10%', note: 'Video' },
    { platform: 'Яндекс Директ', fee: '10%', note: 'Поиск / РСЯ' },
    { platform: 'Telegram Ads', fee: '10%', note: 'Channels / Bots' },
    { platform: 'Monochrome', fee: '10%', note: 'Programmatic' },
  ]
  feesBody.innerHTML = rows
    .map(
      (r) => `
    <tr>
      <td>${r.platform}</td>
      <td>${r.fee}</td>
      <td>${r.note}</td>
    </tr>
  `
    )
    .join('')
}

async function loadDocuments() {
  try {
    const res = await fetch(`${apiBase}/documents`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = './login.html'
      return
    }
    if (!res.ok) throw new Error('docs failed')
    const data = await res.json()
    if (!docs.body) return
    if (!data.length) {
      if (docs.empty) docs.empty.hidden = false
      docs.body.innerHTML = ''
      return
    }
    if (docs.empty) docs.empty.hidden = true
    const token = localStorage.getItem('auth_token')
    docs.body.innerHTML = data
      .map(
        (row) => `
      <tr>
        <td>${row.title}</td>
        <td>${row.created_at?.split(' ')[0] || '—'}</td>
        <td style="text-align:right;">
          <a class="btn ghost small" href="${apiBase}/documents/${row.id}${token ? `?token=${encodeURIComponent(token)}` : ''}" target="_blank" rel="noopener">Скачать</a>
        </td>
      </tr>
    `
      )
      .join('')
  } catch (e) {
    if (docs.empty) {
      docs.empty.hidden = false
      docs.empty.textContent = 'Не удалось загрузить документы.'
    }
  }
}

function init() {
  activateTab('profile')
  renderFees()
  loadProfile()
  loadDocuments()
  if (profile.save) profile.save.addEventListener('click', saveProfile)
  if (password.save) password.save.addEventListener('click', changePassword)
}

init()
