export function formatMoney(v, d = 2) {
  return Number(v || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

export function formatInt(v) {
  return Number(v || 0).toLocaleString('ru-RU')
}

export function formatPct(v) {
  return `${(Number(v || 0) * 100).toFixed(2)}%`
}

export function dateInput(daysBack = 30) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - daysBack)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

export function datePickerProps() {
  const openPicker = (event) => {
    const input = event.currentTarget
    if (typeof input?.showPicker !== 'function') return
    try {
      input.showPicker()
    } catch (_error) {
      // Some browsers require a stricter user-gesture context; ignore and let native date input work.
    }
  }

  return {
    inputMode: 'none',
    onKeyDown: (e) => {
      if (e.key !== 'Tab') e.preventDefault()
    },
    onPaste: (e) => e.preventDefault(),
    onFocus: openPicker,
    onClick: openPicker,
  }
}

export function platformBadge(platform) {
  const p = String(platform || '').toLowerCase()
  if (p === 'meta') return { cls: 'platform-logo platform-logo--meta', text: 'M' }
  if (p === 'google') return { cls: 'platform-logo platform-logo--google', text: 'G' }
  if (p === 'tiktok') return { cls: 'platform-logo platform-logo--tiktok', text: 'T' }
  return { cls: 'platform-logo', text: 'A' }
}

export function buildSummaryCards(summary = {}, withReach = false) {
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

export function platformTheme(platform) {
  const p = String(platform || '').toLowerCase()
  if (p === 'meta') return 'dashboard-platform-block dashboard-platform-block--meta'
  if (p === 'google') return 'dashboard-platform-block dashboard-platform-block--google'
  if (p === 'tiktok') return 'dashboard-platform-block dashboard-platform-block--tiktok'
  return 'dashboard-platform-block'
}

export const PALETTE = {
  meta: '#3b82f6',
  google: '#f59e0b',
  tiktok: '#14b8a6',
}

export function platformLabel(v) {
  if (v === 'meta') return 'Meta'
  if (v === 'google') return 'Google'
  if (v === 'tiktok') return 'TikTok'
  return 'Платформа'
}

export function buildDateRange(startStr, endStr) {
  const out = []
  const start = new Date(startStr)
  const end = new Date(endStr)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function buildXAxisTicks(series) {
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

export function aggregateAudienceRows(rows) {
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
