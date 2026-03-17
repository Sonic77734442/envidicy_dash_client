'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import { clearAuth, getAuthToken } from '../../lib/auth'
import AppShell from '../../components/layout/AppShell'

function formatMoney(v, d = 2) {
  return Number(v || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function formatInt(v) {
  return Number(v || 0).toLocaleString('ru-RU')
}

function formatPct(v) {
  return `${(Number(v || 0) * 100).toFixed(2)}%`
}

function dateInput(daysBack = 30) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - daysBack)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function datePickerProps() {
  return {
    inputMode: 'none',
    onKeyDown: (e) => {
      if (e.key !== 'Tab') e.preventDefault()
    },
    onPaste: (e) => e.preventDefault(),
    onFocus: (e) => e.currentTarget.showPicker?.(),
    onClick: (e) => e.currentTarget.showPicker?.(),
  }
}

function platformBadge(platform) {
  const p = String(platform || '').toLowerCase()
  if (p === 'meta') return { cls: 'platform-logo platform-logo--meta', text: 'M' }
  if (p === 'google') return { cls: 'platform-logo platform-logo--google', text: 'G' }
  if (p === 'tiktok') return { cls: 'platform-logo platform-logo--tiktok', text: 'T' }
  return { cls: 'platform-logo', text: 'A' }
}

function buildSummaryCards(summary = {}, withReach = false) {
  const currency = summary.currency || 'USD'
  const cards = [
    { label: 'Spend', value: `${formatMoney(summary.spend || 0)} ${currency}` },
    { label: 'Impr', value: formatInt(summary.impressions || 0) },
    { label: 'Clicks', value: formatInt(summary.clicks || 0) },
    { label: 'CTR', value: formatPct(summary.ctr || 0) },
    { label: 'CPC', value: summary.cpc ? `${formatMoney(summary.cpc)} ${currency}` : '—' },
    { label: 'CPM', value: summary.cpm ? `${formatMoney(summary.cpm)} ${currency}` : '—' },
  ]
  if (withReach) cards.push({ label: 'Reach', value: formatInt(summary.reach || 0) })
  return cards
}

function platformTheme(platform) {
  const p = String(platform || '').toLowerCase()
  if (p === 'meta') return 'dashboard-platform-block dashboard-platform-block--meta'
  if (p === 'google') return 'dashboard-platform-block dashboard-platform-block--google'
  if (p === 'tiktok') return 'dashboard-platform-block dashboard-platform-block--tiktok'
  return 'dashboard-platform-block'
}

function PlatformBlock({
  title,
  platform,
  status,
  rows,
  summary,
  accountId,
  setAccountId,
  accounts,
  onLoad,
  pending,
  dateFrom,
  dateTo,
  setDateFrom,
  setDateTo,
}) {
  const badge = platformBadge(platform)
  const dateProps = datePickerProps()
  const summaryCards = buildSummaryCards(summary, platform === 'Meta')
  return (
    <section className={`panel ${platformTheme(platform)}`}>
      <div className="dashboard-platform-head">
        <div className="platform-title-wrap">
          <span className={badge.cls}>{badge.text}</span>
          <div className="dashboard-platform-title">
            <p className="eyebrow">{platform}</p>
            <h2>{title}</h2>
            <p className="dashboard-platform-subtitle">Live campaign pulse, account filters and campaign-level rollup.</p>
          </div>
        </div>
        <div className="dashboard-platform-status">{status}</div>
      </div>

      <div className="panel-actions dashboard-platform-actions dashboard-platform-controls">
          <input className="field-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} {...dateProps} />
          <input className="field-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} {...dateProps} />
          <select className="field-input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Все аккаунты</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={String(acc.id)}>
                {acc.name || `ID ${acc.id}`}
                {acc.external_id ? ` · ${acc.external_id}` : ''}
              </option>
            ))}
          </select>
          <button className="btn primary" disabled={pending} onClick={onLoad} type="button">
            {pending ? 'Загрузка...' : 'Обновить'}
          </button>
      </div>

      <div className="grid-3 dashboard-kpis">
        {summaryCards.map((card) => (
          <article className="stat dashboard-kpi-card" key={card.label}>
            <p className="eyebrow">Metric</p>
            <h3>{card.label}</h3>
            <div className="stat-value">{card.value}</div>
          </article>
        ))}
      </div>

      <div className="table-wrapper dashboard-table-wrap" style={{ marginTop: 10 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Кампания</th>
              <th>Spend</th>
              <th>CTR</th>
              <th>CPC</th>
              <th>CPM</th>
              <th>Impr</th>
              <th>Clicks</th>
              <th>Conv/Reach</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr>
                <td colSpan={8}>Нет данных</td>
              </tr>
            ) : (
              rows.slice(0, 30).map((row, idx) => (
                <tr key={`${row.campaign_id || row.campaign_name || 'row'}-${idx}`} className="dashboard-campaign-row">
                  <td className="dashboard-campaign-name">{row.campaign_name || row.campaign_id || '—'}</td>
                  <td>
                    {formatMoney(row.spend || 0)} {row.currency || row.account_currency || ''}
                  </td>
                  <td>{formatPct(row.ctr || 0)}</td>
                  <td>{row.cpc ? formatMoney(row.cpc) : '—'}</td>
                  <td>{row.cpm ? formatMoney(row.cpm) : '—'}</td>
                  <td>{formatInt(row.impressions || 0)}</td>
                  <td>{formatInt(row.clicks || 0)}</td>
                  <td>{formatInt(row.conversions || row.reach || 0)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const PALETTE = {
  meta: '#3b82f6',
  google: '#f59e0b',
  tiktok: '#14b8a6',
}

function platformLabel(v) {
  if (v === 'meta') return 'Meta'
  if (v === 'google') return 'Google'
  if (v === 'tiktok') return 'TikTok'
  return 'Платформа'
}

function buildDateRange(startStr, endStr) {
  const out = []
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
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
      if (d.getMonth() === 0 && d.getDate() === 1) ticks.push({ idx, label: String(d.getFullYear()) })
    })
    return ticks.length ? ticks : [{ idx: 0, label: String(start.getFullYear()) }]
  }
  if (rangeDays > 60) {
    const ticks = []
    series.forEach((row, idx) => {
      const d = new Date(row.date)
      if (d.getDate() === 1) ticks.push({ idx, label: d.toLocaleString('ru-RU', { month: 'short' }) })
    })
    return ticks.length ? ticks : [{ idx: 0, label: start.toLocaleString('ru-RU', { month: 'short' }) }]
  }
  const step = rangeDays <= 14 ? 1 : 5
  return series.map((row, idx) => ({ idx, label: row.date.slice(5) })).filter((_, i) => i % step === 0)
}

function aggregateAudienceRows(rows) {
  const grouped = new Map()
  rows.forEach((row) => {
    const key = String(row.segment || '').trim() || 'Unknown'
    const impr = Number(row.impressions || 0)
    const clicks = Number(row.clicks || 0)
    const spend = Number(row.spend || 0)
    const weight = impr > 0 ? impr : clicks > 0 ? clicks : spend > 0 ? spend : 0
    grouped.set(key, (grouped.get(key) || 0) + weight)
  })
  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
}

function Donut({ items, size = 220, centerTop = 'Impr', centerBottom = '' }) {
  const radius = 13
  const stroke = 6
  const total = items.reduce((s, i) => s + i.value, 0)
  if (!total) return <div className="muted">Нет данных</div>

  const circumference = 2 * Math.PI * radius
  let offset = 0
  const colors = ['#3b82f6', '#f59e0b', '#34d399', '#a78bfa', '#ef4444', '#22d3ee', '#f97316', '#10b981']

  return (
    <svg viewBox="0 0 36 36" style={{ width: size, height: size }}>
      <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      {items.map((item, idx) => {
        const length = circumference * (item.value / total)
        const dash = `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`
        const rotate = (offset / circumference) * 360 - 90
        offset += length
        return (
          <circle
            key={`${item.label}-${idx}`}
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke={colors[idx % colors.length]}
            strokeWidth={stroke}
            strokeDasharray={dash}
            transform={`rotate(${rotate.toFixed(2)} 18 18)`}
          />
        )
      })}
      <text x="18" y="17" textAnchor="middle" fill="var(--muted)" fontSize="3.2">{centerTop}</text>
      <text x="18" y="21.5" textAnchor="middle" fill="var(--text)" fontSize="3.6" fontWeight="700">{centerBottom || formatInt(total)}</text>
    </svg>
  )
}

function RingList({ totals }) {
  const totalSpend = Object.keys(PALETTE).reduce((sum, key) => sum + Number(totals?.[key]?.spend || 0), 0)
  if (!totalSpend) return <div className="muted">Нет данных</div>

  return (
    <div className="ring-grid">
      {Object.entries(PALETTE).map(([key, color]) => {
        const spend = Number(totals?.[key]?.spend || 0)
        const percent = totalSpend ? (spend / totalSpend) * 100 : 0
        const radius = 15.915
        const dash = Math.max(0, Math.min(100, percent))
        return (
          <div className="ring" key={key}>
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r={radius} fill="none" stroke="var(--line)" strokeWidth="4" />
              <circle
                cx="18"
                cy="18"
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${100 - dash}`}
                transform="rotate(-90 18 18)"
              />
            </svg>
            <div className="ring-label">{platformLabel(key)}</div>
            <div className="ring-value">{percent.toFixed(1)}% · ${formatMoney(spend)}</div>
          </div>
        )
      })}
    </div>
  )
}

function LineChart({ series }) {
  if (!series.length) return <div className="muted">Нет данных</div>
  const width = 720
  const height = 220
  const pad = 24
  const maxValue = Math.max(1, ...series.map((d) => Math.max(d.spend, d.clicks)))
  const scaleX = (idx) => pad + (idx / (series.length - 1 || 1)) * (width - pad * 2)
  const scaleY = (value) => height - pad - (value / maxValue) * (height - pad * 2)
  const [hoverIdx, setHoverIdx] = useState(series.length - 1)
  const [hoverPos, setHoverPos] = useState(null)

  const spendPath = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.spend)}`).join(' ')
  const clickPath = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.clicks)}`).join(' ')
  const ticks = buildXAxisTicks(series)
  const safeIdx = Math.max(0, Math.min(series.length - 1, hoverIdx))
  const point = series[safeIdx]

  const totalSpend = series.reduce((s, x) => s + Number(x.spend || 0), 0)
  const totalClicks = series.reduce((s, x) => s + Number(x.clicks || 0), 0)

  return (
    <div className="line-chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="line-chart-svg"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const xView = ((event.clientX - rect.left) / rect.width) * width
          const raw = Math.round(((xView - pad) / (width - pad * 2)) * (series.length - 1))
          setHoverIdx(Math.max(0, Math.min(series.length - 1, raw)))
          setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
        }}
        onMouseLeave={() => setHoverPos(null)}
      >
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--line)" strokeWidth="1" />
        <path d={spendPath} fill="none" stroke="#3b82f6" strokeWidth="2" />
        <path d={clickPath} fill="none" stroke="#f59e0b" strokeWidth="2" />
        <circle cx={scaleX(safeIdx)} cy={scaleY(point.spend)} r="4" fill="#3b82f6" />
        {ticks.map((t) => (
          <text key={`${t.idx}-${t.label}`} x={scaleX(t.idx)} y={height - 6} textAnchor="middle" fill="var(--muted)" fontSize="10">
            {t.label}
          </text>
        ))}
      </svg>
      {hoverPos ? (
        <div
          className="chart-tooltip chart-tooltip-floating"
          style={{
            left: Math.min(Math.max(hoverPos.x + 12, 8), width - 220),
            top: Math.min(Math.max(hoverPos.y - 46, 8), height - 56),
          }}
        >
          {point.date}
          <br />
          Spend {formatMoney(point.spend)} · Clicks {formatInt(point.clicks)}
        </div>
      ) : null}
      <div className="legend">
        <div className="legend-item"><span><span className="legend-dot legend-dot-spend" />Spend (итого)</span><span>{formatMoney(totalSpend)}</span></div>
        <div className="legend-item"><span><span className="legend-dot legend-dot-clicks" />Clicks (итого)</span><span>{formatInt(totalClicks)}</span></div>
        <div className="legend-item"><span className="muted">Общая шкала</span></div>
      </div>
    </div>
  )
}

function AccountMetricChart({ series, metricLabel, metricType }) {
  if (!series.length) return <div className="muted">Нет данных</div>
  const width = 720
  const height = 220
  const pad = 24
  const maxValue = Math.max(1, ...series.map((d) => Number(d.value || 0)))
  const scaleX = (idx) => pad + (idx / (series.length - 1 || 1)) * (width - pad * 2)
  const scaleY = (value) => height - pad - (Number(value || 0) / maxValue) * (height - pad * 2)
  const [hoverIdx, setHoverIdx] = useState(series.length - 1)
  const [hoverPos, setHoverPos] = useState(null)
  const ticks = buildXAxisTicks(series)
  const safeIdx = Math.max(0, Math.min(series.length - 1, hoverIdx))
  const point = series[safeIdx]
  const lineColor = metricType === 'impressions' ? '#22d3ee' : metricType === 'clicks' ? '#f59e0b' : '#3b82f6'
  const path = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.value)}`).join(' ')
  const totalValue = series.reduce((sum, row) => sum + Number(row.value || 0), 0)
  const valueText = metricType === 'spend' ? formatMoney(totalValue) : formatInt(totalValue)
  const pointText = metricType === 'spend' ? formatMoney(point.value) : formatInt(point.value)

  return (
    <div className="line-chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="line-chart-svg"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const xView = ((event.clientX - rect.left) / rect.width) * width
          const raw = Math.round(((xView - pad) / (width - pad * 2)) * (series.length - 1))
          setHoverIdx(Math.max(0, Math.min(series.length - 1, raw)))
          setHoverPos({ x: event.clientX - rect.left, y: event.clientY - rect.top })
        }}
        onMouseLeave={() => setHoverPos(null)}
      >
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="var(--line)" strokeWidth="1" />
        <path d={path} fill="none" stroke={lineColor} strokeWidth="2.5" />
        <circle cx={scaleX(safeIdx)} cy={scaleY(point.value)} r="4" fill={lineColor} />
        {ticks.map((t) => (
          <text key={`${t.idx}-${t.label}`} x={scaleX(t.idx)} y={height - 6} textAnchor="middle" fill="var(--muted)" fontSize="10">
            {t.label}
          </text>
        ))}
      </svg>
      {hoverPos ? (
        <div
          className="chart-tooltip chart-tooltip-floating"
          style={{
            left: Math.min(Math.max(hoverPos.x + 12, 8), width - 220),
            top: Math.min(Math.max(hoverPos.y - 46, 8), height - 56),
          }}
        >
          {point.date}
          <br />
          {metricLabel} {pointText}
        </div>
      ) : null}
      <div className="legend">
        <div className="legend-item"><span>{metricLabel} (итого)</span><span>{valueText}</span></div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const initialDates = useMemo(() => dateInput(30), [])
  const [metaDateFrom, setMetaDateFrom] = useState(initialDates.from)
  const [metaDateTo, setMetaDateTo] = useState(initialDates.to)
  const [googleDateFrom, setGoogleDateFrom] = useState(initialDates.from)
  const [googleDateTo, setGoogleDateTo] = useState(initialDates.to)
  const [tiktokDateFrom, setTiktokDateFrom] = useState(initialDates.from)
  const [tiktokDateTo, setTiktokDateTo] = useState(initialDates.to)
  const [vizDateFrom, setVizDateFrom] = useState(initialDates.from)
  const [vizDateTo, setVizDateTo] = useState(initialDates.to)

  const [accounts, setAccounts] = useState([])
  const [accountsStatus, setAccountsStatus] = useState('')
  const [deepLinkApplied, setDeepLinkApplied] = useState(false)
  const [metaAccount, setMetaAccount] = useState('')
  const [googleAccount, setGoogleAccount] = useState('')
  const [tiktokAccount, setTiktokAccount] = useState('')

  const [vizMetaAccount, setVizMetaAccount] = useState('')
  const [vizGoogleAccount, setVizGoogleAccount] = useState('')
  const [vizTiktokAccount, setVizTiktokAccount] = useState('')

  const [meta, setMeta] = useState({ status: 'Ожидание загрузки', summary: {}, rows: [], pending: false })
  const [google, setGoogle] = useState({ status: 'Ожидание загрузки', summary: {}, rows: [], pending: false })
  const [tiktok, setTiktok] = useState({ status: 'Ожидание загрузки', summary: {}, rows: [], pending: false })

  const [overview, setOverview] = useState({ status: 'Ожидание загрузки', totals: {}, daily: {}, daily_by_account: {} })
  const [accountTrendPlatform, setAccountTrendPlatform] = useState('meta')
  const [accountTrendAccountId, setAccountTrendAccountId] = useState('')
  const [accountTrendMetric, setAccountTrendMetric] = useState('impressions')
  const [initialLoadStarted, setInitialLoadStarted] = useState(false)
  const [exportPending, setExportPending] = useState(false)

  const [audienceAgePlatform, setAudienceAgePlatform] = useState('all')
  const [audienceGeoPlatform, setAudienceGeoPlatform] = useState('all')
  const [audienceGeoLevel, setAudienceGeoLevel] = useState('country')
  const [audienceDevicePlatform, setAudienceDevicePlatform] = useState('all')
  const [audienceAgeRows, setAudienceAgeRows] = useState([])
  const [audienceGeoRows, setAudienceGeoRows] = useState([])
  const [audienceDeviceRows, setAudienceDeviceRows] = useState([])
  const [audienceStatus, setAudienceStatus] = useState('')

  const metaAccounts = useMemo(
    () => accounts.filter((acc) => String(acc.platform || '').toLowerCase().trim() === 'meta'),
    [accounts]
  )
  const googleAccounts = useMemo(
    () => accounts.filter((acc) => String(acc.platform || '').toLowerCase().trim() === 'google'),
    [accounts]
  )
  const tiktokAccounts = useMemo(
    () => accounts.filter((acc) => String(acc.platform || '').toLowerCase().trim() === 'tiktok'),
    [accounts]
  )

  const spendDonutItems = useMemo(() => {
    const totals = overview.totals || {}
    return Object.entries(PALETTE)
      .map(([key]) => ({ key, label: platformLabel(key), value: Number(totals?.[key]?.spend || 0) }))
      .filter((x) => x.value > 0)
  }, [overview.totals])

  const lineSeries = useMemo(() => {
    const range = buildDateRange(vizDateFrom, vizDateTo)
    const daily = overview.daily || {}
    return range.map((date) => {
      const m = (daily.meta || []).find((row) => row.date === date) || {}
      const g = (daily.google || []).find((row) => row.date === date) || {}
      const t = (daily.tiktok || []).find((row) => row.date === date) || {}
      return {
        date,
        spend: Number(m.spend || 0) + Number(g.spend || 0) + Number(t.spend || 0),
        clicks: Number(m.clicks || 0) + Number(g.clicks || 0) + Number(t.clicks || 0),
      }
    })
  }, [overview.daily, vizDateFrom, vizDateTo])

  const accountTrendAccounts = useMemo(() => {
    const rows = overview?.daily_by_account?.[accountTrendPlatform] || []
    return Array.isArray(rows) ? rows : []
  }, [overview?.daily_by_account, accountTrendPlatform])

  useEffect(() => {
    if (!accountTrendAccounts.length) {
      setAccountTrendAccountId('')
      return
    }
    const exists = accountTrendAccounts.some((row) => String(row.account_id) === String(accountTrendAccountId))
    if (!exists) {
      setAccountTrendAccountId(String(accountTrendAccounts[0].account_id))
    }
  }, [accountTrendAccounts, accountTrendAccountId])

  const accountTrendSeries = useMemo(() => {
    const range = buildDateRange(vizDateFrom, vizDateTo)
    const selected = accountTrendAccounts.find((row) => String(row.account_id) === String(accountTrendAccountId))
    const daily = selected?.daily || []
    return range.map((date) => {
      const point = daily.find((row) => row.date === date) || {}
      return {
        date,
        value: Number(point?.[accountTrendMetric] || 0),
      }
    })
  }, [vizDateFrom, vizDateTo, accountTrendAccounts, accountTrendAccountId, accountTrendMetric])

  const accountTrendMetricLabel =
    accountTrendMetric === 'clicks' ? 'Клики' : accountTrendMetric === 'spend' ? 'Расход' : 'Показы'

  async function exportDashboardPdf() {
    if (exportPending) return
    setExportPending(true)
    try {
      const params = new URLSearchParams()
      params.set('date_from', vizDateFrom)
      params.set('date_to', vizDateTo)
      params.set('meta_date_from', metaDateFrom)
      params.set('meta_date_to', metaDateTo)
      params.set('google_date_from', googleDateFrom)
      params.set('google_date_to', googleDateTo)
      params.set('tiktok_date_from', tiktokDateFrom)
      params.set('tiktok_date_to', tiktokDateTo)
      if (vizMetaAccount || metaAccount) params.set('meta_account_id', vizMetaAccount || metaAccount)
      if (vizGoogleAccount || googleAccount) params.set('google_account_id', vizGoogleAccount || googleAccount)
      if (vizTiktokAccount || tiktokAccount) params.set('tiktok_account_id', vizTiktokAccount || tiktokAccount)
      if (metaAccount) params.set('meta_platform_account_id', metaAccount)
      if (googleAccount) params.set('google_platform_account_id', googleAccount)
      if (tiktokAccount) params.set('tiktok_platform_account_id', tiktokAccount)
      params.set('audience_age_platform', audienceAgePlatform)
      params.set('audience_geo_platform', audienceGeoPlatform)
      params.set('audience_geo_level', audienceGeoLevel)
      params.set('audience_device_platform', audienceDevicePlatform)
      params.set('account_trend_platform', accountTrendPlatform)
      params.set('account_trend_metric', accountTrendMetric)
      if (accountTrendAccountId) params.set('account_trend_account_id', accountTrendAccountId)

      const res = await safeFetch(`/dashboard/export/pdf?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || 'Не удалось сформировать PDF')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `dashboard-${vizDateFrom}-${vizDateTo}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      alert(e?.message || 'Не удалось сформировать PDF')
    } finally {
      setExportPending(false)
    }
  }

  function filterAudienceRowsByPlatform(rows, platformFilter) {
    const filter = String(platformFilter || 'all').toLowerCase()
    if (!filter || filter === 'all') return rows
    return rows.filter((row) => String(row.platform || '').toLowerCase().startsWith(filter))
  }

  function filterAudienceGeoRowsByLevel(rows, level) {
    const normalized = String(level || 'country').toLowerCase()
    const prefix = normalized === 'city' ? 'City:' : normalized === 'region' ? 'Region:' : 'Country:'
    return rows.filter((row) => String(row.segment || '').startsWith(prefix))
  }

  const audienceAgeItems = useMemo(
    () => aggregateAudienceRows(filterAudienceRowsByPlatform(audienceAgeRows, audienceAgePlatform)),
    [audienceAgeRows, audienceAgePlatform]
  )
  const audienceGeoItems = useMemo(
    () =>
      aggregateAudienceRows(
        filterAudienceGeoRowsByLevel(filterAudienceRowsByPlatform(audienceGeoRows, audienceGeoPlatform), audienceGeoLevel)
      ),
    [audienceGeoRows, audienceGeoPlatform, audienceGeoLevel]
  )
  const audienceDeviceItems = useMemo(
    () => aggregateAudienceRows(filterAudienceRowsByPlatform(audienceDeviceRows, audienceDevicePlatform)),
    [audienceDeviceRows, audienceDevicePlatform]
  )

  async function safeFetch(path) {
    const res = await apiFetch(path, { headers: authHeaders() })
    if (res.status === 401) {
      clearAuth()
      router.push('/login')
      throw new Error('Unauthorized')
    }
    return res
  }

  async function loadAccounts() {
    try {
      setAccountsStatus('Загрузка аккаунтов...')
      const res = await safeFetch('/accounts')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || `Не удалось загрузить аккаунты (${res.status})`)
      }
      const data = await res.json()
      setAccounts(Array.isArray(data) ? data : [])
      setAccountsStatus('Аккаунты загружены.')
    } catch (e) {
      setAccounts([])
      setAccountsStatus(e?.message || 'Ошибка загрузки аккаунтов.')
      setMeta((s) => ({ ...s, status: e?.message || s.status }))
      setGoogle((s) => ({ ...s, status: e?.message || s.status }))
      setTiktok((s) => ({ ...s, status: e?.message || s.status }))
    }
  }

  function buildParams(accountId, dateFrom, dateTo) {
    const params = new URLSearchParams()
    params.set('date_from', dateFrom)
    params.set('date_to', dateTo)
    if (accountId) params.set('account_id', accountId)
    return params
  }

  async function loadMeta() {
    setMeta((s) => ({ ...s, pending: true, status: 'Загрузка...' }))
    try {
      const res = await safeFetch(`/meta/insights?${buildParams(metaAccount, metaDateFrom, metaDateTo).toString()}`)
      if (!res.ok) throw new Error('Ошибка загрузки Meta Insights')
      const data = await res.json()
      setMeta({ pending: false, status: 'Данные обновлены.', summary: data.summary || {}, rows: data.campaigns || [] })
    } catch (e) {
      setMeta({ pending: false, status: e?.message || 'Ошибка загрузки Meta Insights', summary: {}, rows: [] })
    }
  }

  async function loadGoogle() {
    setGoogle((s) => ({ ...s, pending: true, status: 'Загрузка...' }))
    try {
      const res = await safeFetch(`/google/insights?${buildParams(googleAccount, googleDateFrom, googleDateTo).toString()}`)
      if (!res.ok) throw new Error('Ошибка загрузки Google Ads')
      const data = await res.json()
      setGoogle({ pending: false, status: 'Данные обновлены.', summary: data.summary || {}, rows: data.campaigns || [] })
    } catch (e) {
      setGoogle({ pending: false, status: e?.message || 'Ошибка загрузки Google Ads', summary: {}, rows: [] })
    }
  }

  async function loadTiktok() {
    setTiktok((s) => ({ ...s, pending: true, status: 'Загрузка...' }))
    try {
      const res = await safeFetch(`/tiktok/insights?${buildParams(tiktokAccount, tiktokDateFrom, tiktokDateTo).toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || 'Ошибка загрузки TikTok Ads')
      }
      const data = await res.json()
      setTiktok({ pending: false, status: 'Данные обновлены.', summary: data.summary || {}, rows: data.campaigns || [] })
    } catch (e) {
      setTiktok({ pending: false, status: e?.message || 'Ошибка загрузки TikTok Ads', summary: {}, rows: [] })
    }
  }

  async function loadOverview() {
    setOverview((s) => ({ ...s, status: 'Загрузка отчета...' }))
    const params = new URLSearchParams()
    params.set('date_from', vizDateFrom)
    params.set('date_to', vizDateTo)
    if (vizMetaAccount || metaAccount) params.set('meta_account_id', vizMetaAccount || metaAccount)
    if (vizGoogleAccount || googleAccount) params.set('google_account_id', vizGoogleAccount || googleAccount)
    if (vizTiktokAccount || tiktokAccount) params.set('tiktok_account_id', vizTiktokAccount || tiktokAccount)
    try {
      const res = await safeFetch(`/insights/overview?${params.toString()}`)
      if (!res.ok) throw new Error('Ошибка загрузки overview')
      const data = await res.json()
      setOverview({
        status: 'Отчет обновлен.',
        totals: data.totals || {},
        daily: data.daily || {},
        daily_by_account: data.daily_by_account || {},
      })
    } catch (e) {
      setOverview({ status: e?.message || 'Ошибка загрузки overview', totals: {}, daily: {}, daily_by_account: {} })
    }
  }

  async function loadAudience(group) {
    const params = new URLSearchParams()
    params.set('date_from', vizDateFrom)
    params.set('date_to', vizDateTo)
    const selectedMeta = vizMetaAccount || metaAccount
    const selectedGoogle = vizGoogleAccount || googleAccount

    const [metaResp, googleResp] = await Promise.all([
      safeFetch(`/meta/audience?${params.toString()}&group=${group}${selectedMeta ? `&account_id=${selectedMeta}` : ''}`).catch(() => null),
      safeFetch(`/google/audience?${params.toString()}&group=${group}${selectedGoogle ? `&account_id=${selectedGoogle}` : ''}`).catch(() => null),
    ])

    const rows = []
    const errors = []

    const parsePayload = async (resp, platform) => {
      if (!resp) {
        errors.push(`${platform}: запрос не выполнен`)
        return
      }
      if (!resp.ok) {
        errors.push(`${platform}: ${resp.status}`)
        return
      }
      const data = await resp.json().catch(() => ({ accounts: [] }))
      ;(data.accounts || []).forEach((acc) => {
        if (acc?.error) {
          const accName = acc.name || acc.account_id || platform
          errors.push(`${platform} · ${accName}: ${acc.error}`)
          return
        }
        if (group === 'age_gender') {
          ;(acc.age_gender || []).forEach((row) => {
            rows.push({
              platform: platform.toLowerCase(),
              segment: platform === 'Meta' ? `${row.age} / ${row.gender}` : `${row.age_range} / ${row.gender}`,
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
            })
          })
        }
        if (group === 'geo') {
          if (platform === 'Meta') {
            ;(acc.country || []).forEach((row) => rows.push({ platform: 'meta', segment: `Country: ${row.country}`, impressions: row.impressions, clicks: row.clicks, spend: row.spend }))
            ;(acc.region || []).forEach((row) => rows.push({ platform: 'meta', segment: `Region: ${row.region}`, impressions: row.impressions, clicks: row.clicks, spend: row.spend }))
          } else {
            ;(acc.country || []).forEach((row) => rows.push({ platform: 'google', segment: `Country: ${row.geo}`, impressions: row.impressions, clicks: row.clicks, spend: row.spend }))
            ;(acc.region || []).forEach((row) => rows.push({ platform: 'google', segment: `Region: ${row.geo}`, impressions: row.impressions, clicks: row.clicks, spend: row.spend }))
            ;(acc.city || []).forEach((row) => rows.push({ platform: 'google', segment: `City: ${row.geo}`, impressions: row.impressions, clicks: row.clicks, spend: row.spend }))
          }
        }
        if (group === 'device') {
          if (platform === 'Meta') {
            ;(acc.impression_device || []).forEach((row) => rows.push({ platform: 'meta', segment: `Device: ${row.impression_device}`, impressions: row.impressions, clicks: row.clicks, spend: row.spend }))
            ;(acc.device_platform || []).forEach((row) => rows.push({ platform: 'meta', segment: `Device platform: ${row.device_platform}`, impressions: row.impressions, clicks: row.clicks, spend: row.spend }))
          } else {
            ;(acc.device || []).forEach((row) => rows.push({ platform: 'google', segment: `Device: ${row.device}`, impressions: row.impressions, clicks: row.clicks, spend: row.spend }))
          }
        }
      })
    }

    await Promise.all([parsePayload(metaResp, 'Meta'), parsePayload(googleResp, 'Google')])
    return { rows, errors }
  }

  async function refreshVisualizationBundle() {
    setAudienceStatus('Загрузка визуализации...')
    try {
      const [ageData, geoData, deviceData] = await Promise.all([
        loadAudience('age_gender'),
        loadAudience('geo'),
        loadAudience('device'),
        loadOverview(),
      ])
      setAudienceAgeRows(ageData.rows)
      setAudienceGeoRows(geoData.rows)
      setAudienceDeviceRows(deviceData.rows)

      const allErrors = [...ageData.errors, ...geoData.errors, ...deviceData.errors]
      if (allErrors.length) {
        console.warn('Audience data warnings:', allErrors)
      }
      setAudienceStatus(`Срез: Период ${vizDateFrom} — ${vizDateTo}`)
    } catch {
      setAudienceStatus('Ошибка загрузки срезов аудитории.')
    }
  }

  async function reloadAll() {
    await Promise.all([loadMeta(), loadGoogle(), loadTiktok(), refreshVisualizationBundle()])
  }

  useEffect(() => {
    loadAccounts()
    if (!initialLoadStarted) {
      setInitialLoadStarted(true)
      reloadAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoadStarted])

  useEffect(() => {
    if (deepLinkApplied || !accounts.length) return
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    const deepLinkPlatform = String(params.get('platform') || '').toLowerCase()
    const deepLinkAccountId = String(params.get('account_id') || '')
    if (!deepLinkPlatform || !deepLinkAccountId) return

    if (deepLinkPlatform === 'meta') {
      const exists = metaAccounts.some((a) => String(a.id) === deepLinkAccountId)
      if (exists) {
        setMetaAccount(deepLinkAccountId)
        setVizMetaAccount(deepLinkAccountId)
        setTimeout(() => { loadMeta() }, 0)
      }
    } else if (deepLinkPlatform === 'google') {
      const exists = googleAccounts.some((a) => String(a.id) === deepLinkAccountId)
      if (exists) {
        setGoogleAccount(deepLinkAccountId)
        setVizGoogleAccount(deepLinkAccountId)
        setTimeout(() => { loadGoogle() }, 0)
      }
    } else if (deepLinkPlatform === 'tiktok') {
      const exists = tiktokAccounts.some((a) => String(a.id) === deepLinkAccountId)
      if (exists) {
        setTiktokAccount(deepLinkAccountId)
        setVizTiktokAccount(deepLinkAccountId)
        setTimeout(() => { loadTiktok() }, 0)
      }
    }

    setDeepLinkApplied(true)
  }, [accounts, deepLinkApplied, metaAccounts, googleAccounts, tiktokAccounts])

  const audienceAgeTotal = audienceAgeItems.reduce((s, x) => s + x.value, 0)
  const dateProps = datePickerProps()
  const totalAccounts = accounts.length
  const totalSpend = Object.values(overview.totals || {}).reduce((sum, item) => sum + Number(item?.spend || 0), 0)
  const totalImpressions = Object.values(overview.totals || {}).reduce((sum, item) => sum + Number(item?.impressions || 0), 0)
  const totalClicks = Object.values(overview.totals || {}).reduce((sum, item) => sum + Number(item?.clicks || 0), 0)
  const activePlatforms = Object.values(overview.totals || {}).filter((item) => Number(item?.spend || 0) > 0).length
  const selectedWindow = `${vizDateFrom} - ${vizDateTo}`
  const heroCards = [
    { label: 'Расход', value: `$${formatMoney(totalSpend)}`, note: 'По всем подключенным платформам' },
    { label: 'Показы', value: formatInt(totalImpressions), note: 'Охват и доставка за выбранный период' },
    { label: 'Клики', value: formatInt(totalClicks), note: 'Единый срез по трафику со всех платформ' },
    { label: 'Аккаунты', value: formatInt(totalAccounts), note: `${activePlatforms}/3 платформ активны в сводке` },
  ]

  return (
    <AppShell
      eyebrow="Envidicy · Insights"
      title="Универсальный дашборд"
      subtitle="Сводка по подключенным рекламным кабинетам."
    >
      <section className="dashboard-hero panel">
        <div className="dashboard-hero-grid">
          <div className="dashboard-hero-main">
            <p className="eyebrow">Общий обзор</p>
            <h1>Дашборд эффективности по всем платформам</h1>
            <p className="dashboard-hero-copy">
              Единый обзор Meta, Google и TikTok с быстрым доступом к spend, delivery, кликам и аудитории за выбранный период.
            </p>
            <div className="dashboard-hero-actions">
              <button className="btn primary" onClick={exportDashboardPdf} type="button">
                {exportPending ? 'Готовим PDF...' : 'Скачать статистику'}
              </button>
            </div>
            <div className="dashboard-hero-pills">
              <span className="chip chip-ghost">Период: {selectedWindow}</span>
              <span className="chip chip-ghost">Аккаунты: {formatInt(totalAccounts)}</span>
              <span className="chip chip-ghost">Сводка: {overview.status}</span>
            </div>
          </div>
          <div className="dashboard-hero-side">
            <div className="dashboard-hero-side-card">
              <p className="eyebrow">Состояние системы</p>
              <div className="dashboard-hero-side-row">
                <span>Синхронизация аккаунтов</span>
                <strong>{accountsStatus || 'В работе'}</strong>
              </div>
              <div className="dashboard-hero-side-row">
                <span>Срезы аудитории</span>
                <strong>{audienceStatus || 'Готово к загрузке'}</strong>
              </div>
              <div className="dashboard-hero-side-row">
                <span>Активные платформы</span>
                <strong>{activePlatforms}/3</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-hero-stats">
          {heroCards.map((card) => (
            <article className="dashboard-hero-stat" key={card.label}>
              <p className="eyebrow">{card.label}</p>
              <h3>{card.value}</h3>
              <p>{card.note}</p>
            </article>
          ))}
        </div>
      </section>

      <PlatformBlock
        title="Meta Insights"
        platform="Meta"
        status={meta.status}
        rows={meta.rows}
        summary={meta.summary}
        accountId={metaAccount}
        setAccountId={setMetaAccount}
        accounts={metaAccounts}
        onLoad={loadMeta}
        pending={meta.pending}
        dateFrom={metaDateFrom}
        dateTo={metaDateTo}
        setDateFrom={setMetaDateFrom}
        setDateTo={setMetaDateTo}
      />

      <PlatformBlock
        title="Google Insights"
        platform="Google"
        status={google.status}
        rows={google.rows}
        summary={google.summary}
        accountId={googleAccount}
        setAccountId={setGoogleAccount}
        accounts={googleAccounts}
        onLoad={loadGoogle}
        pending={google.pending}
        dateFrom={googleDateFrom}
        dateTo={googleDateTo}
        setDateFrom={setGoogleDateFrom}
        setDateTo={setGoogleDateTo}
      />

      <PlatformBlock
        title="TikTok Insights"
        platform="TikTok"
        status={tiktok.status}
        rows={tiktok.rows}
        summary={tiktok.summary}
        accountId={tiktokAccount}
        setAccountId={setTiktokAccount}
        accounts={tiktokAccounts}
        onLoad={loadTiktok}
        pending={tiktok.pending}
        dateFrom={tiktokDateFrom}
        dateTo={tiktokDateTo}
        setDateFrom={setTiktokDateFrom}
        setDateTo={setTiktokDateTo}
      />

      <section className="panel dashboard-analytics-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Визуализация</p>
            <h2>Доли и динамика</h2>
          </div>
          <div className="panel-actions">
            <button className="btn primary" onClick={reloadAll} type="button">Обновить всё</button>
            <span className="chip chip-ghost">Charts</span>
          </div>
        </div>

        <div className="chart-grid">
          <div className="chart-card chart-card-hero">
            <div className="chart-head">
              <p className="eyebrow">KPI кольца</p>
              <div className="panel-actions">
                <input className="field-input" type="date" value={vizDateFrom} onChange={(e) => setVizDateFrom(e.target.value)} {...dateProps} />
                <input className="field-input" type="date" value={vizDateTo} onChange={(e) => setVizDateTo(e.target.value)} {...dateProps} />
                <select className="field-input" value={vizMetaAccount} onChange={(e) => setVizMetaAccount(e.target.value)}>
                  <option value="">Meta: все аккаунты</option>
                  {metaAccounts.map((acc) => <option key={acc.id} value={String(acc.id)}>{acc.name || `ID ${acc.id}`}</option>)}
                </select>
                <select className="field-input" value={vizGoogleAccount} onChange={(e) => setVizGoogleAccount(e.target.value)}>
                  <option value="">Google: все аккаунты</option>
                  {googleAccounts.map((acc) => <option key={acc.id} value={String(acc.id)}>{acc.name || `ID ${acc.id}`}</option>)}
                </select>
                <select className="field-input" value={vizTiktokAccount} onChange={(e) => setVizTiktokAccount(e.target.value)}>
                  <option value="">TikTok: все аккаунты</option>
                  {tiktokAccounts.map((acc) => <option key={acc.id} value={String(acc.id)}>{acc.name || `ID ${acc.id}`}</option>)}
                </select>
                <button className="btn ghost" onClick={refreshVisualizationBundle} type="button">Обновить</button>
                <button className="btn ghost" onClick={exportDashboardPdf} type="button" disabled={exportPending}>
                  {exportPending ? 'Готовим PDF...' : 'Экспорт PDF'}
                </button>
              </div>
            </div>
            <RingList totals={overview.totals || {}} />
          </div>

          <div className="chart-card chart-card-hero">
            <p className="eyebrow">Доля расходов</p>
            <div className="chart-donut">
              <Donut items={spendDonutItems} size={220} centerTop="Spend" />
            </div>
            <div className="legend">
              {spendDonutItems.map((x) => {
                const total = spendDonutItems.reduce((s, i) => s + i.value, 0)
                return (
                  <div className="legend-item" key={x.key}>
                    <span>{x.label}</span>
                    <span>{formatMoney(x.value)} · {total ? ((x.value / total) * 100).toFixed(1) : '0.0'}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <p className="muted small" style={{ marginTop: 12 }}>{overview.status}</p>
        {accountsStatus ? <p className="muted small">{accountsStatus}</p> : null}

        <div className="chart-card" style={{ marginTop: 12 }}>
          <div className="chart-head">
            <p className="eyebrow">Динамика по дням</p>
            <div className="chip chip-ghost">Spend vs Clicks</div>
          </div>
          <div className="chart-line">
            <LineChart series={lineSeries} />
          </div>
        </div>

        <div className="chart-card" style={{ marginTop: 12 }}>
          <div className="chart-head">
            <p className="eyebrow">Динамика по аккаунту</p>
            <div className="panel-actions">
              <select className="field-input" value={accountTrendPlatform} onChange={(e) => setAccountTrendPlatform(e.target.value)}>
                <option value="meta">Meta</option>
                <option value="google">Google</option>
                <option value="tiktok">TikTok</option>
              </select>
              <select className="field-input" value={accountTrendAccountId} onChange={(e) => setAccountTrendAccountId(e.target.value)}>
                {!accountTrendAccounts.length ? <option value="">Нет аккаунтов</option> : null}
                {accountTrendAccounts.map((row) => (
                  <option key={`${row.platform}-${row.account_id}`} value={String(row.account_id)}>
                    {row.name}
                  </option>
                ))}
              </select>
              <select className="field-input" value={accountTrendMetric} onChange={(e) => setAccountTrendMetric(e.target.value)}>
                <option value="impressions">Показы</option>
                <option value="clicks">Клики</option>
                <option value="spend">Расход</option>
              </select>
            </div>
          </div>
          <div className="chart-line">
            <AccountMetricChart series={accountTrendSeries} metricLabel={accountTrendMetricLabel} metricType={accountTrendMetric} />
          </div>
        </div>

        <div className="chart-grid" style={{ marginTop: 12 }}>
          <div className="chart-card">
            <div className="chart-head">
              <p className="eyebrow">Аудитория · Возраст / Пол</p>
              <div className="panel-actions">
                <select className="field-input" value={audienceAgePlatform} onChange={(e) => setAudienceAgePlatform(e.target.value)}>
                  <option value="all">Все платформы</option>
                  <option value="meta">Meta</option>
                  <option value="google">Google</option>
                </select>
              </div>
            </div>
            <div className="chart-donut">
              <Donut items={audienceAgeItems} size={220} centerTop="Impr" centerBottom={formatInt(audienceAgeTotal)} />
            </div>
            <div className="legend">
              {audienceAgeItems.map((x) => (
                <div className="legend-item" key={x.label}>
                  <span>{x.label}</span>
                  <span>{x.value > 0 && audienceAgeTotal > 0 ? ((x.value / audienceAgeTotal) * 100).toFixed(1) : '0.0'}% · {formatInt(x.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-head">
              <p className="eyebrow">Аудитория · Гео</p>
              <div className="panel-actions">
                <select className="field-input" value={audienceGeoPlatform} onChange={(e) => setAudienceGeoPlatform(e.target.value)}>
                  <option value="all">Все платформы</option>
                  <option value="meta">Meta</option>
                  <option value="google">Google</option>
                </select>
                <select className="field-input" value={audienceGeoLevel} onChange={(e) => setAudienceGeoLevel(e.target.value)}>
                  <option value="country">Страны</option>
                  <option value="region">Регионы</option>
                  <option value="city">Города</option>
                </select>
              </div>
            </div>
            <div className="chart-donut"><Donut items={audienceGeoItems} size={220} centerTop="Impr" /></div>
            <div className="legend">
              {audienceGeoItems.map((x) => {
                const total = audienceGeoItems.reduce((s, i) => s + i.value, 0)
                return (
                  <div className="legend-item" key={x.label}>
                    <span>{x.label}</span>
                    <span>{total ? ((x.value / total) * 100).toFixed(1) : '0.0'}% · {formatInt(x.value)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-head">
              <p className="eyebrow">Аудитория · Девайсы</p>
              <div className="panel-actions">
                <select className="field-input" value={audienceDevicePlatform} onChange={(e) => setAudienceDevicePlatform(e.target.value)}>
                  <option value="all">Все платформы</option>
                  <option value="meta">Meta</option>
                  <option value="google">Google</option>
                </select>
              </div>
            </div>
            <div className="chart-donut"><Donut items={audienceDeviceItems} size={220} centerTop="Impr" /></div>
            <div className="legend">
              {audienceDeviceItems.map((x) => {
                const total = audienceDeviceItems.reduce((s, i) => s + i.value, 0)
                return (
                  <div className="legend-item" key={x.label}>
                    <span>{x.label}</span>
                    <span>{total ? ((x.value / total) * 100).toFixed(1) : '0.0'}% · {formatInt(x.value)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <p className="muted small" style={{ marginTop: 12 }}>
          {audienceStatus || `Доли аудитории считаются по impressions за выбранный период.`}
        </p>
      </section>
    </AppShell>
  )
}
