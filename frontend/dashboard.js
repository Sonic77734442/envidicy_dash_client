renderHeader({
  eyebrow: 'Envidicy · Insights',
  title: 'Универсальный дашборд',
  subtitle: 'Сводка по подключенным рекламным кабинетам.',
  buttons: [
    { label: 'Пополнить аккаунты', href: '/topup', kind: 'ghost' },
    { label: 'Финансы', href: '/funds', kind: 'ghost' },
    { label: 'Медиаплан', href: '/plan', kind: 'ghost' },
    { label: 'Вход', href: '/login', kind: 'ghost' },
  ],
})

const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'
const dashboardQuery = new URLSearchParams(window.location.search || '')
const deepLinkPlatform = String(dashboardQuery.get('platform') || '').toLowerCase()
const deepLinkAccountId = String(dashboardQuery.get('account_id') || '')
let deepLinkApplied = false
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

const tiktokDateFrom = document.getElementById('tiktok-date-from')
const tiktokDateTo = document.getElementById('tiktok-date-to')
const tiktokAccount = document.getElementById('tiktok-account')
const tiktokLoad = document.getElementById('tiktok-load')
const tiktokStatus = document.getElementById('tiktok-status')
const tiktokCards = document.getElementById('tiktok-cards')
const tiktokCampaigns = document.getElementById('tiktok-campaigns')
const tiktokAdgroups = document.getElementById('tiktok-adgroups')
const tiktokAds = document.getElementById('tiktok-ads')

const reportLoad = document.getElementById('report-load')
const reportExport = document.getElementById('report-export')
const reportStatus = document.getElementById('report-status')
const ringGrid = document.getElementById('kpi-rings')
const donutEl = document.getElementById('spend-donut')
const legendEl = document.getElementById('spend-legend')
const lineEl = document.getElementById('line-chart')
const vizMetaAccount = document.getElementById('viz-meta-account')
const vizGoogleAccount = document.getElementById('viz-google-account')
const vizTiktokAccount = document.getElementById('viz-tiktok-account')

const audienceAgePlatform = document.getElementById('audience-age-platform')
const audienceGeoPlatform = document.getElementById('audience-geo-platform')
const audienceDevicePlatform = document.getElementById('audience-device-platform')
const audienceAgeDonut = document.getElementById('audience-age-donut')
const audienceGeoDonut = document.getElementById('audience-geo-donut')
const audienceDeviceDonut = document.getElementById('audience-device-donut')
const audienceAgeLegend = document.getElementById('audience-age-legend')
const audienceGeoLegend = document.getElementById('audience-geo-legend')
const audienceDeviceLegend = document.getElementById('audience-device-legend')
const audienceStatus = document.getElementById('audience-status')

function authHeaders() {
  const token = typeof getAuthToken === 'function' ? getAuthToken() : localStorage.getItem('auth_token')
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
  if (tiktokDateFrom && tiktokDateTo) {
    tiktokDateFrom.value = metaDateFrom.value
    tiktokDateTo.value = metaDateTo.value
  }
}

function accountOptionLabel(acc) {
  const name = acc.name || `ID ${acc.id}`
  const ext = acc.external_id || acc.account_code || ''
  return ext ? `${name} · ${ext}` : `${name} · id:${acc.id}`
}

function renderAccountSelectOptions(selectEl, accounts, allLabel) {
  if (!selectEl) return
  selectEl.innerHTML =
    `<option value="">${allLabel}</option>` +
    accounts.map((acc) => `<option value="${acc.id}">${accountOptionLabel(acc)}</option>`).join('')
  selectEl.value = ''
}

function selectedVisualizationAccounts() {
  return {
    meta: (vizMetaAccount && vizMetaAccount.value) || (metaAccount && metaAccount.value) || '',
    google: (vizGoogleAccount && vizGoogleAccount.value) || (googleAccount && googleAccount.value) || '',
    tiktok: (vizTiktokAccount && vizTiktokAccount.value) || (tiktokAccount && tiktokAccount.value) || '',
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
    const meta = data.filter((acc) => String(acc.platform || '').toLowerCase().trim() === 'meta')
    renderAccountSelectOptions(metaAccount, meta, 'Все')
    renderAccountSelectOptions(vizMetaAccount, meta, 'Meta: все аккаунты')
    if (googleAccount) {
      const google = data.filter((acc) => String(acc.platform || '').toLowerCase().trim() === 'google')
      renderAccountSelectOptions(googleAccount, google, 'Все')
      renderAccountSelectOptions(vizGoogleAccount, google, 'Google: все аккаунты')
    }
    if (tiktokAccount) {
      const tiktok = data.filter((acc) => String(acc.platform || '').toLowerCase().trim() === 'tiktok')
      renderAccountSelectOptions(tiktokAccount, tiktok, 'Все')
      renderAccountSelectOptions(vizTiktokAccount, tiktok, 'TikTok: все аккаунты')
    }
    applyDashboardDeepLink()
  } catch (e) {
    if (metaStatus) metaStatus.textContent = 'Не удалось загрузить Meta аккаунты.'
  }
}

function applyDashboardDeepLink() {
  if (deepLinkApplied) return
  if (!deepLinkPlatform || !deepLinkAccountId) return
  deepLinkApplied = true
  if (deepLinkPlatform === 'meta' && metaAccount) {
    if (metaAccount.querySelector(`option[value="${deepLinkAccountId}"]`)) {
      metaAccount.value = deepLinkAccountId
      if (vizMetaAccount && vizMetaAccount.querySelector(`option[value="${deepLinkAccountId}"]`)) {
        vizMetaAccount.value = deepLinkAccountId
      }
    }
    void withGlobalLoading('Загружаем данные...', loadMetaInsights)
    return
  }
  if (deepLinkPlatform === 'google' && googleAccount) {
    if (googleAccount.querySelector(`option[value="${deepLinkAccountId}"]`)) {
      googleAccount.value = deepLinkAccountId
      if (vizGoogleAccount && vizGoogleAccount.querySelector(`option[value="${deepLinkAccountId}"]`)) {
        vizGoogleAccount.value = deepLinkAccountId
      }
    }
    void withGlobalLoading('Загружаем данные...', loadGoogleInsights)
    return
  }
  if (deepLinkPlatform === 'tiktok' && tiktokAccount) {
    if (tiktokAccount.querySelector(`option[value="${deepLinkAccountId}"]`)) {
      tiktokAccount.value = deepLinkAccountId
      if (vizTiktokAccount && vizTiktokAccount.querySelector(`option[value="${deepLinkAccountId}"]`)) {
        vizTiktokAccount.value = deepLinkAccountId
      }
    }
    void withGlobalLoading('Загружаем данные...', loadTiktokInsights)
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

function renderTiktokCards(summary) {
  if (!tiktokCards) return
  const currency = summary.currency || 'USD'
  const cards = [
    { label: 'Spend', value: `${formatMoney(summary.spend || 0)} ${currency}` },
    { label: 'Impr', value: formatInt(summary.impressions || 0) },
    { label: 'Clicks', value: formatInt(summary.clicks || 0) },
    { label: 'CTR', value: formatPct(summary.ctr || 0) },
    { label: 'CPC', value: summary.cpc ? `${formatMoney(summary.cpc)} ${currency}` : '—' },
    { label: 'CPM', value: summary.cpm ? `${formatMoney(summary.cpm)} ${currency}` : '—' },
  ]
  tiktokCards.innerHTML = cards
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

function renderTiktokTable(rows, tbody, columns) {
  if (!tbody) return
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="' + columns + '">Нет данных</td></tr>'
    return
  }
  tbody.innerHTML = rows
    .map((row) => {
      if (tbody === tiktokCampaigns) {
        return `
      <tr>
        <td>${row.campaign_name || row.campaign_id || '—'}</td>
        <td>${formatMoney(row.spend || 0)}</td>
        <td>${formatPct(row.ctr || 0)}</td>
        <td>${row.cpc ? formatMoney(row.cpc) : '—'}</td>
        <td>${row.cpm ? formatMoney(row.cpm) : '—'}</td>
        <td>${formatInt(row.impressions || 0)}</td>
        <td>${formatInt(row.clicks || 0)}</td>
      </tr>
      `
      }
      if (tbody === tiktokAdgroups) {
        return `
      <tr>
        <td>${row.adgroup_name || row.adgroup_id || '—'}</td>
        <td>${row.campaign_name || row.campaign_id || '—'}</td>
        <td>${formatMoney(row.spend || 0)}</td>
        <td>${formatPct(row.ctr || 0)}</td>
        <td>${row.cpc ? formatMoney(row.cpc) : '—'}</td>
        <td>${row.cpm ? formatMoney(row.cpm) : '—'}</td>
        <td>${formatInt(row.impressions || 0)}</td>
        <td>${formatInt(row.clicks || 0)}</td>
      </tr>
      `
      }
      return `
      <tr>
        <td>${row.ad_name || row.ad_id || '—'}</td>
        <td>${row.adgroup_name || row.adgroup_id || '—'}</td>
        <td>${row.campaign_name || row.campaign_id || '—'}</td>
        <td>${formatMoney(row.spend || 0)}</td>
        <td>${formatPct(row.ctr || 0)}</td>
        <td>${row.cpc ? formatMoney(row.cpc) : '—'}</td>
        <td>${row.cpm ? formatMoney(row.cpm) : '—'}</td>
        <td>${formatInt(row.impressions || 0)}</td>
        <td>${formatInt(row.clicks || 0)}</td>
      </tr>
      `
    })
    .join('')
}

async function loadTiktokInsights() {
  if (!tiktokDateFrom || !tiktokDateTo) return
  if (tiktokStatus) tiktokStatus.textContent = 'Загрузка...'
  const params = new URLSearchParams()
  params.set('date_from', tiktokDateFrom.value)
  params.set('date_to', tiktokDateTo.value)
  if (tiktokAccount && tiktokAccount.value) params.set('account_id', tiktokAccount.value)
  try {
    const res = await fetch(`${apiBase}/tiktok/insights?${params.toString()}`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) {
      let detail = ''
      try {
        const data = await res.json()
        detail = data?.detail || ''
      } catch (e) {
        detail = ''
      }
      throw new Error(detail || 'Failed to load tiktok insights')
    }
    const data = await res.json()
    renderTiktokCards(data.summary || {})
    renderTiktokTable(data.campaigns || [], tiktokCampaigns, 7)
    renderTiktokTable(data.adgroups || [], tiktokAdgroups, 8)
    renderTiktokTable(data.ads || [], tiktokAds, 9)
    if (tiktokStatus) tiktokStatus.textContent = 'Данные обновлены.'
  } catch (e) {
    const message = e?.message || ''
    if (tiktokStatus) tiktokStatus.textContent = message ? `Ошибка загрузки TikTok Ads: ${message}` : 'Ошибка загрузки TikTok Ads.'
    renderTiktokCards({ spend: 0, ctr: 0, cpc: 0, cpm: 0, impressions: 0, clicks: 0, currency: 'USD' })
    renderTiktokTable([], tiktokCampaigns, 7)
    renderTiktokTable([], tiktokAdgroups, 8)
    renderTiktokTable([], tiktokAds, 9)
  }
}

const platformPalette = [
  { key: 'meta', label: 'Meta', color: '#3b82f6' },
  { key: 'google', label: 'Google', color: '#f59e0b' },
  { key: 'tiktok', label: 'TikTok', color: '#14b8a6' },
]

function formatShort(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

function buildRing({ label, value, percent, color }) {
  const radius = 15.915
  const dash = Math.max(0, Math.min(100, percent * 100))
  return `
    <div class="ring">
      <svg viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="${radius}" fill="none" stroke="var(--line)" stroke-width="4"></circle>
        <circle
          cx="18"
          cy="18"
          r="${radius}"
          fill="none"
          stroke="${color}"
          stroke-width="4"
          stroke-linecap="round"
          stroke-dasharray="${dash} ${100 - dash}"
          transform="rotate(-90 18 18)"
        ></circle>
      </svg>
      <div class="ring-label">${label}</div>
      <div class="ring-value">${(percent * 100).toFixed(1)}% · $${formatMoney(value)}</div>
    </div>
  `
}

function renderRings(totals) {
  if (!ringGrid) return
  const totalSpend = platformPalette.reduce((sum, p) => sum + (totals[p.key]?.spend || 0), 0)
  if (!totalSpend) {
    ringGrid.innerHTML = '<div class="muted">Нет данных</div>'
    return
  }
  ringGrid.innerHTML = platformPalette
    .map((p) =>
      buildRing({
        label: p.label,
        value: totals[p.key]?.spend || 0,
        percent: (totals[p.key]?.spend || 0) / totalSpend,
        color: p.color,
      })
    )
    .join('')
}

function renderDonut(totals) {
  if (!donutEl || !legendEl) return
  const totalSpend = platformPalette.reduce((sum, p) => sum + (totals[p.key]?.spend || 0), 0)
  if (!totalSpend) {
    donutEl.innerHTML = '<div class="muted">Нет данных</div>'
    legendEl.innerHTML = ''
    return
  }
  let offset = 0
  const donutRadius = 13
  const donutStroke = 6
  const segments = platformPalette
    .map((p) => {
      const value = totals[p.key]?.spend || 0
      const share = value / totalSpend
      const dash = share * 100
      const segment = `
        <circle
          cx="18"
          cy="18"
          r="${donutRadius}"
          fill="none"
          stroke="${p.color}"
          stroke-width="${donutStroke}"
          stroke-dasharray="${dash} ${100 - dash}"
          stroke-dashoffset="${-offset}"
          transform="rotate(-90 18 18)"
        ></circle>
      `
      offset += dash
      return segment
    })
    .join('')
  donutEl.innerHTML = `
    <svg viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="${donutRadius}" fill="none" stroke="var(--line)" stroke-width="${donutStroke}"></circle>
      ${segments}
    </svg>
  `
  legendEl.innerHTML = platformPalette
    .map((p) => {
      const value = totals[p.key]?.spend || 0
      const share = value / totalSpend
      return `
        <div class="legend-item">
          <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.color};margin-right:6px;"></span>${p.label}</span>
          <span>${formatMoney(value)} · ${(share * 100).toFixed(1)}%</span>
        </div>
      `
    })
    .join('')
}

function buildDateRange(startStr, endStr) {
  const result = []
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return result
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    result.push(d.toISOString().slice(0, 10))
  }
  return result
}

function buildXAxisTicks(series) {
  if (!series.length) return []
  const start = new Date(series[0].date)
  const end = new Date(series[series.length - 1].date)
  const rangeDays = Math.round((end - start) / 86400000) + 1
  if (rangeDays > 365) {
    const ticks = []
    series.forEach((row, idx) => {
      const d = new Date(row.date)
      if (d.getMonth() === 0 && d.getDate() === 1) {
        ticks.push({ idx, label: String(d.getFullYear()) })
      }
    })
    if (!ticks.length) ticks.push({ idx: 0, label: String(start.getFullYear()) })
    return ticks
  }
  if (rangeDays > 60) {
    const ticks = []
    series.forEach((row, idx) => {
      const d = new Date(row.date)
      if (d.getDate() === 1) {
        ticks.push({ idx, label: d.toLocaleString('ru-RU', { month: 'short' }) })
      }
    })
    if (!ticks.length) ticks.push({ idx: 0, label: start.toLocaleString('ru-RU', { month: 'short' }) })
    return ticks
  }
  const step = rangeDays <= 14 ? 1 : 5
  return series
    .map((row, idx) => ({ idx, label: row.date.slice(5) }))
    .filter((row, i) => i % step === 0)
}

function renderLineChart(series) {
  if (!lineEl) return
  if (!series.length) {
    lineEl.innerHTML = '<div class="muted">Нет данных</div>'
    return
  }
  const width = 720
  const height = 220
  const pad = 24
  const maxValue = Math.max(1, ...series.map((d) => Math.max(d.spend, d.clicks)))
  const scaleX = (idx) => pad + (idx / (series.length - 1 || 1)) * (width - pad * 2)
  const scaleY = (value) => height - pad - (value / maxValue) * (height - pad * 2)
  const spendPath = series
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.spend)}`)
    .join(' ')
  const clickPath = series
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.clicks)}`)
    .join(' ')
  const ticks = buildXAxisTicks(series)
  const xLabels = ticks
    .map(
      (t) => `
      <text x="${scaleX(t.idx)}" y="${height - 6}" text-anchor="middle" fill="var(--muted)" font-size="10">
        ${t.label}
      </text>
    `
    )
    .join('')
  const totalSpend = series.reduce((sum, row) => sum + row.spend, 0)
  const totalClicks = series.reduce((sum, row) => sum + row.clicks, 0)
  lineEl.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="none"></rect>
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" stroke="var(--line)" stroke-width="1"></line>
      <path d="${spendPath}" fill="none" stroke="#3b82f6" stroke-width="2"></path>
      <path d="${clickPath}" fill="none" stroke="#f59e0b" stroke-width="2"></path>
      <circle id="line-marker" cx="${scaleX(series.length - 1)}" cy="${scaleY(series[series.length - 1].spend)}" r="4" fill="#3b82f6"></circle>
      ${xLabels}
    </svg>
    <div class="chart-tooltip" id="line-tooltip"></div>
    <div class="legend">
      <div class="legend-item"><span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#3b82f6;margin-right:6px;"></span>Spend (итого)</span><span>${formatMoney(totalSpend)}</span></div>
      <div class="legend-item"><span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#f59e0b;margin-right:6px;"></span>Clicks (итого)</span><span>${formatInt(totalClicks)}</span></div>
      <div class="legend-item"><span class="muted">Общая шкала</span></div>
    </div>
  `

  const svg = lineEl.querySelector('svg')
  const marker = lineEl.querySelector('#line-marker')
  const tooltip = lineEl.querySelector('#line-tooltip')
  if (!svg || !marker || !tooltip) return

  const clampIndex = (idx) => Math.max(0, Math.min(series.length - 1, idx))
  const updateTooltip = (idx, clientX, clientY) => {
    const point = series[idx]
    marker.setAttribute('cx', scaleX(idx))
    marker.setAttribute('cy', scaleY(point.spend))
    tooltip.textContent = `${point.date} · Spend ${formatMoney(point.spend)} · Clicks ${formatInt(point.clicks)}`
    const rect = lineEl.getBoundingClientRect()
    tooltip.style.left = `${clientX - rect.left}px`
    tooltip.style.top = `${clientY - rect.top - 8}px`
    tooltip.style.opacity = '1'
  }

  svg.addEventListener('mousemove', (event) => {
    const rect = svg.getBoundingClientRect()
    const xView = ((event.clientX - rect.left) / rect.width) * width
    const raw = Math.round(((xView - pad) / (width - pad * 2)) * (series.length - 1))
    const idx = clampIndex(raw)
    updateTooltip(idx, event.clientX, event.clientY)
  })

  svg.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0'
  })
}

async function loadOverview() {
  if (!metaDateFrom || !metaDateTo) return
  if (reportStatus) reportStatus.textContent = 'Загрузка отчета...'
  const params = new URLSearchParams()
  params.set('date_from', metaDateFrom.value)
  params.set('date_to', metaDateTo.value)
  const selected = selectedVisualizationAccounts()
  if (selected.meta) params.set('meta_account_id', selected.meta)
  if (selected.google) params.set('google_account_id', selected.google)
  if (selected.tiktok) params.set('tiktok_account_id', selected.tiktok)
  try {
    const res = await fetch(`${apiBase}/insights/overview?${params.toString()}`, { headers: authHeaders() })
    if (res.status === 401) {
      window.location.href = '/login'
      return
    }
    if (!res.ok) throw new Error('Failed to load overview')
    const data = await res.json()
    const totals = data.totals || {}
    renderRings(totals)
    renderDonut(totals)
    const range = buildDateRange(metaDateFrom.value, metaDateTo.value)
    const series = range.map((date) => {
      const meta = (data.daily?.meta || []).find((row) => row.date === date) || {}
      const google = (data.daily?.google || []).find((row) => row.date === date) || {}
      const tiktok = (data.daily?.tiktok || []).find((row) => row.date === date) || {}
      const spend = (meta.spend || 0) + (google.spend || 0) + (tiktok.spend || 0)
      const clicks = (meta.clicks || 0) + (google.clicks || 0) + (tiktok.clicks || 0)
      return { date, spend, clicks }
    })
    renderLineChart(series)
    if (reportStatus) reportStatus.textContent = 'Отчет обновлен.'
  } catch (e) {
    if (reportStatus) reportStatus.textContent = 'Ошибка загрузки отчета.'
  }
}

function renderAudienceDonut(target, legendTarget, rows) {
  if (!target || !legendTarget) return
  const grouped = new Map()
  rows.forEach((row) => {
    const key = String(row.segment || '').trim() || 'Unknown'
    const impressions = Number(row.impressions || 0)
    const clicks = Number(row.clicks || 0)
    const spend = Number(row.spend || 0)
    const weight =
      Number.isFinite(impressions) && impressions > 0
        ? impressions
        : Number.isFinite(clicks) && clicks > 0
          ? clicks
          : Number.isFinite(spend) && spend > 0
            ? spend
            : 0
    grouped.set(key, (grouped.get(key) || 0) + weight)
  })
  const items = Array.from(grouped.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
  const total = items.reduce((sum, item) => sum + item.value, 0)

  if (!items.length || total <= 0) {
    target.innerHTML = '<div class="muted">Нет данных по расходам</div>'
    legendTarget.innerHTML = ''
    return
  }

  const palette = ['#3b82f6', '#f59e0b', '#34d399', '#a78bfa', '#ef4444', '#22d3ee', '#f97316', '#10b981']
  const donutRadius = 13
  const donutStroke = 6
  const circumference = 2 * Math.PI * donutRadius
  let offset = 0
  const arcs = items
    .map((item, idx) => {
      const ratio = item.value / total
      const length = circumference * ratio
      const dash = `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`
      const rotate = (offset / circumference) * 360 - 90
      offset += length
      return `
        <circle
          cx="18"
          cy="18"
          r="${donutRadius}"
          fill="none"
          stroke="${palette[idx % palette.length]}"
          stroke-width="${donutStroke}"
          stroke-dasharray="${dash}"
          transform="rotate(${rotate.toFixed(2)} 18 18)"
          stroke-linecap="butt"
        ></circle>
      `
    })
    .join('')

  target.innerHTML = `
    <svg viewBox="0 0 36 36" style="width: 220px; height: 220px;">
      <circle cx="18" cy="18" r="${donutRadius}" fill="none" stroke="var(--line)" stroke-width="${donutStroke}"></circle>
      ${arcs}
      <text x="18" y="17" text-anchor="middle" fill="var(--muted)" font-size="3.2">Impr</text>
      <text x="18" y="21.5" text-anchor="middle" fill="var(--text)" font-size="3.6" font-weight="700">${formatInt(total)}</text>
    </svg>
  `
  legendTarget.innerHTML = items
    .map(
      (item, idx) => `
      <div class="legend-item">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${palette[idx % palette.length]};margin-right:6px;"></span>${item.label}</span>
        <span>${((item.value / total) * 100).toFixed(1)}% · ${formatInt(item.value)}</span>
      </div>
    `
    )
    .join('')
}

function filterAudienceRowsByPlatform(rows, platformFilter) {
  const filter = String(platformFilter || 'all').toLowerCase()
  if (!filter || filter === 'all') return rows
  const expected = filter === 'meta' ? 'meta' : filter === 'google' ? 'google' : filter
  return rows.filter((row) => String(row.platform || '').toLowerCase().startsWith(expected))
}

async function loadAudience(group) {
  if (!metaDateFrom || !metaDateTo) return
  const params = new URLSearchParams()
  params.set('date_from', metaDateFrom.value)
  params.set('date_to', metaDateTo.value)
  const selected = selectedVisualizationAccounts()

  const tasks = []
  tasks.push(
    fetch(`${apiBase}/meta/audience?${params.toString()}&group=${group}${selected.meta ? `&account_id=${selected.meta}` : ''}`, {
      headers: authHeaders(),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('meta failed'))))
      .then((data) => ({ platform: 'Meta', data }))
      .catch(() => ({ platform: 'Meta', data: { accounts: [] } }))
  )

  tasks.push(
    fetch(`${apiBase}/google/audience?${params.toString()}&group=${group}${selected.google ? `&account_id=${selected.google}` : ''}`, {
      headers: authHeaders(),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('google failed'))))
      .then((data) => ({ platform: 'Google', data }))
      .catch(() => ({ platform: 'Google', data: { accounts: [] } }))
  )

  const results = await Promise.all(tasks)
  const rows = []

  results.forEach((result) => {
    result.data.accounts?.forEach((acc) => {
      if (acc.error) {
        rows.push({
          platform: `${result.platform} · ${acc.name || acc.account_id}`,
          segment: `Ошибка: ${acc.error.split('\\n')[0] || acc.error}`,
          impressions: 0,
          clicks: 0,
          spend: 0,
        })
        return
      }
      if (group === 'age_gender') {
        const list = acc.age_gender || []
        list.forEach((row) => {
          rows.push({
            platform: `${result.platform} · ${acc.name || acc.account_id}`,
            segment: result.platform === 'Meta' ? `${row.age} / ${row.gender}` : `${row.age_range} / ${row.gender}`,
            impressions: row.impressions,
            clicks: row.clicks,
            spend: row.spend,
          })
        })
        return
      }
      if (group === 'geo') {
        if (result.platform === 'Meta') {
          const country = acc.country || []
          country.forEach((row) =>
            rows.push({
              platform: `Meta · ${acc.name || acc.account_id}`,
              segment: `Country: ${row.country}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          )
          const region = acc.region || []
          region.forEach((row) =>
            rows.push({
              platform: `Meta · ${acc.name || acc.account_id}`,
              segment: `Region: ${row.region}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          )
        } else {
          const country = acc.country || []
          country.forEach((row) =>
            rows.push({
              platform: `Google · ${acc.name || acc.account_id}`,
              segment: `Country: ${row.geo}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          )
          const region = acc.region || []
          region.forEach((row) =>
            rows.push({
              platform: `Google · ${acc.name || acc.account_id}`,
              segment: `Region: ${row.geo}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          )
          const city = acc.city || []
          city.forEach((row) =>
            rows.push({
              platform: `Google · ${acc.name || acc.account_id}`,
              segment: `City: ${row.geo}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          )
        }
        return
      }
      if (group === 'device') {
        if (result.platform === 'Meta') {
          ;(acc.publisher_platform || []).forEach((row) =>
            rows.push({
              platform: `Meta · ${acc.name || acc.account_id}`,
              segment: `Platform: ${row.publisher_platform}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          )
          ;(acc.platform_position || []).forEach((row) =>
            rows.push({
              platform: `Meta · ${acc.name || acc.account_id}`,
              segment: `Position: ${row.platform_position}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          )
          ;(acc.impression_device || []).forEach((row) =>
            rows.push({
              platform: `Meta · ${acc.name || acc.account_id}`,
              segment: `Device: ${row.impression_device}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          )
          ;(acc.device_platform || []).forEach((row) =>
            rows.push({
              platform: `Meta · ${acc.name || acc.account_id}`,
              segment: `Device platform: ${row.device_platform}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          )
        } else {
          ;(acc.device || []).forEach((row) =>
            rows.push({
              platform: `Google · ${acc.name || acc.account_id}`,
              segment: `Device: ${normalizeGoogleDevice(row.device)}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          )
        }
      }
    })
  })

  return rows
}

function normalizeGoogleDevice(value) {
  if (value == null) return 'Unknown'
  const str = String(value).trim().toUpperCase()
  const map = {
    '0': 'UNSPECIFIED',
    '1': 'UNKNOWN',
    '2': 'MOBILE',
    '3': 'TABLET',
    '4': 'DESKTOP',
    '5': 'OTHER',
    '6': 'CONNECTED_TV',
  }
  if (map[str]) return map[str]
  return str
}

const withGlobalLoading = async (message, fn) => {
  if (window.showGlobalLoading) window.showGlobalLoading(message)
  try {
    await fn()
  } finally {
    if (window.hideGlobalLoading) window.hideGlobalLoading()
  }
}

async function refreshAudienceGroup(group, donutEl, legendEl, platformSelect) {
  const rows = await loadAudience(group)
  const filtered = filterAudienceRowsByPlatform(rows, platformSelect?.value || 'all')
  renderAudienceDonut(donutEl, legendEl, filtered)
  if (audienceStatus) {
    const platformLabel =
      platformSelect?.value === 'meta' ? 'Meta' : platformSelect?.value === 'google' ? 'Google' : 'Все платформы'
    const totalImpressions = filtered.reduce((sum, row) => sum + Number(row.impressions || 0), 0)
    audienceStatus.textContent = `Срез: ${platformLabel} · Период ${metaDateFrom?.value || ''} — ${metaDateTo?.value || ''} · Impr: ${formatInt(totalImpressions)}`
  }
}

async function refreshVisualizationBundle() {
  await Promise.all([
    loadOverview(),
    refreshAudienceGroup('age_gender', audienceAgeDonut, audienceAgeLegend, audienceAgePlatform),
    refreshAudienceGroup('geo', audienceGeoDonut, audienceGeoLegend, audienceGeoPlatform),
    refreshAudienceGroup('device', audienceDeviceDonut, audienceDeviceLegend, audienceDevicePlatform),
  ])
}

if (metaLoad) metaLoad.addEventListener('click', () => withGlobalLoading('Загружаем данные...', loadMetaInsights))
if (googleLoad) googleLoad.addEventListener('click', () => withGlobalLoading('Загружаем данные...', loadGoogleInsights))
if (tiktokLoad) tiktokLoad.addEventListener('click', () => withGlobalLoading('Загружаем данные...', loadTiktokInsights))
if (reportLoad) reportLoad.addEventListener('click', () => withGlobalLoading('Загружаем визуализацию...', refreshVisualizationBundle))
if (reportExport) reportExport.addEventListener('click', () => window.print())
if (audienceAgePlatform) {
  audienceAgePlatform.addEventListener('change', () =>
    withGlobalLoading('Обновляем срез...', async () =>
      refreshAudienceGroup('age_gender', audienceAgeDonut, audienceAgeLegend, audienceAgePlatform)
    )
  )
}
if (audienceGeoPlatform) {
  audienceGeoPlatform.addEventListener('change', () =>
    withGlobalLoading('Обновляем срез...', async () =>
      refreshAudienceGroup('geo', audienceGeoDonut, audienceGeoLegend, audienceGeoPlatform)
    )
  )
}
if (audienceDevicePlatform) {
  audienceDevicePlatform.addEventListener('change', () =>
    withGlobalLoading('Обновляем срез...', async () =>
      refreshAudienceGroup('device', audienceDeviceDonut, audienceDeviceLegend, audienceDevicePlatform)
    )
  )
}
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
