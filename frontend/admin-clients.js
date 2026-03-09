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
const clientWalletOps = document.getElementById('client-wallet-ops')
const clientAccounts = document.getElementById('client-accounts')
const clientProfile = document.getElementById('client-profile')
const feeMeta = document.getElementById('fee-meta')
const feeGoogle = document.getElementById('fee-google')
const feeYandex = document.getElementById('fee-yandex')
const feeTiktok = document.getElementById('fee-tiktok')
const feeTelegram = document.getElementById('fee-telegram')
const feeMonochrome = document.getElementById('fee-monochrome')
const feesSave = document.getElementById('fees-save')
const feesStatus = document.getElementById('fees-status')
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
      const completedTotal = Number(row.completed_total_kzt ?? row.completed_total ?? 0)
      return `
        <tr>
          <td>${row.email || '—'}</td>
          <td>${pending ? `<span class="dot">${pending}</span>` : '—'}</td>
          <td>${completedTotal ? `${formatMoney(completedTotal)} KZT` : '—'}</td>
          <td style="text-align:right;">
            <button class="btn ghost small" data-client="${row.id}" data-email="${row.email}" data-completed-kzt="${completedTotal}">Открыть</button>
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
    const completedKzt = btn.dataset.completedKzt ? Number(btn.dataset.completedKzt) : null
    await openClientModal(userId, email, completedKzt)
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

async function openClientModal(userId, email, completedTotalKzt = null) {
  if (!clientModal || !clientTitle) return
  clientTitle.textContent = email || 'Клиент'
  const [requests, topups, walletOps, accounts, profile, fees] = await Promise.all([
    fetchClientRequests(userId),
    fetchClientTopups(userId),
    fetchClientWalletTransactions(userId),
    fetchClientAccounts(userId),
    fetchClientProfile(userId),
    fetchClientFees(userId),
  ])
  renderClientSummary(userId, email, requests, topups, accounts, profile, completedTotalKzt)
  renderClientRequests(requests)
  renderClientTopups(topups)
  renderClientWalletOps(walletOps)
  renderClientAccounts(accounts)
  renderClientProfile(profile)
  renderClientFees(fees)
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

async function fetchClientWalletTransactions(userId) {
  const res = await fetch(`${apiBase}/admin/clients/${userId}/wallet-transactions`, { headers: authHeadersSafe() })
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

async function fetchClientFees(userId) {
  const res = await fetch(`${apiBase}/admin/users/${userId}/fees`, { headers: authHeadersSafe() })
  if (handleAuthFailure(res)) return null
  if (!res.ok) return null
  return res.json()
}

function getTopupAccountAmount(row) {
  if (row?.amount_account != null) return Number(row.amount_account)
  return row?.amount_net != null ? Number(row.amount_net) : Number(row?.amount_input || 0)
}

function getTopupAccountAmountKzt(row) {
  if (row?.amount_account_kzt != null) return Number(row.amount_account_kzt)
  const accountCurrency = String(row?.account_currency || row?.currency || 'USD').toUpperCase()
  const amount = getTopupAccountAmount(row)
  if (!Number.isFinite(amount)) return 0
  if (accountCurrency === 'KZT') return amount
  if (accountCurrency === 'USD' && Number(row?.fx_rate || 0) > 0) return amount * Number(row.fx_rate)
  return 0
}

function renderClientSummary(userId, email, requests, topups, accounts, profile, completedTotalKzt = null) {
  if (!clientSummary) return
  const pendingCount = Array.isArray(requests) ? requests.length : 0
  const calculatedTotal = Array.isArray(topups)
    ? topups.reduce((sum, row) => {
        const value = getTopupAccountAmountKzt(row)
        return sum + Number(value || 0)
      }, 0)
    : 0
  const completedTotal = Number.isFinite(Number(completedTotalKzt)) ? Number(completedTotalKzt) : calculatedTotal
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
      <h3>${completedTotal ? `${formatMoney(completedTotal)} KZT` : '—'}</h3>
      <p class="muted small">Факт перевода в аккаунты, в KZT</p>
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
            <button class="btn ghost small" data-action="reject" data-topup="${row.id}">Отклонить</button>
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
      const accountAmount = getTopupAccountAmount(row)
      return `
        <tr>
          <td>${formatDate(row.created_at)}</td>
          <td>${row.account_platform || '—'}</td>
          <td>${row.account_name || '—'}</td>
          <td>${formatMoney(row.amount_input)} ${row.currency || ''}</td>
          <td>${row.fx_rate ?? '—'}</td>
          <td>${accountAmount == null ? '—' : `${formatMoney(accountAmount)} ${accountCurrency}`}</td>
          <td>${row.status || '—'}</td>
        </tr>
      `
    })
    .join('')
}

function walletTypeLabel(value) {
  const key = String(value || '')
  if (key === 'adjustment') return 'Ручная корректировка'
  if (key === 'topup_hold') return 'Холд пополнения'
  if (key === 'topup_hold_release') return 'Возврат холда'
  if (key === 'topup') return 'Списание пополнения'
  return key || '—'
}

function renderClientWalletOps(rows) {
  if (!clientWalletOps) return
  if (!rows || rows.length === 0) {
    clientWalletOps.innerHTML = `<tr><td colspan="7" class="muted">Нет операций по балансу.</td></tr>`
    return
  }
  clientWalletOps.innerHTML = rows
    .map((row) => {
      const amount = Number(row.amount || 0)
      const amountText = `${formatMoney(amount)} ${row.currency || ''}`
      const amountUsdText = row.amount_usd == null ? '—' : `${formatMoney(Number(row.amount_usd || 0))} USD`
      return `
        <tr>
          <td>${formatDate(row.created_at)}</td>
          <td>${walletTypeLabel(row.type)}</td>
          <td>${row.account_platform || '—'}</td>
          <td>${row.account_name || '—'}</td>
          <td>${amountText}</td>
          <td>${amountUsdText}</td>
          <td>${row.note || '—'}</td>
        </tr>
      `
    })
    .join('')
}

function formatLiveBillingCell(liveBilling, fallbackCurrency) {
  if (!liveBilling) return '—'
  if (liveBilling.error) return '<span class="muted small">Ошибка API</span>'
  const currency = liveBilling.currency || fallbackCurrency || ''
  const spend = liveBilling.spend
  if (spend == null) return '<span class="muted small">Нет данных</span>'
  return `${formatMoney(spend)} ${currency}`
}

function renderClientAccounts(rows) {
  if (!clientAccounts) return
  if (!rows || rows.length === 0) {
    clientAccounts.innerHTML = `<tr><td colspan="6" class="muted">Нет аккаунтов.</td></tr>`
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
          <td>${formatLiveBillingCell(row.live_billing, row.currency)}</td>
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

function renderClientFees(fees) {
  if (!fees) return
  if (feeMeta) feeMeta.value = fees.meta ?? ''
  if (feeGoogle) feeGoogle.value = fees.google ?? ''
  if (feeYandex) feeYandex.value = fees.yandex ?? ''
  if (feeTiktok) feeTiktok.value = fees.tiktok ?? ''
  if (feeTelegram) feeTelegram.value = fees.telegram ?? ''
  if (feeMonochrome) feeMonochrome.value = fees.monochrome ?? ''
  if (feesStatus) feesStatus.textContent = ''
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
      } else if (action === 'reject') {
        const ok = window.confirm('Отклонить заявку на пополнение? Средства в холде будут возвращены в кошелек клиента.')
        if (!ok) return
        const res = await fetch(`${apiBase}/admin/topups/${topupId}/status?status=failed`, {
          method: 'POST',
          headers: authHeadersSafe(),
        })
        if (handleAuthFailure(res)) return
        if (!res.ok) throw new Error('reject failed')
      }
      const userId = clientSummary?.dataset.userId
      const email = clientTitle?.textContent || ''
      if (userId) {
        const row = cachedClients.find((item) => String(item.id) === String(userId))
        const completedKzt = row ? Number(row.completed_total_kzt ?? row.completed_total ?? 0) : null
        await openClientModal(userId, email, completedKzt)
      }
    } catch (e) {
      if (clientsStatus) clientsStatus.textContent = 'Ошибка обновления заявки.'
    }
  })
}

if (feesSave) {
  feesSave.addEventListener('click', async () => {
    const userId = clientSummary?.dataset.userId
    if (!userId) return
    const payload = {
      meta: feeMeta?.value ? Number(feeMeta.value) : null,
      google: feeGoogle?.value ? Number(feeGoogle.value) : null,
      yandex: feeYandex?.value ? Number(feeYandex.value) : null,
      tiktok: feeTiktok?.value ? Number(feeTiktok.value) : null,
      telegram: feeTelegram?.value ? Number(feeTelegram.value) : null,
      monochrome: feeMonochrome?.value ? Number(feeMonochrome.value) : null,
    }
    try {
      const res = await fetch(`${apiBase}/admin/users/${userId}/fees`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeadersSafe() },
        body: JSON.stringify(payload),
      })
      if (handleAuthFailure(res)) return
      if (!res.ok) throw new Error('fees update failed')
      const data = await res.json()
      renderClientFees(data)
      if (feesStatus) feesStatus.textContent = 'Комиссии сохранены.'
    } catch (e) {
      if (feesStatus) feesStatus.textContent = 'Ошибка сохранения комиссий.'
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
