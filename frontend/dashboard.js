renderHeader({
  eyebrow: 'Envidicy · Insights',
  title: 'Универсальный дашборд',
  subtitle: 'Сводка по подключенным рекламным кабинетам.',
  buttons: [
    { label: 'Пополнить аккаунты', href: '/topup', kind: 'ghost' },
    { label: 'Движение средств', href: '/funds', kind: 'ghost' },
    { label: 'Медиаплан', href: '/plan', kind: 'ghost' },
    { label: 'Вход', href: '/login', kind: 'ghost' },
  ],
})

const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'
const metaDateFrom = document.getElementById('meta-date-from')
const metaDateTo = document.getElementById('meta-date-to')
const metaAccount = document.getElementById('meta-account')
const metaLoad = document.getElementById('meta-load')
const metaStatus = document.getElementById('meta-status')
const metaCards = document.getElementById('meta-cards')
const metaBody = document.getElementById('meta-body')

const googleDateFrom = document.getElementById('google-date-from')
const googleDateTo = document.getElementById('google-date-to')
const googleAccount = document.getElementById('google-account')
const googleLoad = document.getElementById('google-load')
const googleStatus = document.getElementById('google-status')
const googleCards = document.getElementById('google-cards')
const googleBody = document.getElementById('google-body')

function authHeaders() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function initMetaDates() {
  if (!metaDateFrom || !metaDateTo) return
  const today = new Date()
  const start = new Date()
  start.setDate(today.getDate() - 30)
  metaDateFrom.value = start.toISOString().slice(0, 10)
  metaDateTo.value = today.toISOString().slice(0, 10)
  if (googleDateFrom && googleDateTo) {
    googleDateFrom.value = metaDateFrom.value
    googleDateTo.value = metaDateTo.value
  }
}

async function loadMetaAccounts() {
  if (!metaAccount) return
  try {
    const res = await fetch(`${apiBase}/accounts`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) throw new Error('Failed to load accounts')
    const data = await res.json()
    const meta = data.filter((acc) => acc.platform === 'meta')
    metaAccount.innerHTML =
      '<option value="">Все</option>' +
      meta.map((acc) => `<option value="${acc.id}">${acc.name || acc.external_id || acc.id}</option>`).join('')
    if (googleAccount) {
      const google = data.filter((acc) => acc.platform === 'google')
      googleAccount.innerHTML =
        '<option value="">Все</option>' +
        google.map((acc) => `<option value="${acc.id}">${acc.name || acc.external_id || acc.id}</option>`).join('')
    }
  } catch (e) {
    if (metaStatus) metaStatus.textContent = 'Не удалось загрузить Meta аккаунты.'
  }
}

function renderMetaCards(summary) {
  if (!metaCards) return
  const currency = summary.currency || 'USD'
  const cards = [
    { label: 'Spend', value: `${formatMoney(summary.spend || 0)} ${currency}` },
    { label: 'Impr', value: formatInt(summary.impressions || 0) },
    { label: 'Clicks', value: formatInt(summary.clicks || 0) },
    { label: 'CTR', value: formatPct(summary.ctr || 0) },
    { label: 'CPC', value: summary.cpc ? `${formatMoney(summary.cpc)} ${currency}` : '—' },
    { label: 'CPM', value: summary.cpm ? `${formatMoney(summary.cpm)} ${currency}` : '—' },
    { label: 'Reach', value: formatInt(summary.reach || 0) },
  ]
  metaCards.innerHTML = cards
    .map(
      (card) => `
      <div class="stat">
        <h3>${card.label}</h3>
        <div class="stat-value">${card.value}</div>
      </div>
    `
    )
    .join('')
}

function renderMetaTable(rows) {
  if (!metaBody) return
  if (!rows.length) {
    metaBody.innerHTML = '<tr><td colspan="6">Нет данных</td></tr>'
    return
  }
  metaBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.campaign_name || row.campaign_id || '—'}</td>
        <td>${formatMoney(row.spend || 0)} ${row.account_currency || ''}</td>
        <td>${formatPct(row.ctr || 0)}</td>
        <td>${row.cpc ? formatMoney(row.cpc) : '—'}</td>
        <td>${row.cpm ? formatMoney(row.cpm) : '—'}</td>
        <td>${formatInt(row.impressions || 0)}</td>
        <td>${formatInt(row.clicks || 0)}</td>
        <td>${formatInt(row.reach || 0)}</td>
      </tr>
    `
    )
    .join('')
}

async function loadMetaInsights() {
  if (!metaDateFrom || !metaDateTo) return
  if (metaStatus) metaStatus.textContent = 'Загрузка...'
  const params = new URLSearchParams()
  params.set('date_from', metaDateFrom.value)
  params.set('date_to', metaDateTo.value)
  if (metaAccount && metaAccount.value) params.set('account_id', metaAccount.value)
  try {
    const res = await fetch(`${apiBase}/meta/insights?${params.toString()}`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) throw new Error('Failed to load meta insights')
    const data = await res.json()
    renderMetaCards(data.summary || {})
    renderMetaTable(data.campaigns || [])
    if (metaStatus) metaStatus.textContent = 'Данные обновлены.'
  } catch (e) {
    if (metaStatus) metaStatus.textContent = 'Ошибка загрузки Meta Insights.'
    renderMetaCards({ spend: 0, ctr: 0, cpc: 0, cpm: 0, reach: 0, currency: 'USD' })
    renderMetaTable([])
  }
}

function renderGoogleCards(summary) {
  if (!googleCards) return
  const currency = summary.currency || 'USD'
  const cards = [
    { label: 'Spend', value: `${formatMoney(summary.spend || 0)} ${currency}` },
    { label: 'Impr', value: formatInt(summary.impressions || 0) },
    { label: 'Clicks', value: formatInt(summary.clicks || 0) },
    { label: 'CTR', value: formatPct(summary.ctr || 0) },
    { label: 'CPC', value: summary.cpc ? `${formatMoney(summary.cpc)} ${currency}` : '—' },
    { label: 'CPM', value: summary.cpm ? `${formatMoney(summary.cpm)} ${currency}` : '—' },
  ]
  googleCards.innerHTML = cards
    .map(
      (card) => `
      <div class="stat">
        <h3>${card.label}</h3>
        <div class="stat-value">${card.value}</div>
      </div>
    `
    )
    .join('')
}

function renderGoogleTable(rows) {
  if (!googleBody) return
  if (!rows.length) {
    googleBody.innerHTML = '<tr><td colspan="8">Нет данных</td></tr>'
    return
  }
  googleBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.campaign_name || row.campaign_id || '—'}</td>
        <td>${formatMoney(row.spend || 0)} ${row.currency || row.account_currency || ''}</td>
        <td>${formatPct(row.ctr || 0)}</td>
        <td>${row.cpc ? formatMoney(row.cpc) : '—'}</td>
        <td>${row.cpm ? formatMoney(row.cpm) : '—'}</td>
        <td>${formatInt(row.impressions || 0)}</td>
        <td>${formatInt(row.clicks || 0)}</td>
        <td>${formatInt(row.conversions || 0)}</td>
      </tr>
    `
    )
    .join('')
}

async function loadGoogleInsights() {
  if (!googleDateFrom || !googleDateTo) return
  if (googleStatus) googleStatus.textContent = 'Загрузка...'
  const params = new URLSearchParams()
  params.set('date_from', googleDateFrom.value)
  params.set('date_to', googleDateTo.value)
  if (googleAccount && googleAccount.value) params.set('account_id', googleAccount.value)
  try {
    const res = await fetch(`${apiBase}/google/insights?${params.toString()}`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) throw new Error('Failed to load google insights')
    const data = await res.json()
    renderGoogleCards(data.summary || {})
    renderGoogleTable(data.campaigns || [])
    if (googleStatus) googleStatus.textContent = 'Данные обновлены.'
  } catch (e) {
    if (googleStatus) googleStatus.textContent = 'Ошибка загрузки Google Ads.'
    renderGoogleCards({ spend: 0, ctr: 0, cpc: 0, cpm: 0, impressions: 0, clicks: 0, currency: 'USD' })
    renderGoogleTable([])
  }
}

if (metaLoad) metaLoad.addEventListener('click', loadMetaInsights)
if (googleLoad) googleLoad.addEventListener('click', loadGoogleInsights)
initMetaDates()
loadMetaAccounts()

function formatInt(value) {
  return Math.round(value).toLocaleString('ru-RU')
}

function formatMoney(value) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPct(value) {
  return `${(value * 100).toFixed(2)}%`
}
