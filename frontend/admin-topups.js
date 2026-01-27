const apiBase = 'http://127.0.0.1:8000'

renderHeader({
  eyebrow: 'Envidicy · Admin',
  title: 'Пополнения',
  subtitle: 'Реестр оплат и статусы.',
  buttons: [],
})

const topupsBody = document.getElementById('admin-topups')
const topupsStatus = document.getElementById('admin-topups-status')
const topupFilterStatus = document.getElementById('topup-filter-status')
const topupFilterEmail = document.getElementById('topup-filter-email')
const exportTopups = document.getElementById('export-topups')
let topupRows = []

function authHeadersSafe() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handleAuthFailure(res) {
  if (res.status === 401 || res.status === 403) {
    if (topupsStatus) topupsStatus.textContent = 'Нет доступа к админке.'
    return true
  }
  return false
}

async function fetchTopups() {
  try {
    const res = await fetch(`${apiBase}/admin/topups`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load topups')
    const data = await res.json()
    topupRows = data
    applyTopupFilters()
  } catch (e) {
    if (topupsStatus) topupsStatus.textContent = 'Ошибка загрузки пополнений.'
  }
}

function applyTopupFilters() {
  let rows = [...topupRows]
  const status = topupFilterStatus?.value || ''
  const email = (topupFilterEmail?.value || '').trim().toLowerCase()
  if (status) rows = rows.filter((row) => row.status === status)
  if (email) rows = rows.filter((row) => (row.user_email || '').toLowerCase().includes(email))
  renderTopups(rows)
}

function renderTopups(rows) {
  if (!topupsBody) return
  topupsBody.innerHTML = rows
    .map((row) => {
      const fee = row.amount_input ? (row.amount_input * (row.fee_percent / 100)) : 0
      const vat = row.amount_input ? (row.amount_input * (row.vat_percent / 100)) : 0
      const gross = row.amount_input + fee + vat
      return `
        <tr>
          <td>${row.created_at?.split(' ')[0] || '—'}</td>
          <td>${row.user_email || '—'}</td>
          <td>${row.account_platform || '—'}</td>
          <td>${row.account_name || '—'}</td>
          <td>${formatMoney(row.amount_input)} ${row.currency || ''}</td>
          <td>${formatMoney(fee)} ${row.currency || ''}</td>
          <td>${formatMoney(gross)} ${row.currency || ''}</td>
          <td>${row.status || '—'}</td>
          <td style="text-align:right;">
            <button class="btn ghost small" data-topup-status="paid" data-topup-id="${row.id}">Оплачен</button>
          </td>
        </tr>
      `
    })
    .join('')
}

if (topupFilterStatus) topupFilterStatus.addEventListener('change', applyTopupFilters)
if (topupFilterEmail) topupFilterEmail.addEventListener('input', applyTopupFilters)

if (topupsBody) {
  topupsBody.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-topup-status]')
    if (!btn) return
    const status = btn.dataset.topupStatus
    const id = btn.dataset.topupId
    try {
      const res = await fetch(`${apiBase}/admin/topups/${id}/status?status=${status}`, {
        method: 'POST',
        headers: authHeadersSafe(),
      })
      if (handleAuthFailure(res)) return
      if (!res.ok) throw new Error('update failed')
      await fetchTopups()
    } catch (e) {
      if (topupsStatus) topupsStatus.textContent = 'Ошибка обновления статуса.'
    }
  })
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

if (exportTopups) exportTopups.addEventListener('click', () => exportFile('/admin/export/topups.xlsx'))

function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

fetchTopups()
