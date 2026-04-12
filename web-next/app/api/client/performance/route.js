import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../lib/api'

export const dynamic = 'force-dynamic'
const SUPPORTED_PLATFORMS = new Set(['google', 'meta', 'tiktok'])

function apiBase() {
  return getApiBase().replace(/\/$/, '')
}

function authHeader(request) {
  return (request.headers.get('authorization') || '').trim()
}

async function upstreamFetch(path, auth) {
  return fetch(`${apiBase()}${path}`, {
    headers: auth ? { Authorization: auth } : {},
    cache: 'no-store',
  })
}

function useDbFinanceRead() {
  return String(process.env.FINANCE_READ_FROM_DB || '').trim() === '1'
}

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function formatDateKey(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateRange(days) {
  const to = startOfDay(new Date())
  const from = new Date(to)
  from.setDate(from.getDate() - (days - 1))
  return {
    from,
    to,
    fromStr: formatDateKey(from),
    toStr: formatDateKey(to),
  }
}

function previousRangeFor(current, days) {
  const to = new Date(current.from)
  to.setDate(to.getDate() - 1)
  const from = new Date(to)
  from.setDate(from.getDate() - (days - 1))
  return {
    from,
    to,
    fromStr: formatDateKey(from),
    toStr: formatDateKey(to),
  }
}

function parseIsoDate(value) {
  const text = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  const date = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function diffDaysInclusive(from, to) {
  const ms = to.getTime() - from.getTime()
  return Math.floor(ms / 86400000) + 1
}

function formatShortDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function formatNumber(value, digits = 0) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function formatCompact(value) {
  const num = Number(value || 0)
  const abs = Math.abs(num)
  if (abs >= 1000000) return `${(num / 1000000).toFixed(abs >= 10000000 ? 1 : 2).replace(/\.0$/, '')}M`
  if (abs >= 1000) return `${(num / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`
  return formatNumber(num, 0)
}

function formatPct(value, digits = 2) {
  return `${Number(value || 0).toFixed(digits)}%`
}

function fmtMoney(value, currency = 'USD', digits = 0) {
  const amount = Number(value || 0)
  const sign = amount < 0 ? '-' : ''
  const code = String(currency || 'USD').toUpperCase()
  const prefix = code === 'USD' ? '$' : code === 'EUR' ? '€' : code === 'KZT' ? '₸' : ''
  const abs = formatNumber(Math.abs(amount), digits)
  if (prefix) return `${sign}${prefix}${abs}`
  return `${sign}${abs} ${code}`.trim()
}

function deltaPct(current, previous) {
  const now = Number(current || 0)
  const prev = Number(previous || 0)
  if (!prev) return 0
  return ((now - prev) / prev) * 100
}

function platformLabel(platform) {
  if (platform === 'meta') return 'Meta Business'
  if (platform === 'google') return 'Google Ads'
  if (platform === 'tiktok') return 'TikTok Ads'
  return 'Platform'
}

function trendTone(delta) {
  return Number(delta || 0) >= 0 ? 'good' : 'warn'
}

function listPlatforms(filter) {
  if (filter && filter !== 'all' && SUPPORTED_PLATFORMS.has(filter)) return [filter]
  return ['google', 'meta', 'tiktok']
}

function sumTotals(totals = {}, platforms = []) {
  return platforms.reduce(
    (acc, key) => {
      const item = totals?.[key] || {}
      acc.spend += Number(item.spend || 0)
      acc.impressions += Number(item.impressions || 0)
      acc.clicks += Number(item.clicks || 0)
      return acc
    },
    { spend: 0, impressions: 0, clicks: 0 }
  )
}

function buildOverviewParams(range, account) {
  const params = new URLSearchParams()
  params.set('date_from', range.fromStr)
  params.set('date_to', range.toStr)
  if (account?.id && account?.platform) {
    params.set(`${account.platform}_account_id`, String(account.id))
  }
  return params
}

function buildPulseSeries(payload, range, platforms) {
  const byDate = new Map()
  const daily = payload?.daily || {}
  for (const platform of platforms) {
    for (const row of daily?.[platform] || []) {
      const date = row.date || row.date_start
      if (!date) continue
      const current = byDate.get(date) || {
        date,
        label: formatShortDate(date),
        spend: 0,
        impressions: 0,
        clicks: 0,
      }
      current.spend += Number(row.spend || 0)
      current.impressions += Number(row.impressions || 0)
      current.clicks += Number(row.clicks || 0)
      byDate.set(date, current)
    }
  }

  const rows = []
  for (let day = new Date(range.from); day <= range.to; day.setDate(day.getDate() + 1)) {
    const date = formatDateKey(day)
    const row = byDate.get(date) || { date, label: formatShortDate(date), spend: 0, impressions: 0, clicks: 0 }
    const ctr = row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0
    rows.push({ ...row, ctr })
  }
  return rows.slice(-12)
}

function buildAccountRows(payload, accounts, platforms, selectedAccountId) {
  const rows = []
  const lookup = new Map((accounts || []).map((item) => [String(item.id), item]))

  for (const platform of platforms) {
    for (const entry of payload?.daily_by_account?.[platform] || []) {
      const accountId = String(entry.account_id || '')
      if (selectedAccountId && accountId !== String(selectedAccountId)) continue
      const account = lookup.get(accountId)
      const daily = Array.isArray(entry.daily) ? entry.daily : []
      const totals = daily.reduce(
        (acc, point) => {
          acc.spend += Number(point.spend || 0)
          acc.impressions += Number(point.impressions || 0)
          acc.clicks += Number(point.clicks || 0)
          return acc
        },
        { spend: 0, impressions: 0, clicks: 0 }
      )
      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
      const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
      const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0
      const trend = daily.slice(-8).map((point) => Number(point.spend || 0))
      rows.push({
        id: `${platform}-${accountId || rows.length}`,
        accountId,
        platform,
        platformLabel: platformLabel(platform),
        account: account?.name || entry.account_name || `Account ${accountId}`,
        spend: totals.spend,
        impressions: totals.impressions,
        clicks: totals.clicks,
        ctr,
        cpc,
        cpm,
        trend,
      })
    }
  }

  return rows.sort((a, b) => b.spend - a.spend)
}

function applySummarySpendFallback(rows, summaryMap) {
  return (rows || []).map((row) => {
    const snapshot = summaryMap.get(String(row.accountId))
    if (!snapshot) return row
    if (Number(row.spend || 0) > 0) return row
    const spendTotal = Number(snapshot.spend_total)
    if (!Number.isFinite(spendTotal)) return row
    return {
      ...row,
      spend: spendTotal,
    }
  })
}

function buildRowsFromSummary(summaryItems, accounts, platforms, selectedAccountId) {
  const accountMap = new Map((accounts || []).map((item) => [String(item.id), item]))
  return (summaryItems || [])
    .filter((row) => SUPPORTED_PLATFORMS.has(String(row?.platform || '').toLowerCase()))
    .filter((row) => (platforms.length ? platforms.includes(String(row?.platform || '').toLowerCase()) : true))
    .filter((row) => (selectedAccountId ? String(row?.account_id || '') === String(selectedAccountId) : true))
    .map((row) => {
      const accountId = String(row?.account_id || '')
      const account = accountMap.get(accountId)
      return {
        id: `${row.platform}-${accountId || 'summary'}`,
        accountId,
        platform: String(row?.platform || '').toLowerCase(),
        platformLabel: platformLabel(String(row?.platform || '').toLowerCase()),
        account: account?.name || row?.account_name || `Account ${accountId}`,
        spend: Number(row?.spend_total || 0),
        impressions: 0,
        clicks: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
        trend: [0],
        hasDeliveryData: false,
      }
    })
    .sort((a, b) => b.spend - a.spend)
}

function mapRowsForUi(rows) {
  return rows.map((row) => ({
    id: row.id,
    platform: row.platformLabel,
    account: row.account,
    spend: fmtMoney(row.spend, 'USD', 0),
    impressions: formatCompact(row.impressions),
    clicks: formatCompact(row.clicks),
    ctr: formatPct(row.ctr),
    cpc: row.cpc > 0 ? `$${formatNumber(row.cpc, 2)}` : '—',
    cpm: row.cpm > 0 ? `$${formatNumber(row.cpm, 2)}` : '—',
    trend: row.trend,
    hasDeliveryData: row.hasDeliveryData !== false,
  }))
}

function buildMovers(currentRows, previousRows) {
  const rowsWithDelivery = (currentRows || []).filter((row) => row.hasDeliveryData !== false)
  if (!rowsWithDelivery.length) return []
  const previous = new Map(previousRows.map((row) => [row.accountId, row]))
  const enriched = rowsWithDelivery
    .map((row) => {
      const prev = previous.get(row.accountId)
      return {
        ...row,
        spendDelta: deltaPct(row.spend, prev?.spend || 0),
        ctrDelta: row.ctr - Number(prev?.ctr || 0),
      }
    })
    .filter((row) => row.spend > 0 || row.clicks > 0)

  const ctrLeader = [...enriched].sort((a, b) => b.ctrDelta - a.ctrDelta)[0]
  const spendLeader = [...enriched].sort((a, b) => b.spendDelta - a.spendDelta)[0]
  return [ctrLeader, spendLeader]
    .filter(Boolean)
    .map((row, index) => ({
      title: index === 0 ? `${row.account}` : `${row.account}`,
      subtitle: index === 0 ? 'CTR growth' : 'Spend jump',
      value: index === 0 ? `${row.ctrDelta >= 0 ? '+' : ''}${row.ctrDelta.toFixed(2)}%` : `${row.spendDelta >= 0 ? '+' : ''}${row.spendDelta.toFixed(1)}%`,
      hint: row.platformLabel,
      tone: row.ctrDelta >= 0 || row.spendDelta >= 0 ? 'good' : 'warn',
    }))
}

function buildAttentionRows(rows) {
  const rowsWithDelivery = (rows || []).filter((row) => row.hasDeliveryData !== false)
  if (!rowsWithDelivery.length) return []
  const zeroDelivery = rows
    .filter((row) => row.spend > 0 && row.impressions === 0 && row.hasDeliveryData !== false)
    .slice(0, 1)
    .map((row) => ({
      title: 'Zero Delivery',
      text: `${row.account} has spend recorded without impressions in the selected period.`,
      action: 'Review',
    }))

  const inefficient = rows
    .filter((row) => row.spend > 0 && row.ctr > 0 && row.ctr < 1 && row.hasDeliveryData !== false)
    .sort((a, b) => a.ctr - b.ctr)
    .slice(0, 1)
    .map((row) => ({
      title: 'Inefficient Spend',
      text: `${row.account} shows low CTR (${row.ctr.toFixed(2)}%) for current spend.`,
      action: 'Review',
    }))

  return [...inefficient, ...zeroDelivery]
}

function buildInsight(currentTotals, previousPayload, platforms) {
  const previousTotals = previousPayload?.totals || {}
  const deltas = platforms.map((platform) => {
    const currentSpend = Number(currentTotals?.[platform]?.spend || 0)
    const previousSpend = Number(previousTotals?.[platform]?.spend || 0)
    const currentCtr =
      Number(currentTotals?.[platform]?.impressions || 0) > 0
        ? (Number(currentTotals?.[platform]?.clicks || 0) / Number(currentTotals?.[platform]?.impressions || 1)) * 100
        : 0
    const previousCtr =
      Number(previousTotals?.[platform]?.impressions || 0) > 0
        ? (Number(previousTotals?.[platform]?.clicks || 0) / Number(previousTotals?.[platform]?.impressions || 1)) * 100
        : 0
    return {
      platform,
      spendDelta: deltaPct(currentSpend, previousSpend),
      ctrDelta: currentCtr - previousCtr,
    }
  })
  const spendLeader = [...deltas].sort((a, b) => b.spendDelta - a.spendDelta)[0]
  if (!spendLeader) return 'Performance mix is ready for review.'
  const ctrText = `${spendLeader.ctrDelta >= 0 ? 'CTR improved' : 'CTR declined'} ${Math.abs(spendLeader.ctrDelta).toFixed(1)}%`
  return `${platformLabel(spendLeader.platform)} spend ${spendLeader.spendDelta >= 0 ? 'rose' : 'fell'} ${Math.abs(
    spendLeader.spendDelta
  ).toFixed(1)}% while ${ctrText}.`
}

export async function GET(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const dbMode = useDbFinanceRead()
  const { searchParams } = new URL(request.url)
  const preset = Math.max(7, Math.min(90, Number(searchParams.get('preset') || 30)))
  const platform = String(searchParams.get('platform') || 'all').toLowerCase()
  const accountId = String(searchParams.get('account_id') || '')
  const dateFromRaw = searchParams.get('date_from')
  const dateToRaw = searchParams.get('date_to')

  const parsedFrom = parseIsoDate(dateFromRaw)
  const parsedTo = parseIsoDate(dateToRaw)
  const hasCustomRange = Boolean(parsedFrom && parsedTo && parsedFrom <= parsedTo)

  const current = hasCustomRange
    ? {
        from: parsedFrom,
        to: parsedTo,
        fromStr: dateFromRaw,
        toStr: dateToRaw,
      }
    : dateRange(preset)
  const rangeDays = diffDaysInclusive(current.from, current.to)
  const previous = previousRangeFor(current, rangeDays)

  const accountsRes = await upstreamFetch('/accounts', auth)
  if (accountsRes.status === 401) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  const allAccounts = accountsRes.ok ? await accountsRes.json() : []
  const accounts = (allAccounts || []).filter((item) => SUPPORTED_PLATFORMS.has(String(item?.platform || '').toLowerCase()))
  const validSelectedAccountId = accountId && accounts.some((item) => String(item.id) === accountId) ? accountId : ''
  const selectedAccount = (accounts || []).find((item) => String(item.id) === validSelectedAccountId)

  const currentParams = buildOverviewParams(current, selectedAccount)
  const previousParams = buildOverviewParams(previous, selectedAccount)

  const [currentRes, previousRes, financeSummaryRes] = await Promise.all([
    upstreamFetch(`/insights/overview?${currentParams.toString()}`, auth),
    upstreamFetch(`/insights/overview?${previousParams.toString()}`, auth),
    upstreamFetch('/accounts/finance/summary', auth),
  ])

  if (currentRes.status === 401 || previousRes.status === 401 || financeSummaryRes?.status === 401) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  if (!currentRes.ok && !financeSummaryRes?.ok) {
    return NextResponse.json(
      {
        detail: 'Performance upstream failed',
        issues: [
          { path: '/insights/overview', status: currentRes.status },
          { path: '/accounts/finance/summary', status: financeSummaryRes?.status || 0 },
        ],
      },
      { status: 502 }
    )
  }

  const currentPayload = currentRes.ok ? await currentRes.json() : {}
  const previousPayload = previousRes.ok ? await previousRes.json() : {}
  const financeSummaryPayload = financeSummaryRes?.ok ? await financeSummaryRes.json() : { items: [] }
  const financeSummaryMap = new Map(
    (Array.isArray(financeSummaryPayload?.items) ? financeSummaryPayload.items : [])
      .filter((row) => row?.account_id != null)
      .map((row) => [String(row.account_id), row])
  )

  const platforms = listPlatforms(platform)
  const currentTotals = sumTotals(currentPayload?.totals, platforms)
  const previousTotals = sumTotals(previousPayload?.totals, platforms)
  const ctr = currentTotals.impressions > 0 ? (currentTotals.clicks / currentTotals.impressions) * 100 : 0
  const previousCtr = previousTotals.impressions > 0 ? (previousTotals.clicks / previousTotals.impressions) * 100 : 0

  let currentAccountRows = buildAccountRows(currentPayload, accounts, platforms, validSelectedAccountId)
  currentAccountRows = currentAccountRows.map((row) => ({ ...row, hasDeliveryData: true }))
  const previousAccountRows = buildAccountRows(previousPayload, accounts, platforms, validSelectedAccountId)
  currentAccountRows = applySummarySpendFallback(currentAccountRows, financeSummaryMap)

  const summarySpendTotal = (Array.isArray(financeSummaryPayload?.items) ? financeSummaryPayload.items : [])
    .filter((row) => (platform === 'all' ? true : String(row?.platform || '').toLowerCase() === platform))
    .filter((row) => (validSelectedAccountId ? String(row?.account_id || '') === validSelectedAccountId : true))
    .reduce((sum, row) => sum + Number(row?.spend_total || 0), 0)
  if (currentTotals.spend <= 0 && summarySpendTotal > 0) {
    currentTotals.spend = summarySpendTotal
  }
  if (!currentAccountRows.length) {
    currentAccountRows = buildRowsFromSummary(financeSummaryPayload?.items || [], accounts, platforms, validSelectedAccountId)
  }

  const usingSummaryFallbackRows = !currentRes.ok || !currentAccountRows.length
  const safeImpressions = usingSummaryFallbackRows ? null : currentTotals.impressions
  const safeClicks = usingSummaryFallbackRows ? null : currentTotals.clicks
  const safeCtr = usingSummaryFallbackRows ? null : ctr
  const impressionsDelta = usingSummaryFallbackRows ? null : deltaPct(currentTotals.impressions, previousTotals.impressions)
  const clicksDelta = usingSummaryFallbackRows ? null : deltaPct(currentTotals.clicks, previousTotals.clicks)
  const ctrDelta = usingSummaryFallbackRows ? null : ctr - previousCtr
  const pulseSeries = usingSummaryFallbackRows ? [] : buildPulseSeries(currentPayload, current, platforms)
  const pulseInsight = usingSummaryFallbackRows
    ? 'Delivery data is unavailable for the selected period. Spend values are shown from synced finance snapshots.'
    : buildInsight(currentPayload?.totals || {}, previousPayload, platforms)

  return NextResponse.json({
    financeMode: dbMode ? 'db_fallback' : 'runtime_live',
    filters: {
      selectedPreset: preset,
      selectedPlatform: platform,
      selectedAccountId: validSelectedAccountId,
      selectedDateFrom: current.fromStr,
      selectedDateTo: current.toStr,
      customRange: hasCustomRange,
      presets: [
        { value: 7, label: 'Last 7 Days' },
        { value: 30, label: 'Last 30 Days' },
        { value: 90, label: 'Last 90 Days' },
      ],
      platforms: [
        { value: 'all', label: 'All Platforms' },
        { value: 'google', label: 'Google Ads' },
        { value: 'meta', label: 'Meta' },
        { value: 'tiktok', label: 'TikTok Ads' },
      ],
      accounts: [
        { value: '', label: 'All Accounts' },
        ...(accounts || [])
          .filter((item) => (platform === 'all' ? true : String(item.platform || '').toLowerCase() === platform))
          .map((item) => ({
            value: String(item.id),
            label: item.name || `ID ${item.id}`,
          })),
      ],
      accountsAll: (accounts || []).map((item) => ({
        value: String(item.id),
        label: item.name || `ID ${item.id}`,
        platform: String(item.platform || '').toLowerCase(),
      })),
    },
    metrics: [
      {
        label: 'Spend',
        value: fmtMoney(currentTotals.spend, 'USD', 0),
        hint: `${deltaPct(currentTotals.spend, previousTotals.spend) >= 0 ? '+' : ''}${deltaPct(currentTotals.spend, previousTotals.spend).toFixed(1)}%`,
        tone: trendTone(deltaPct(currentTotals.spend, previousTotals.spend)),
      },
      {
        label: 'Impressions',
        value: safeImpressions == null ? '—' : formatCompact(safeImpressions),
        hint: impressionsDelta == null ? 'Delivery data unavailable' : `${impressionsDelta >= 0 ? '+' : ''}${impressionsDelta.toFixed(1)}%`,
        tone: impressionsDelta == null ? undefined : trendTone(impressionsDelta),
      },
      {
        label: 'Clicks',
        value: safeClicks == null ? '—' : formatCompact(safeClicks),
        hint: clicksDelta == null ? 'Delivery data unavailable' : `${clicksDelta >= 0 ? '+' : ''}${clicksDelta.toFixed(1)}%`,
        tone: clicksDelta == null ? undefined : trendTone(clicksDelta),
      },
      {
        label: 'CTR',
        value: safeCtr == null ? '—' : formatPct(safeCtr, 2),
        hint: ctrDelta == null ? 'Delivery data unavailable' : `${ctrDelta >= 0 ? '+' : ''}${ctrDelta.toFixed(2)}%`,
        tone: ctrDelta == null ? undefined : trendTone(ctrDelta),
      },
    ],
    pulse: {
      series: pulseSeries,
      insight: pulseInsight,
    },
    platformRows: mapRowsForUi(currentAccountRows),
    topMovers: buildMovers(currentAccountRows, previousAccountRows),
    attentionAreas: buildAttentionRows(currentAccountRows),
  })
}
