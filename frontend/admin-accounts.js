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
        <td style="text-align:right;">
          <button class="btn ghost small" data-edit="1"
            data-id="${row.id}"
            data-user-id="${row.user_id}"
            data-platform="${row.platform || ''}"
            data-name="${row.name || ''}"
            data-external="${row.external_id || ''}"
            data-code="${row.account_code || ''}"
            data-currency="${row.currency || ''}"
            data-status="${row.status || ''}"
          >Редактировать</button>
        </td>
      </tr>
    `
    )
    .join('')
}

async function fetchClients() {
  if (!accountUser) return
  try {
    const res = await fetch(`${apiBase}/admin/clients`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load clients')
    const data = await res.json()
    accountUser.innerHTML = data
      .map((row) => `<option value="${row.id}">${row.email}</option>`)
      .join('')
  } catch (e) {
    if (bindStatus) bindStatus.textContent = 'Ошибка загрузки клиентов.'
  }
}

function resetBindForm() {
  if (accountIdInput) accountIdInput.value = ''
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
    const btn = event.target.closest('button[data-edit]')
    if (!btn) return
    if (accountIdInput) accountIdInput.value = btn.dataset.id || ''
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

