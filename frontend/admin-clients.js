const apiBase = 'http://127.0.0.1:8000'

renderHeader({
  eyebrow: 'Envidicy · Admin',
  title: 'Клиенты',
  subtitle: 'Распределения по аккаунтам и новые уведомления.',
  buttons: [],
})

const clientsBody = document.getElementById('admin-clients')
const clientsStatus = document.getElementById('admin-clients-status')
const clientModal = document.getElementById('client-modal')
const clientTitle = document.getElementById('client-title')
const clientClose = document.getElementById('client-close')
const clientAllocations = document.getElementById('client-allocations')

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
    renderClients(data)
  } catch (e) {
    if (clientsStatus) clientsStatus.textContent = 'Ошибка загрузки клиентов.'
  }
}

function renderClients(rows) {
  if (!clientsBody) return
  clientsBody.innerHTML = rows
    .map((row) => {
      const unread = Number(row.unread_topups || 0)
      return `
        <tr>
          <td>${row.email || '—'}</td>
          <td>${unread ? `<span class="dot">${unread}</span>` : '—'}</td>
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
  if (!clientModal || !clientAllocations || !clientTitle) return
  clientTitle.textContent = email || 'Клиент'
  const res = await fetch(`${apiBase}/admin/clients/${userId}/allocations`, { headers: authHeadersSafe() })
  if (handleAuthFailure(res)) return
  if (!res.ok) {
    if (clientsStatus) clientsStatus.textContent = 'Ошибка загрузки распределений.'
    return
  }
  const data = await res.json()
  clientAllocations.innerHTML = data
    .map(
      (row) => `
      <tr>
        <td>${row.created_at?.split(' ')[0] || '—'}</td>
        <td>${row.account_platform || '—'}</td>
        <td>${row.account_name || '—'}</td>
        <td>${formatMoney(row.amount_input)} ${row.currency || ''}</td>
        <td>${row.status || '—'}</td>
      </tr>
    `
    )
    .join('')
  clientModal.classList.add('show')
  await fetch(`${apiBase}/admin/clients/${userId}/mark-seen`, {
    method: 'POST',
    headers: authHeadersSafe(),
  })
  await fetchClients()
}

function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

fetchClients()
