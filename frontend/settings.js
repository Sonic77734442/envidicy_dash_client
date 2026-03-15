const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

renderHeader({
  eyebrow: 'Envidicy ? Profile',
  title: '?????????',
  subtitle: '?????????? ???????, ????????????? ? ???????????.',
  buttons: [],
})

const tabs = document.querySelectorAll('.tab-button')
const panels = document.querySelectorAll('.tab-panel')
const accessesTabButton = document.getElementById('accesses-tab-button')
const accessesPanel = document.querySelector('[data-tab-panel="accesses"]')

const profile = {
  name: document.getElementById('profile-name'),
  company: document.getElementById('profile-company'),
  email: document.getElementById('profile-email'),
  language: document.getElementById('profile-language'),
  whatsapp: document.getElementById('profile-whatsapp'),
  telegram: document.getElementById('profile-telegram'),
  save: document.getElementById('profile-save'),
  status: document.getElementById('profile-status'),
  avatarPreview: document.getElementById('profile-avatar-preview'),
  avatarFile: document.getElementById('profile-avatar-file'),
  avatarUpload: document.getElementById('profile-avatar-upload'),
  avatarStatus: document.getElementById('profile-avatar-status'),
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

const accesses = {
  email: document.getElementById('access-email'),
  add: document.getElementById('access-add'),
  status: document.getElementById('access-status'),
  body: document.getElementById('accesses-body'),
}

const feesBody = document.getElementById('fees-body')
let canManageAccesses = false
const requestedTab = new URLSearchParams(window.location.search).get('tab') || 'profile'

function authHeaders() {
  const token = typeof getAuthToken === 'function' ? getAuthToken() : localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function activateTab(name) {
  tabs.forEach((btn) => {
    if (btn.hidden) return
    btn.classList.toggle('active', btn.dataset.tab === name)
  })
  panels.forEach((panel) => {
    if (panel.hidden) return
    panel.classList.toggle('active', panel.dataset.tabPanel === name)
  })
}

tabs.forEach((btn) => {
  btn.addEventListener('click', () => {
    if (!btn.hidden) activateTab(btn.dataset.tab)
  })
})

function applyAccessVisibility(enabled) {
  canManageAccesses = Boolean(enabled)
  if (accessesTabButton) accessesTabButton.hidden = !canManageAccesses
  if (accessesPanel) accessesPanel.hidden = !canManageAccesses
  if (!canManageAccesses && accessesTabButton?.classList.contains('active')) {
    activateTab('profile')
  }
}

function renderAccesses(rows) {
  if (!accesses.body) return
  if (!rows || !rows.length) {
    accesses.body.innerHTML = '<tr><td colspan="4" class="muted">?????????????? ???????? ???? ???.</td></tr>'
    return
  }
  accesses.body.innerHTML = rows
    .map((row) => {
      const isOwner = (row.role || 'member') === 'owner'
      const roleLabel = isOwner ? '????????' : '??????????????'
      const statusLabel = row.status === 'active' ? '???????' : row.status || '?'
      const actionHtml = isOwner
        ? '<span class="muted small">?????? ???????</span>'
        : `<button class="btn ghost small" type="button" data-access-delete="${row.id}">???????</button>`
      return `
        <tr>
          <td>${row.email || '?'}</td>
          <td>${roleLabel}</td>
          <td>${statusLabel}</td>
          <td style="text-align:right;">${actionHtml}</td>
        </tr>
      `
    })
    .join('')
}

async function loadAccesses() {
  if (!canManageAccesses) return
  try {
    const res = await fetch(`${apiBase}/profile/accesses`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (res.status === 403) {
      applyAccessVisibility(false)
      return
    }
    if (!res.ok) throw new Error('accesses failed')
    const data = await res.json()
    renderAccesses(data.items || [])
  } catch (e) {
    if (accesses.status) accesses.status.textContent = '?? ??????? ????????? ???????.'
  }
}

async function addAccess() {
  const email = accesses.email?.value?.trim().toLowerCase()
  if (!email) {
    if (accesses.status) accesses.status.textContent = '??????? email.'
    return
  }
  if (accesses.status) accesses.status.textContent = '????????? ??????...'
  try {
    const res = await fetch(`${apiBase}/profile/accesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ email }),
    })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.detail || 'create access failed')
    if (accesses.email) accesses.email.value = ''
    if (accesses.status) accesses.status.textContent = '?????? ????????. ???????????? ????? ?????? ?????? ?? ???????? ?????.'
    await loadAccesses()
  } catch (e) {
    if (accesses.status) accesses.status.textContent = e?.message || '?? ??????? ???????? ??????.'
  }
}

async function deleteAccess(accessId) {
  if (!accessId) return
  if (!confirm('??????? ???? ?????????????? ???????')) return
  if (accesses.status) accesses.status.textContent = '??????? ??????...'
  try {
    const res = await fetch(`${apiBase}/profile/accesses/${accessId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.detail || 'delete access failed')
    if (accesses.status) accesses.status.textContent = '?????? ??????.'
    await loadAccesses()
  } catch (e) {
    if (accesses.status) accesses.status.textContent = e?.message || '?? ??????? ??????? ??????.'
  }
}

async function loadProfile() {
  try {
    const res = await fetch(`${apiBase}/profile`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = '/login'
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
    applyAccessVisibility(Boolean(data.can_manage_accesses))
    if (Boolean(data.can_manage_accesses) && requestedTab === 'accesses') activateTab('accesses')
    if (profile.avatarPreview) {
      if (data.avatar_url) {
        profile.avatarPreview.innerHTML = `<img src="${apiBase}${data.avatar_url}" alt="avatar" />`
      } else {
        const letter = (data.email || 'U').trim().charAt(0).toUpperCase()
        profile.avatarPreview.textContent = letter || '?'
      }
    }
    if (canManageAccesses) await loadAccesses()
  } catch (e) {
    if (profile.status) profile.status.textContent = '?? ??????? ????????? ???????.'
  }
}

async function uploadAvatar() {
  const file = profile.avatarFile?.files?.[0]
  if (!file) {
    if (profile.avatarStatus) profile.avatarStatus.textContent = '???????? ????.'
    return
  }
  if (profile.avatarStatus) profile.avatarStatus.textContent = '?????????...'
  const form = new FormData()
  form.append('file', file)
  try {
    const res = await fetch(`${apiBase}/profile/avatar`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) throw new Error('upload failed')
    const data = await res.json()
    if (profile.avatarPreview && data.avatar_url) {
      profile.avatarPreview.innerHTML = `<img src="${apiBase}${data.avatar_url}" alt="avatar" />`
    }
    if (profile.avatarStatus) profile.avatarStatus.textContent = '???? ?????????.'
  } catch (e) {
    if (profile.avatarStatus) profile.avatarStatus.textContent = '?? ??????? ????????? ????.'
  }
}

async function saveProfile() {
  if (profile.status) profile.status.textContent = '?????????...'
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
      window.location.href = '/login'
      return
    }
    if (!res.ok) throw new Error('save failed')
    if (profile.status) profile.status.textContent = '??????? ????????.'
  } catch (e) {
    if (profile.status) profile.status.textContent = '?? ??????? ????????? ?????????.'
  }
}

async function changePassword() {
  const current = password.current?.value?.trim()
  const next = password.next?.value?.trim()
  const confirm = password.confirm?.value?.trim()
  if (!current || !next) {
    if (password.status) password.status.textContent = '????????? ??????? ? ????? ??????.'
    return
  }
  if (next !== confirm) {
    if (password.status) password.status.textContent = '?????? ?? ?????????.'
    return
  }
  if (password.status) password.status.textContent = '????????? ??????...'
  try {
    const res = await fetch(`${apiBase}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ current_password: current, new_password: next }),
    })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) throw new Error('change failed')
    const data = await res.json()
    if (data?.token) {
      if (typeof setAuthState === 'function') setAuthState({ auth_token: data.token }, typeof isImpersonating === 'function' && isImpersonating() ? 'session' : 'local')
      else localStorage.setItem('auth_token', data.token)
    }
    if (password.status) password.status.textContent = '?????? ????????.'
    if (password.current) password.current.value = ''
    if (password.next) password.next.value = ''
    if (password.confirm) password.confirm.value = ''
  } catch (e) {
    if (password.status) password.status.textContent = '?? ??????? ???????? ??????.'
  }
}

async function renderFees() {
  if (!feesBody) return
  try {
    const res = await fetch(`${apiBase}/fees`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) throw new Error('fees failed')
    const data = await res.json()
    const rows = [
      { key: 'meta', platform: 'Meta', note: 'Facebook / Instagram' },
      { key: 'google', platform: 'Google Ads', note: 'Search / Display / YouTube' },
      { key: 'yandex', platform: '?????? ??????', note: '?????/???' },
      { key: 'tiktok', platform: 'TikTok Ads', note: 'Video' },
      { key: 'telegram', platform: 'Telegram Ads', note: 'Channels / Bots' },
      { key: 'monochrome', platform: 'Monochrome', note: 'Programmatic' },
    ]
    feesBody.innerHTML = rows
      .map((r) => {
        const val = data?.[r.key]
        const label = val == null || val === '' ? '?' : `${Number(val).toFixed(2)}%`
        return `
    <tr>
      <td>${r.platform}</td>
      <td>${label}</td>
      <td>${r.note}</td>
    </tr>
  `
      })
      .join('')
  } catch (e) {
    feesBody.innerHTML = `<tr><td colspan="3" class="muted">?? ??????? ????????? ????????.</td></tr>`
  }
}

async function loadDocuments() {
  try {
    const res = await fetch(`${apiBase}/documents`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = '/login'
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
    const token = typeof getAuthToken === 'function' ? getAuthToken() : localStorage.getItem('auth_token')
    docs.body.innerHTML = data
      .map(
        (row) => `
      <tr>
        <td>${row.title}</td>
        <td>${row.created_at?.split(' ')[0] || '?'}</td>
        <td style="text-align:right;">
          <a class="btn ghost small" href="${apiBase}/documents/${row.id}${token ? `?token=${encodeURIComponent(token)}` : ''}" target="_blank" rel="noopener">???????</a>
        </td>
      </tr>
    `
      )
      .join('')
  } catch (e) {
    if (docs.empty) {
      docs.empty.hidden = false
      docs.empty.textContent = '?? ??????? ????????? ?????????.'
    }
  }
}

function init() {
  applyAccessVisibility(false)
  activateTab(requestedTab)
  renderFees()
  loadProfile()
  loadDocuments()
  if (profile.save) profile.save.addEventListener('click', saveProfile)
  if (profile.avatarUpload) profile.avatarUpload.addEventListener('click', uploadAvatar)
  if (password.save) password.save.addEventListener('click', changePassword)
  if (accesses.add) accesses.add.addEventListener('click', addAccess)
  if (accesses.body) {
    accesses.body.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-access-delete]')
      if (!btn) return
      deleteAccess(btn.dataset.accessDelete)
    })
  }
}

init()
