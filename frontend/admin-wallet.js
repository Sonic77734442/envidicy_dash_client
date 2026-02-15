const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

renderHeader({
  eyebrow: 'Envidicy · Admin',
  title: 'Кошелек',
  subtitle: 'Балансы, операции и уведомления.',
  buttons: [],
})

const walletsBody = document.getElementById('admin-wallets')
const walletsStatus = document.getElementById('admin-wallets-status')
const walletsLowBody = document.getElementById('admin-wallets-low')
const walletsLowStatus = document.getElementById('admin-wallets-low-status')
const walletTxBody = document.getElementById('admin-wallet-transactions')
const walletTxStatus = document.getElementById('admin-wallet-transactions-status')
const profitBody = document.getElementById('admin-profit-body')
const profitStatus = document.getElementById('admin-profit-status')
const profitOverall = document.getElementById('admin-profit-overall')
const walletEmail = document.getElementById('wallet-email')
const walletAmount = document.getElementById('wallet-amount')
const walletNote = document.getElementById('wallet-note')
const walletAdd = document.getElementById('wallet-add')
const walletSubtract = document.getElementById('wallet-subtract')

function authHeadersSafe() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handleAuthFailure(res) {
  if (res.status === 401 || res.status === 403) {
    if (walletsStatus) walletsStatus.textContent = 'Нет доступа к админке.'
    return true
  }
  return false
}

async function fetchWallets() {
  try {
    const res = await fetch(`${apiBase}/admin/wallets`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load wallets')
    const data = await res.json()
    renderWallets(data)
  } catch (e) {
    if (walletsStatus) walletsStatus.textContent = 'Ошибка загрузки кошельков.'
  }
}

async function fetchWalletsLow() {
  try {
    const res = await fetch(`${apiBase}/admin/wallets?low_only=1`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load low wallets')
    const data = await res.json()
    renderWalletsLow(data)
  } catch (e) {
    if (walletsLowStatus) walletsLowStatus.textContent = 'Ошибка загрузки уведомлений.'
  }
}

async function fetchWalletTransactions() {
  try {
    const res = await fetch(`${apiBase}/admin/wallet-transactions`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load wallet transactions')
    const data = await res.json()
    renderWalletTransactions(data)
  } catch (e) {
    if (walletTxStatus) walletTxStatus.textContent = 'Ошибка загрузки истории.'
  }
}

async function fetchProfitSummary() {
  try {
    const res = await fetch(`${apiBase}/admin/topups/profit-summary`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load profit summary')
    const data = await res.json()
    renderProfitSummary(data)
  } catch (e) {
    if (profitStatus) profitStatus.textContent = 'Ошибка загрузки сводки по комиссии.'
  }
}

function renderWallets(rows) {
  if (!walletsBody) return
  walletsBody.innerHTML = rows
    .map((row) => {
      const low = Number(row.balance) <= Number(row.low_threshold)
      return `
        <tr class="${low ? 'row-warn' : ''}">
          <td>${row.user_email || '—'}</td>
          <td>₸${formatMoney(row.balance)}</td>
          <td>₸${formatMoney(row.low_threshold)}</td>
          <td>${row.updated_at?.split(' ')[0] || '—'}</td>
        </tr>
      `
    })
    .join('')
}

function renderWalletsLow(rows) {
  if (!walletsLowBody) return
  if (!rows.length) {
    walletsLowBody.innerHTML = '<tr><td colspan="4">Нет предупреждений.</td></tr>'
    return
  }
  walletsLowBody.innerHTML = rows
    .map(
      (row) => `
        <tr class="row-warn">
          <td>${row.user_email || '—'}</td>
          <td>₸${formatMoney(row.balance)}</td>
          <td>₸${formatMoney(row.low_threshold)}</td>
          <td>${row.updated_at?.split(' ')[0] || '—'}</td>
        </tr>
      `
    )
    .join('')
}

function renderWalletTransactions(rows) {
  if (!walletTxBody) return
  walletTxBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.created_at?.split(' ')[0] || '—'}</td>
          <td>${row.user_email || '—'}</td>
          <td>${row.type || '—'}</td>
          <td>${row.amount >= 0 ? '+' : ''}${formatMoney(row.amount)} ${row.currency || ''}</td>
          <td>${row.note || '—'}</td>
        </tr>
      `
    )
    .join('')
}

function renderProfitSummary(data) {
  const byPlatform = Array.isArray(data?.by_platform) ? data.by_platform : []
  const overall = Array.isArray(data?.overall) ? data.overall : []
  if (profitBody) {
    if (!byPlatform.length) {
      profitBody.innerHTML = '<tr><td colspan="5">Нет данных.</td></tr>'
    } else {
      profitBody.innerHTML = byPlatform
        .map(
          (row) => `
            <tr>
              <td>${row.platform || '—'}</td>
              <td>${row.currency || '—'}</td>
              <td>${row.completed_count || 0}</td>
              <td>${formatMoney(row.amount_input_total)} ${row.currency || ''}</td>
              <td>${formatMoney(row.fee_total)} ${row.currency || ''}</td>
            </tr>
          `
        )
        .join('')
    }
  }
  if (profitOverall) {
    profitOverall.innerHTML = ''
    overall.forEach((row) => {
      const chip = document.createElement('span')
      chip.className = 'chip chip-ghost'
      chip.textContent = `${row.currency}: ${formatMoney(row.fee_total)}`
      profitOverall.appendChild(chip)
    })
  }
}

async function adjustWallet(sign) {
  if (!walletEmail || !walletAmount) return
  const email = walletEmail.value?.trim()
  const amountValue = Number(walletAmount.value || 0)
  if (!email || !amountValue) {
    if (walletsStatus) walletsStatus.textContent = 'Укажите email и сумму.'
    return
  }
  const payload = {
    user_email: email,
    amount: sign * amountValue,
    note: walletNote?.value?.trim() || null,
  }
  try {
    const res = await fetch(`${apiBase}/admin/wallets/adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeadersSafe() },
      body: JSON.stringify(payload),
    })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('adjust failed')
    if (walletsStatus) walletsStatus.textContent = 'Баланс обновлен.'
    await fetchWallets()
    await fetchWalletsLow()
    await fetchWalletTransactions()
  } catch (e) {
    if (walletsStatus) walletsStatus.textContent = 'Ошибка обновления баланса.'
  }
}

if (walletAdd) walletAdd.addEventListener('click', () => adjustWallet(1))
if (walletSubtract) walletSubtract.addEventListener('click', () => adjustWallet(-1))

function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

fetchWallets()
fetchWalletsLow()
fetchWalletTransactions()
fetchProfitSummary()
