const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

renderHeader({
  eyebrow: 'Envidicy · Admin',
  title: 'Аккаунты',
  subtitle: 'Список открытых аккаунтов и договоров.',
  buttons: [],
})

const accountsBody = document.getElementById('admin-accounts')
const accountsStatus = document.getElementById('admin-accounts-status')
const exportAccounts = document.getElementById('export-accounts')
const bindForm = document.getElementById('account-bind-form')
const bindStatus = document.getElementById('account-bind-status')
const bindSave = document.getElementById('account-save')
const bindReset = document.getElementById('account-reset')
const accountIdInput = document.getElementById('account-id')
const accountUser = document.getElementById('account-user')
const accountPlatform = document.getElementById('account-platform')
const accountName = document.getElementById('account-name')
const accountExternal = document.getElementById('account-external')
const accountCode = document.getElementById('account-code')
const accountCurrency = document.getElementById('account-currency')
const accountStatus = document.getElementById('account-status')
let cachedAccountUsers = []

function authHeadersSafe() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handleAuthFailure(res) {
  if (res.status === 401 || res.status === 403) {
    if (accountsStatus) accountsStatus.textContent = 'Нет доступа к админке.'
    return true
  }
  return false
}

function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatLiveBillingCell(liveBilling, fallbackCurrency) {
  if (!liveBilling) return '—'
  if (liveBilling.error) return `<span class="muted small" title="${String(liveBilling.error)}">Ошибка API</span>`
  const currency = liveBilling.currency || fallbackCurrency || ''
  const spend = liveBilling.spend
  const limit = liveBilling.limit
  if (spend == null && limit == null) return '<span class="muted small">Нет данных</span>'
  if (spend != null && limit != null) {
    return `${formatMoney(spend)} / ${formatMoney(limit)} ${currency}`
  }
  if (spend != null) return `${formatMoney(spend)} ${currency}`
  return `${formatMoney(limit)} ${currency}`
}

async function fetchAccounts() {
  try {
    const res = await fetch(`${apiBase}/admin/accounts`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load accounts')
    const data = await res.json()
    renderAccounts(data)
  } catch (e) {
    if (accountsStatus) accountsStatus.textContent = 'Ошибка загрузки аккаунтов.'
  }
}

function renderAccounts(rows) {
  if (!accountsBody) return
  accountsBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.created_at?.split(' ')[0] || '—'}</td>
        <td>${row.user_email || '—'}</td>
        <td>${row.platform}</td>
        <td>${row.name}</td>
        <td>${row.account_code || '—'}</td>
        <td>${row.external_id || '—'}</td>
        <td>${formatLiveBillingCell(row.live_billing, row.currency)}</td>
        <td class="account-actions-cell">
          <div class="account-row-actions">
            <button class="btn ghost small" data-edit="1"
              data-id="${row.id}"
              data-user-id="${row.user_id}"
              data-user-email="${row.user_email || ''}"
              data-platform="${row.platform || ''}"
              data-name="${row.name || ''}"
              data-external="${row.external_id || ''}"
              data-code="${row.account_code || ''}"
              data-currency="${row.currency || ''}"
              data-status="${row.status || ''}"
            >Edit</button>
            <button class="btn ghost small" data-delete="1" data-id="${row.id}" data-name="${String(row.name || '').replace(/"/g, '&quot;')}">Del</button>
          </div>
        </td>
      </tr>
    `
    )
    .join('')
}

async function fetchClients() {
  if (!accountUser) return
  try {
    const [clientsRes, usersRes] = await Promise.all([
      fetch(`${apiBase}/admin/clients`, { headers: authHeadersSafe() }),
      fetch(`${apiBase}/admin/users`, { headers: authHeadersSafe() }),
    ])
    if (handleAuthFailure(clientsRes) || handleAuthFailure(usersRes)) return
    if (!clientsRes.ok || !usersRes.ok) throw new Error('Failed to load users')
    const [clients, users] = await Promise.all([clientsRes.json(), usersRes.json()])
    const merged = [...(Array.isArray(clients) ? clients : []), ...(Array.isArray(users) ? users : [])]
    const unique = new Map()
    merged.forEach((row) => {
      if (row?.id != null && row?.email) unique.set(String(row.id), { id: row.id, email: row.email })
    })
    cachedAccountUsers = Array.from(unique.values()).sort((a, b) => String(a.email).localeCompare(String(b.email), 'ru'))
    accountUser.innerHTML = cachedAccountUsers.map((row) => `<option value="${row.id}">${row.email}</option>`).join('')
  } catch (e) {
    if (bindStatus) bindStatus.textContent = 'Ошибка загрузки клиентов.'
  }
}

function ensureAccountUserOption(userId, userEmail) {
  if (!accountUser || !userId) return
  const normalizedId = String(userId)
  const exists = Array.from(accountUser.options).some((option) => option.value === normalizedId)
  if (exists) return
  const option = document.createElement('option')
  option.value = normalizedId
  option.textContent = userEmail || `User #${normalizedId}`
  accountUser.appendChild(option)
}

function resetBindForm() {
  if (accountIdInput) accountIdInput.value = ''
  if (accountUser && accountUser.options.length) accountUser.selectedIndex = 0
  if (accountPlatform) accountPlatform.value = 'meta'
  if (accountName) accountName.value = ''
  if (accountExternal) accountExternal.value = ''
  if (accountCode) accountCode.value = ''
  if (accountCurrency) accountCurrency.value = 'USD'
  if (accountStatus) accountStatus.value = ''
  if (bindStatus) bindStatus.textContent = ''
}

async function saveBindForm() {
  if (!accountUser || !accountPlatform || !accountName) return
  const payload = {
    user_id: Number(accountUser.value),
    platform: accountPlatform.value,
    name: accountName.value.trim(),
    external_id: accountExternal?.value?.trim() || null,
    account_code: accountCode?.value?.trim() || null,
    currency: accountCurrency?.value?.trim() || 'USD',
    status: accountStatus?.value || null,
  }
  if (!payload.name) {
    if (bindStatus) bindStatus.textContent = 'Введите название аккаунта.'
    return
  }
  const accountId = accountIdInput?.value
  const url = accountId ? `${apiBase}/admin/accounts/${accountId}` : `${apiBase}/admin/accounts`
  const method = accountId ? 'PATCH' : 'POST'
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeadersSafe() },
      body: JSON.stringify(payload),
    })
    if (handleAuthFailure(res)) return
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || 'Save failed')
    }
    if (bindStatus) bindStatus.textContent = 'Привязка сохранена.'
    resetBindForm()
    await fetchAccounts()
  } catch (e) {
    if (bindStatus) bindStatus.textContent = 'Ошибка сохранения привязки.'
  }
}

async function deleteAccount(accountId, accountName) {
  if (!accountId) return
  const confirmed = confirm(`Удалить аккаунт "${accountName || '#'+accountId}"?`)
  if (!confirmed) return
  if (accountsStatus) accountsStatus.textContent = 'Удаление аккаунта...'
  try {
    const res = await fetch(`${apiBase}/admin/accounts/${accountId}`, {
      method: 'DELETE',
      headers: authHeadersSafe(),
    })
    if (handleAuthFailure(res)) return
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.detail || 'Delete failed')
    if (accountIdInput?.value === String(accountId)) resetBindForm()
    if (accountsStatus) accountsStatus.textContent = 'Аккаунт удален.'
    await fetchAccounts()
  } catch (e) {
    if (accountsStatus) accountsStatus.textContent = e?.message || 'Не удалось удалить аккаунт.'
  }
}

function exportFile(path) {
  const token = localStorage.getItem('auth_token')
  if (!token) return
  const url = `${apiBase}${path}`
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => res.blob())
    .then((blob) => {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = path.split('/').pop() || 'export.xlsx'
      link.click()
      URL.revokeObjectURL(link.href)
    })
    .catch(() => {})
}

if (exportAccounts) exportAccounts.addEventListener('click', () => exportFile('/admin/export/accounts.xlsx'))

if (bindSave) bindSave.addEventListener('click', saveBindForm)
if (bindReset) bindReset.addEventListener('click', resetBindForm)

if (accountsBody) {
  accountsBody.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('button[data-delete]')
    if (deleteBtn) {
      deleteAccount(deleteBtn.dataset.id, deleteBtn.dataset.name)
      return
    }
    const btn = event.target.closest('button[data-edit]')
    if (!btn) return
    if (accountIdInput) accountIdInput.value = btn.dataset.id || ''
    ensureAccountUserOption(btn.dataset.userId, btn.dataset.userEmail)
    if (accountUser) accountUser.value = btn.dataset.userId || ''
    if (accountPlatform) accountPlatform.value = btn.dataset.platform || 'meta'
    if (accountName) accountName.value = btn.dataset.name || ''
    if (accountExternal) accountExternal.value = btn.dataset.external || ''
    if (accountCode) accountCode.value = btn.dataset.code || ''
    if (accountCurrency) accountCurrency.value = btn.dataset.currency || 'USD'
    if (accountStatus) accountStatus.value = btn.dataset.status || ''
    if (bindStatus) bindStatus.textContent = 'Редактирование привязки.'
  })
}

if (bindForm) {
  bindForm.addEventListener('submit', (event) => {
    event.preventDefault()
    saveBindForm()
  })
}

fetchAccounts()
fetchClients()
