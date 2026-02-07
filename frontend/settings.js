const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

renderHeader({
  eyebrow: 'Envidicy � Profile',
  title: '���������',
  subtitle: '���������� �������, ������������� � �����������.',
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
    if (profile.avatarPreview) {
      if (data.avatar_url) {
        profile.avatarPreview.innerHTML = `<img src="${apiBase}${data.avatar_url}" alt="avatar" />`
      } else {
        const letter = (data.email || 'U').trim().charAt(0).toUpperCase()
        profile.avatarPreview.textContent = letter || '?'
      }
    }
  } catch (e) {
    if (profile.status) profile.status.textContent = '�� ������� ��������� �������.'
  }
}

async function uploadAvatar() {
  const file = profile.avatarFile?.files?.[0]
  if (!file) {
    if (profile.avatarStatus) profile.avatarStatus.textContent = '�������� ����.'
    return
  }
  if (profile.avatarStatus) profile.avatarStatus.textContent = '���������...'
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
    if (profile.avatarStatus) profile.avatarStatus.textContent = '���� ���������.'
  } catch (e) {
    if (profile.avatarStatus) profile.avatarStatus.textContent = '�� ������� ��������� ����.'
  }
}

async function saveProfile() {
  if (profile.status) profile.status.textContent = '���������...'
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
    if (profile.status) profile.status.textContent = '������� ��������.'
  } catch (e) {
    if (profile.status) profile.status.textContent = '�� ������� ��������� ���������.'
  }
}

async function changePassword() {
  const current = password.current?.value?.trim()
  const next = password.next?.value?.trim()
  const confirm = password.confirm?.value?.trim()
  if (!current || !next) {
    if (password.status) password.status.textContent = '��������� ������� � ����� ������.'
    return
  }
  if (next !== confirm) {
    if (password.status) password.status.textContent = '������ �� ���������.'
    return
  }
  if (password.status) password.status.textContent = '��������� ������...'
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
    if (data?.token) localStorage.setItem('auth_token', data.token)
    if (password.status) password.status.textContent = '������ ��������.'
    if (password.current) password.current.value = ''
    if (password.next) password.next.value = ''
    if (password.confirm) password.confirm.value = ''
  } catch (e) {
    if (password.status) password.status.textContent = '�� ������� �������� ������.'
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
      { key: 'yandex', platform: '?????? ??????', note: '????? / ???' },
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
    const token = localStorage.getItem('auth_token')
    docs.body.innerHTML = data
      .map(
        (row) => `
      <tr>
        <td>${row.title}</td>
        <td>${row.created_at?.split(' ')[0] || '�'}</td>
        <td style="text-align:right;">
          <a class="btn ghost small" href="${apiBase}/documents/${row.id}${token ? `?token=${encodeURIComponent(token)}` : ''}" target="_blank" rel="noopener">�������</a>
        </td>
      </tr>
    `
      )
      .join('')
  } catch (e) {
    if (docs.empty) {
      docs.empty.hidden = false
      docs.empty.textContent = '�� ������� ��������� ���������.'
    }
  }
}

function init() {
  activateTab('profile')
  renderFees()
  loadProfile()
  loadDocuments()
  if (profile.save) profile.save.addEventListener('click', saveProfile)
  if (profile.avatarUpload) profile.avatarUpload.addEventListener('click', uploadAvatar)
  if (password.save) password.save.addEventListener('click', changePassword)
}

init()




