renderHeader({
  eyebrow: 'Envidicy · Insights',
  title: 'Универсальный дашборд',
  subtitle: 'Загрузите CSV отчеты из кабинетов, чтобы получить единую сводку по метрикам.',
  buttons: [
    { label: 'Пополнить аккаунты', href: './topup.html', kind: 'ghost' },
    { label: 'Движение средств', href: './funds.html', kind: 'ghost' },
    { label: 'Медиаплан', href: './index.html', kind: 'ghost' },
    { label: 'Вход', href: './login.html', kind: 'ghost' },
  ],
})

const state = {
  rows: [],
  impressionsLabel: 'Показы/просмотры',
}

const apiBase = 'http://127.0.0.1:8000'
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

const fileInput = document.getElementById('stats-file')
const currencySelect = document.getElementById('stats-currency')
const statusEl = document.getElementById('stats-status')
const cardsEl = document.getElementById('stats-cards')
const tableBody = document.getElementById('stats-body')

if (statusEl) statusEl.textContent = 'Загрузите CSV, чтобы увидеть метрики.'

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
      window.location.href = './login.html'
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
      window.location.href = './login.html'
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
      window.location.href = './login.html'
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

if (fileInput) {
  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    try {
      const parsed = parseCsv(text)
      state.rows = parsed.rows
      state.impressionsLabel = parsed.impressionsLabel
      render()
      if (statusEl) statusEl.textContent = `Файл "${file.name}" загружен.`
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message || 'Не удалось прочитать CSV.'
      state.rows = []
      render()
    }
  })
}

if (metaLoad) metaLoad.addEventListener('click', loadMetaInsights)
if (googleLoad) googleLoad.addEventListener('click', loadGoogleInsights)
initMetaDates()
loadMetaAccounts()

function render() {
  renderCards()
  renderCharts()
  renderTable()
}

function renderCards() {
  if (!cardsEl) return
  if (!state.rows.length) {
    cardsEl.innerHTML = ''
    return
  }
  const totals = summarize(state.rows)
  const currency = currencySelect?.value || 'KZT'
  const cards = [
    { label: state.impressionsLabel, value: formatInt(totals.impressions) },
    { label: 'Клики', value: formatInt(totals.clicks) },
    { label: 'Расход', value: `${formatMoney(totals.spend)} ${currency}` },
    { label: 'CTR', value: formatPct(totals.ctr) },
    { label: 'CPC', value: totals.clicks ? `${formatMoney(totals.cpc)} ${currency}` : '—' },
    { label: 'CPM', value: totals.impressions ? `${formatMoney(totals.cpm)} ${currency}` : '—' },
    { label: 'Конверсии', value: formatInt(totals.conversions) },
  ]
  cardsEl.innerHTML = cards
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

function renderCharts() {
  renderKpiRings()
  renderSpendDonut()
  renderLineChart()
}

function renderKpiRings() {
  const ringsEl = document.getElementById('kpi-rings')
  if (!ringsEl) return
  if (!state.rows.length) {
    ringsEl.innerHTML = ''
    return
  }
  const totals = summarize(state.rows)
  const ringData = [
    { label: 'CTR', value: totals.ctr, max: 0.1, color: '#6ae3ff', display: formatPct(totals.ctr) },
    {
      label: 'CPC',
      value: totals.cpc,
      max: totals.cpc ? totals.cpc * 2 : 1,
      color: '#34d399',
      display: totals.cpc ? formatMoney(totals.cpc) : '—',
    },
    {
      label: 'CPM',
      value: totals.cpm,
      max: totals.cpm ? totals.cpm * 2 : 1,
      color: '#f59e0b',
      display: totals.cpm ? formatMoney(totals.cpm) : '—',
    },
  ]
  ringsEl.innerHTML = ringData
    .map((item) => ringSvg(item.label, item.value, item.max, item.color, item.display))
    .join('')
}

function ringSvg(label, value, max, color, display) {
  const size = 72
  const stroke = 8
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(value / max, 1)
  const offset = circumference * (1 - progress)
  return `
    <div class="ring">
      <svg viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" stroke="#1b223b" stroke-width="${stroke}" fill="none"></circle>
        <circle
          cx="${size / 2}"
          cy="${size / 2}"
          r="${radius}"
          stroke="${color}"
          stroke-width="${stroke}"
          fill="none"
          stroke-linecap="round"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
          transform="rotate(-90 ${size / 2} ${size / 2})"
        ></circle>
      </svg>
      <div class="ring-value">${display}</div>
      <div class="ring-label">${label}</div>
    </div>
  `
}

function renderSpendDonut() {
  const donutEl = document.getElementById('spend-donut')
  const legendEl = document.getElementById('spend-legend')
  if (!donutEl || !legendEl) return
  if (!state.rows.length) {
    donutEl.innerHTML = ''
    legendEl.innerHTML = ''
    return
  }
  const buckets = groupSpendByDimension(state.rows)
  const data = Object.entries(buckets)
    .map(([key, value]) => ({ key, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
  if (!data.length) {
    donutEl.innerHTML = '<div class="muted">Нет расходов для доли.</div>'
    legendEl.innerHTML = ''
    return
  }
  const colors = ['#6ae3ff', '#8b7bff', '#34d399', '#f59e0b', '#f97316', '#ef4444', '#22c55e']
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const limited = data.slice(0, 5)
  const rest = data.slice(5).reduce((sum, item) => sum + item.value, 0)
  if (rest > 0) limited.push({ key: 'Другое', value: rest })
  let startAngle = 0
  const segments = limited
    .map((item, index) => {
      const angle = (item.value / total) * 360
      const segment = donutSegment(startAngle, startAngle + angle, colors[index % colors.length])
      startAngle += angle
      return segment
    })
    .join('')
  donutEl.innerHTML = `
    <svg viewBox="0 0 200 200">
      ${segments}
      <circle cx="100" cy="100" r="55" fill="#0e1426"></circle>
      <text x="100" y="104" text-anchor="middle" fill="#e5e7f5" font-size="14" font-weight="700">
        ${formatMoney(total)}
      </text>
    </svg>
  `
  legendEl.innerHTML = limited
    .map(
      (item, index) => `
      <div class="legend-item">
        <span><span class="legend-color" style="background:${colors[index % colors.length]}"></span>${item.key}</span>
        <span>${formatMoney(item.value)}</span>
      </div>
    `
    )
    .join('')
}

function donutSegment(start, end, color) {
  const startRad = ((start - 90) * Math.PI) / 180
  const endRad = ((end - 90) * Math.PI) / 180
  const radius = 90
  const x1 = 100 + radius * Math.cos(startRad)
  const y1 = 100 + radius * Math.sin(startRad)
  const x2 = 100 + radius * Math.cos(endRad)
  const y2 = 100 + radius * Math.sin(endRad)
  const largeArc = end - start > 180 ? 1 : 0
  return `
    <path d="M100 100 L${x1} ${y1} A${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${color}"></path>
  `
}

function groupSpendByDimension(rows) {
  const preferredKeys = ['platform', 'source', 'channel', 'campaign', 'account']
  const key = preferredKeys.find((k) => rows.some((row) => row[k]))
  const buckets = {}
  rows.forEach((row) => {
    const label = key ? row[key] || 'Не указано' : row.date || 'Без даты'
    buckets[label] = (buckets[label] || 0) + row.spend
  })
  return buckets
}

function renderLineChart() {
  const lineEl = document.getElementById('line-chart')
  if (!lineEl) return
  if (!state.rows.length) {
    lineEl.innerHTML = ''
    return
  }
  const rows = [...state.rows].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const width = 960
  const height = 220
  const padding = 36
  const spendValues = rows.map((row) => row.spend || 0)
  const clickValues = rows.map((row) => row.clicks || 0)
  const maxValue = Math.max(...spendValues, ...clickValues, 1)
  const pointsSpend = rows
    .map((row, i) => {
      const x = padding + (i / (rows.length - 1 || 1)) * (width - padding * 2)
      const y = height - padding - (row.spend / maxValue) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')
  const pointsClicks = rows
    .map((row, i) => {
      const x = padding + (i / (rows.length - 1 || 1)) * (width - padding * 2)
      const y = height - padding - (row.clicks / maxValue) * (height - padding * 2)
      return `${x},${y}`
    })
    .join(' ')
  lineEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#6ae3ff" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#6ae3ff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="#0e1426" rx="12"></rect>
      <polyline points="${pointsSpend}" fill="none" stroke="#6ae3ff" stroke-width="3" />
      <polyline points="${pointsClicks}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6 6" />
      <polygon points="${pointsSpend} ${width - padding},${height - padding} ${padding},${height - padding}" fill="url(#spendFill)" />
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#1c243f" />
      <text x="${padding}" y="${padding}" fill="#6ae3ff" font-size="12">Spend</text>
      <text x="${padding + 60}" y="${padding}" fill="#f59e0b" font-size="12">Clicks</text>
    </svg>
  `
}

function renderTable() {
  if (!tableBody) return
  if (!state.rows.length) {
    tableBody.innerHTML = ''
    return
  }
  const currency = currencySelect?.value || 'KZT'
  const rows = [...state.rows].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  tableBody.innerHTML = rows
    .map((row) => {
      const ctr = row.impressions ? row.clicks / row.impressions : 0
      const cpc = row.clicks ? row.spend / row.clicks : 0
      const cpm = row.impressions ? (row.spend / row.impressions) * 1000 : 0
      return `
        <tr>
          <td>${row.date || '—'}</td>
          <td>${formatInt(row.impressions)}</td>
          <td>${formatInt(row.clicks)}</td>
          <td>${row.spend ? `${formatMoney(row.spend)} ${currency}` : '—'}</td>
          <td>${row.impressions ? formatPct(ctr) : '—'}</td>
          <td>${row.clicks ? `${formatMoney(cpc)} ${currency}` : '—'}</td>
          <td>${row.impressions ? `${formatMoney(cpm)} ${currency}` : '—'}</td>
          <td>${row.conversions ? formatInt(row.conversions) : '—'}</td>
        </tr>
      `
    })
    .join('')
}

function summarize(rows) {
  const totals = rows.reduce(
    (acc, row) => {
      acc.impressions += row.impressions
      acc.clicks += row.clicks
      acc.spend += row.spend
      acc.conversions += row.conversions
      return acc
    },
    { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
  )
  return {
    ...totals,
    ctr: totals.impressions ? totals.clicks / totals.impressions : 0,
    cpc: totals.clicks ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions ? (totals.spend / totals.impressions) * 1000 : 0,
  }
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length)
  if (!lines.length) throw new Error('CSV пустой.')
  const delimiter = detectDelimiter(lines[0])
  const rawHeaders = parseLine(lines[0], delimiter).map((h) => normalizeHeader(h))
  const indexMap = buildIndexMap(rawHeaders)
  if (indexMap.date === -1) throw new Error('Не найден столбец с датой.')
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line, delimiter)
    return {
      date: cells[indexMap.date]?.trim() || '',
      impressions: parseNumber(cells[indexMap.impressions]),
      clicks: parseNumber(cells[indexMap.clicks]),
      spend: parseNumber(cells[indexMap.spend]),
      conversions: parseNumber(cells[indexMap.conversions]),
      platform: cells[indexMap.platform]?.trim() || '',
      source: cells[indexMap.source]?.trim() || '',
      channel: cells[indexMap.channel]?.trim() || '',
      campaign: cells[indexMap.campaign]?.trim() || '',
      account: cells[indexMap.account]?.trim() || '',
    }
  })
  const impressionsLabel = deriveImpressionsLabel(rawHeaders[indexMap.impressions] || '')
  return { rows, impressionsLabel }
}

function detectDelimiter(headerLine) {
  if (headerLine.includes(';')) return ';'
  if (headerLine.includes('\t')) return '\t'
  return ','
}

function parseLine(line, delimiter) {
  const out = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (char === delimiter && !inQuotes) {
      out.push(current)
      current = ''
      continue
    }
    current += char
  }
  out.push(current)
  return out
}

function normalizeHeader(value) {
  return value
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9а-я_]/g, '')
}

function buildIndexMap(headers) {
  const map = {
    date: findIndex(headers, ['date', 'day', 'дата']),
    impressions: findIndex(headers, ['impressions', 'impr', 'показы', 'views', 'view', 'просмотры']),
    clicks: findIndex(headers, ['clicks', 'click', 'клики']),
    spend: findIndex(headers, ['spend', 'cost', 'расход', 'затраты', 'стоимость']),
    conversions: findIndex(headers, ['conversions', 'conv', 'лиды', 'leads', 'lead', 'конверсии']),
    platform: findIndex(headers, ['platform', 'платформа', 'source', 'источник']),
    source: findIndex(headers, ['source', 'источник']),
    channel: findIndex(headers, ['channel', 'канал']),
    campaign: findIndex(headers, ['campaign', 'кампания']),
    account: findIndex(headers, ['account', 'аккаунт']),
  }
  return map
}

function findIndex(headers, keys) {
  for (const key of keys) {
    const index = headers.indexOf(key)
    if (index !== -1) return index
  }
  return -1
}

function deriveImpressionsLabel(header) {
  if (header.includes('view') || header.includes('просмотр')) return 'Просмотры'
  return 'Показы'
}

function parseNumber(value) {
  if (!value) return 0
  const cleaned = String(value).replace(/"/g, '').replace(/\s+/g, '').replace(',', '.')
  const num = Number(cleaned.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(num) ? num : 0
}

function formatInt(value) {
  return Math.round(value).toLocaleString('ru-RU')
}

function formatMoney(value) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPct(value) {
  return `${(value * 100).toFixed(2)}%`
}
