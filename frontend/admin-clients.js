const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

renderHeader({
  eyebrow: 'Envidicy · Admin',
  title: 'Клиенты',
  subtitle: 'Заявки, подтверждённые пополнения и аккаунты клиентов.',
  buttons: [],
})

const clientsBody = document.getElementById('admin-clients')
const clientsStatus = document.getElementById('admin-clients-status')
const clientModal = document.getElementById('client-modal')
const clientTitle = document.getElementById('client-title')
const clientClose = document.getElementById('client-close')
const clientSummary = document.getElementById('client-summary')
const clientRequests = document.getElementById('client-requests')
const clientTopups = document.getElementById('client-topups')
const clientAccounts = document.getElementById('client-accounts')
const clientProfile = document.getElementById('client-profile')
const tabButtons = Array.from(document.querySelectorAll('.tab-button'))
const tabPanels = Array.from(document.querySelectorAll('.tab-panel'))
let cachedClients = []

function authHeadersSafe() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handleAuthFailure(res) {
  if (res.status === 401 || res.status === 403) {
    if (clientsStatus) clientsStatus.textContent = 'Нет доступа к админке.'
    return true
  }
  return false
}

async function fetchClients() {
  try {
    const res = await fetch(`${apiBase}/admin/clients`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load clients')
    const data = await res.json()
    cachedClients = data
    renderClients(data)
  } catch (e) {
    if (clientsStatus) clientsStatus.textContent = 'Ошибка загрузки клиентов.'
  }
}

function renderClients(rows) {
  if (!clientsBody) return
  clientsBody.innerHTML = rows
    .map((row) => {
      const pending = Number(row.pending_requests || 0)
      const completedTotal = Number(row.completed_total || 0)
      return `
        <tr>
          <td>${row.email || '—'}</td>
          <td>${pending ? `<span class="dot">${pending}</span>` : '—'}</td>
          <td>${completedTotal ? formatMoney(completedTotal) : '—'}</td>
          <td style="text-align:right;">
            <button class="btn ghost small" data-client="${row.id}" data-email="${row.email}">Открыть</button>
          </td>
        </tr>
      `
    })
    .join('')
}

if (clientsBody) {
  clientsBody.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-client]')
    if (!btn) return
    const userId = btn.dataset.client
    const email = btn.dataset.email
    await openClientModal(userId, email)
  })
}

if (clientClose) {
  clientClose.addEventListener('click', () => {
    clientModal?.classList.remove('show')
  })
}

if (clientModal) {
  clientModal.addEventListener('click', (event) => {
    if (event.target === clientModal) clientModal.classList.remove('show')
  })
}

async function openClientModal(userId, email) {
  if (!clientModal || !clientTitle) return
  clientTitle.textContent = email || 'Клиент'
  const [requests, topups, accounts, profile] = await Promise.all([
    fetchClientRequests(userId),
    fetchClientTopups(userId),
    fetchClientAccounts(userId),
    fetchClientProfile(userId),
  ])
  renderClientSummary(userId, email, requests, topups, accounts, profile)
  renderClientRequests(requests)
  renderClientTopups(topups)
  renderClientAccounts(accounts)
  renderClientProfile(profile)
  setActiveTab('requests')
  clientModal.classList.add('show')
  await fetch(`${apiBase}/admin/clients/${userId}/mark-seen`, { method: 'POST', headers: authHeadersSafe() })
  await fetchClients()
}

async function fetchClientRequests(userId) {
  const res = await fetch(`${apiBase}/admin/clients/${userId}/requests`, { headers: authHeadersSafe() })
  if (handleAuthFailure(res)) return []
  if (!res.ok) return []
  return res.json()
}

async function fetchClientTopups(userId) {
  const res = await fetch(`${apiBase}/admin/clients/${userId}/topups`, { headers: authHeadersSafe() })
  if (handleAuthFailure(res)) return []
  if (!res.ok) return []
  return res.json()
}

async function fetchClientAccounts(userId) {
  const res = await fetch(`${apiBase}/admin/clients/${userId}/accounts`, { headers: authHeadersSafe() })
  if (handleAuthFailure(res)) return []
  if (!res.ok) return []
  return res.json()
}

async function fetchClientProfile(userId) {
  const res = await fetch(`${apiBase}/admin/clients/${userId}/profile`, { headers: authHeadersSafe() })
  if (handleAuthFailure(res)) return null
  if (!res.ok) return null
  return res.json()
}

function renderClientSummary(userId, email, requests, topups, accounts, profile) {
  if (!clientSummary) return
  const pendingCount = Array.isArray(requests) ? requests.length : 0
  const completedTotal = Array.isArray(topups)
    ? topups.reduce((sum, row) => sum + Number(row.amount_net || 0), 0)
    : 0
  const accountsCount = Array.isArray(accounts) ? accounts.length : 0
  const company = profile?.company || '—'
  clientSummary.innerHTML = `
    <div class="stat">
      <p class="muted">Клиент</p>
      <h3>${email || '—'}</h3>
      <p class="muted small">${company}</p>
    </div>
    <div class="stat">
      <p class="muted">Заявки</p>
      <h3>${pendingCount}</h3>
      <p class="muted small">Ожидают подтверждения</p>
    </div>
    <div class="stat">
      <p class="muted">Пополнено</p>
      <h3>${completedTotal ? formatMoney(completedTotal) : '—'}</h3>
      <p class="muted small">По подтверждённым операциям</p>
    </div>
    <div class="stat">
      <p class="muted">Аккаунты</p>
      <h3>${accountsCount}</h3>
      <p class="muted small">Доступные кабинеты</p>
    </div>
  `
  clientSummary.dataset.userId = String(userId)
}

function renderClientRequests(rows) {
  if (!clientRequests) return
  if (!rows || rows.length === 0) {
    clientRequests.innerHTML = `<tr><td colspan="8" class="muted">Нет заявок.</td></tr>`
    return
  }
  clientRequests.innerHTML = rows
    .map((row) => {
      const accountCurrency = row.account_currency || 'USD'
      const amountNet = row.amount_net != null ? Number(row.amount_net) : ''
      const fxRate = row.fx_rate != null ? Number(row.fx_rate) : ''
      return `
        <tr>
          <td>${formatDate(row.created_at)}</td>
          <td>${row.account_platform || '—'}</td>
          <td>${row.account_name || '—'}</td>
          <td>${formatMoney(row.amount_input)} ${row.currency || ''}</td>
          <td>
            <input class="field-input small" type="number" step="0.0001" data-fx="${row.id}" value="${fxRate}">
          </td>
          <td>
            <input class="field-input small" type="number" step="0.01" data-net="${row.id}" value="${amountNet}"> ${accountCurrency}
          </td>
          <td>${row.status || '—'}</td>
          <td style="text-align:right;">
            <button class="btn ghost small" data-action="save" data-topup="${row.id}">Сохранить</button>
            <button class="btn primary small" data-action="complete" data-topup="${row.id}">Подтвердить</button>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderClientTopups(rows) {
  if (!clientTopups) return
  if (!rows || rows.length === 0) {
    clientTopups.innerHTML = `<tr><td colspan="7" class="muted">Нет подтверждённых пополнений.</td></tr>`
    return
  }
  clientTopups.innerHTML = rows
    .map((row) => {
      const accountCurrency = row.account_currency || 'USD'
      return `
        <tr>
          <td>${formatDate(row.created_at)}</td>
          <td>${row.account_platform || '—'}</td>
          <td>${row.account_name || '—'}</td>
          <td>${formatMoney(row.amount_input)} ${row.currency || ''}</td>
          <td>${row.fx_rate ?? '—'}</td>
          <td>${formatMoney(row.amount_net)} ${accountCurrency}</td>
          <td>${row.status || '—'}</td>
        </tr>
      `
    })
    .join('')
}

function renderClientAccounts(rows) {
  if (!clientAccounts) return
  if (!rows || rows.length === 0) {
    clientAccounts.innerHTML = `<tr><td colspan="5" class="muted">Нет аккаунтов.</td></tr>`
    return
  }
  clientAccounts.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.platform || '—'}</td>
          <td>${row.name || '—'}</td>
          <td>${row.account_code || '—'}</td>
          <td>${row.currency || '—'}</td>
          <td>${row.budget_total != null ? `${formatMoney(row.budget_total)} ${row.currency || ''}` : '—'}</td>
        </tr>
      `
    )
    .join('')
}

function renderClientProfile(profile) {
  if (!clientProfile) return
  if (!profile) {
    clientProfile.innerHTML = `<div class="details-section"><p class="muted">Нет данных профиля.</p></div>`
    return
  }
  clientProfile.innerHTML = `
    <div class="details-section">
      <h4>Контакты</h4>
      <div class="details-row"><span class="details-label">Email</span><span>${profile.email || '—'}</span></div>
      <div class="details-row"><span class="details-label">Телефон</span><span>${profile.whatsapp_phone || '—'}</span></div>
      <div class="details-row"><span class="details-label">Telegram</span><span>${profile.telegram_handle || '—'}</span></div>
    </div>
    <div class="details-section">
      <h4>Данные</h4>
      <div class="details-row"><span class="details-label">Имя</span><span>${profile.name || '—'}</span></div>
      <div class="details-row"><span class="details-label">Компания</span><span>${profile.company || '—'}</span></div>
      <div class="details-row"><span class="details-label">Язык</span><span>${profile.language || 'ru'}</span></div>
    </div>
  `
}

function setActiveTab(tabId) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId)
  })
  tabPanels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === tabId)
  })
}

if (tabButtons.length) {
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab))
  })
}

if (clientRequests) {
  clientRequests.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-topup]')
    if (!btn) return
    const action = btn.dataset.action
    const topupId = btn.dataset.topup
    const fxInput = clientRequests.querySelector(`input[data-fx="${topupId}"]`)
    const netInput = clientRequests.querySelector(`input[data-net="${topupId}"]`)
    const fxRate = fxInput?.value ? Number(fxInput.value) : null
    const amountNet = netInput?.value ? Number(netInput.value) : null
    try {
      if (fxRate !== null || amountNet !== null) {
        const res = await fetch(`${apiBase}/admin/topups/${topupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeadersSafe() },
          body: JSON.stringify({ fx_rate: fxRate, amount_net: amountNet }),
        })
        if (handleAuthFailure(res)) return
        if (!res.ok) throw new Error('update failed')
      }
      if (action === 'complete') {
        const res = await fetch(`${apiBase}/admin/topups/${topupId}/status?status=completed`, {
          method: 'POST',
          headers: authHeadersSafe(),
        })
        if (handleAuthFailure(res)) return
        if (!res.ok) throw new Error('complete failed')
      }
      const userId = clientSummary?.dataset.userId
      const email = clientTitle?.textContent || ''
      if (userId) await openClientModal(userId, email)
    } catch (e) {
      if (clientsStatus) clientsStatus.textContent = 'Ошибка обновления заявки.'
    }
  })
}

function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value) {
  if (!value) return '—'
  const str = String(value)
  if (str.includes('T')) return str.split('T')[0]
  return str.split(' ')[0]
}

fetchClients()
