import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../lib/api'
import {
  aggregateCompletedFundingByAccount,
  accountDisplayCurrency,
  buildWalletBalanceHint,
  extractLiveBalance,
  extractLiveSpend,
  formatMoney,
  getMarkedRate,
  getTopupAccountFundingKzt,
  getWalletAvailableBalance,
  normalizeAccountStatus,
  platformLabel,
  sumOverviewSpend,
} from '../../../../lib/finance/model'

export const dynamic = 'force-dynamic'

const DEFAULT_MEDIA_PLAN = {
  status: 'Data unavailable',
  budgetRunway: 'No active plan',
  lastUpdated: 'Planning data unavailable',
  empty: true,
}

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

async function parseUpstreamJson({ name, path, response, fallback, required, issues }) {
  const status = Number(response?.status || 0)
  if (!response) {
    if (required) issues.push({ name, path, status: 0, reason: 'no_response' })
    return fallback
  }
  if (!response.ok) {
    if (required) issues.push({ name, path, status, reason: 'http_error' })
    return fallback
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  if (status === 204) return fallback

  try {
    if (contentType.includes('application/json')) {
      return await response.json()
    }
    const raw = await response.text()
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    if (required) issues.push({ name, path, status, reason: 'invalid_json' })
    return fallback
  }
}

function useDbFinanceRead() {
  return String(process.env.FINANCE_READ_FROM_DB || '').trim() === '1'
}

function fmtMoney(value, currency = 'USD', digits = 0) {
  return formatMoney(value, currency, digits)
}

function fmtDeltaPct(current, previous) {
  const now = Number(current || 0)
  const prev = Number(previous || 0)
  if (!prev) return null
  return ((now - prev) / prev) * 100
}

function shortDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
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

function previousRange(days) {
  const current = dateRange(days)
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

function mergeDailySpend(payload) {
  const byDate = new Map()
  const daily = payload?.daily || {}
  for (const platform of ['meta', 'google', 'tiktok']) {
    for (const row of daily?.[platform] || []) {
      const date = row.date || row.date_start
      if (!date) continue
      const current = byDate.get(date) || { date, spend: 0 }
      current.spend += Number(row.spend || 0)
      byDate.set(date, current)
    }
  }
  return Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

function sumAccountSpendItems(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  if (!items.length) return null
  return items.reduce((sum, row) => sum + Number(row?.spend || 0), 0)
}

function dailySpendMapFromDb(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : []
  if (!items.length) return null
  const mapped = new Map()
  for (const row of items) {
    const date = String(row?.date || '').trim()
    if (!date) continue
    mapped.set(date, Number(row?.spend || 0))
  }
  return mapped
}

function aggregateCompletedTopups(topups, fromStr, toStr) {
  const daily = new Map()
  let total = 0
  for (const row of topups || []) {
    const status = String(row.status || '').toLowerCase()
    if (status !== 'completed') continue
    const date = String(row.created_at || '').slice(0, 10)
    if (!date || date < fromStr || date > toStr) continue
    const amount = getTopupAccountFundingKzt(row)
    if (!amount) continue
    total += amount
    daily.set(date, (daily.get(date) || 0) + amount)
  }
  return { total, daily }
}

function lastDaysSeries(current, spendDaily, topupsDaily, days = 6) {
  const dates = []
  const end = new Date(current.to)
  for (let i = days - 1; i >= 0; i -= 1) {
    const value = new Date(end)
    value.setDate(end.getDate() - i)
    dates.push(formatDateKey(value))
  }
  const rows = dates.map((date) => ({
    date,
    label: shortDate(date),
    spend: Number(spendDaily.get(date) || 0),
    topups: Number(topupsDaily.get(date) || 0),
  }))
  const max = rows.reduce((m, row) => Math.max(m, row.spend, row.topups), 0) || 1
  return rows.map((row) => ({
    ...row,
    soft: row.topups > 0 ? Math.max(10, Math.round((row.topups / max) * 188)) : 0,
    strong: row.spend > 0 ? Math.max(10, Math.round((row.spend / max) * 188)) : 0,
  }))
}

function relativeTime(value) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  const diffMs = Date.now() - date.getTime()
  const hours = Math.floor(diffMs / 3600000)
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return shortDate(value)
}

function requestToneFromStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'approved' || normalized === 'completed') return 'good'
  if (normalized === 'pending' || normalized === 'processing' || normalized === 'requested' || normalized === 'new') return 'warn'
  return 'neutral'
}

function requestLabelFromStatus(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'approved') return 'Approved'
  if (normalized === 'processing') return 'In Review'
  if (normalized === 'requested') return 'Requested'
  if (normalized === 'pending') return 'Pending'
  if (normalized === 'new') return 'New'
  if (normalized === 'rejected') return 'Rejected'
  return status || 'Pending'
}

function dedupeBy(rows, keyFn) {
  const seen = new Set()
  const result = []
  for (const row of rows || []) {
    const key = keyFn(row)
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

function dedupeAccounts(rows) {
  const seen = new Set()
  const result = []
  for (const row of rows || []) {
    const idKey = row?.id != null ? `id:${row.id}` : ''
    const fallbackKey = [
      String(row?.platform || '').toLowerCase().trim(),
      String(row?.name || '').toLowerCase().trim(),
      String(row?.account_code || '').toLowerCase().trim(),
      String(row?.external_id || '').toLowerCase().trim(),
    ].join('::')
    const key = idKey || fallbackKey
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(row)
  }
  return result
}

function fundingRequestFingerprint(row) {
  const invoiceNumber = String(row?.invoice_number || row?.invoice_number_text || '').trim()
  if (invoiceNumber) return `invoice:${invoiceNumber.toLowerCase()}`
  const createdDate = String(row?.created_at || '').slice(0, 10)
  const amount = Number(row?.invoice_amount ?? row?.amount ?? 0)
  const currency = String(row?.invoice_currency || row?.currency || '').toUpperCase()
  const entity = String(row?.legal_entity_name || row?.client_name || '').trim().toLowerCase()
  const status = String(row?.status || '').trim().toLowerCase()
  return `req:${entity}:${amount}:${currency}:${status}:${createdDate}`
}

function buildPendingSummary(accountRequests, walletTopupRequests, financeDocs) {
  const approvals = (accountRequests || []).filter((row) => ['new', 'processing', 'pending', 'requested'].includes(String(row.status || '').toLowerCase())).length
  const funding = (walletTopupRequests || []).filter((row) => !['approved', 'completed', 'rejected'].includes(String(row.status || '').toLowerCase())).length
  const documents = (financeDocs || []).filter((row) => {
    const status = String(row.status || '').toLowerCase()
    return status && !['approved', 'completed', 'rejected'].includes(status)
  }).length
  return {
    approvals,
    funding,
    documents,
    total: approvals + funding + documents,
  }
}

function buildRateStatusRows(ratesPayload) {
  const usdRate = getMarkedRate(ratesPayload?.rates?.USD)
  const eurRate = getMarkedRate(ratesPayload?.rates?.EUR)
  const rows = []
  if (Number.isFinite(usdRate) && usdRate > 0) {
    rows.push({ icon: '$', label: `USD/KZT ${usdRate.toFixed(1)}` })
  }
  if (Number.isFinite(eurRate) && eurRate > 0) {
    rows.push({ icon: '€', label: `EUR/KZT ${eurRate.toFixed(1)}` })
  }
  return rows
}

function deriveBalanceState({ status, derivedBalance, monthlySpend, linkedRequest, balanceSource }) {
  if (status !== 'Active') return 'inactive'
  if (linkedRequest && ['new', 'processing', 'pending'].includes(String(linkedRequest.status || '').toLowerCase())) return 'setup'
  if (balanceSource === 'none') return 'unknown'
  if (derivedBalance == null) return 'unknown'
  if (derivedBalance <= 0 && monthlySpend > 0) return 'depleted'
  if (derivedBalance > 0 && monthlySpend > 0 && derivedBalance < monthlySpend * 0.35) return 'low'
  return 'healthy'
}

function buildAlerts(accounts, requests, financeDocs, walletTopupRequests) {
  const alerts = []
  const usedIds = new Set()
  const pushAlert = (alert) => {
    const rawId = String(alert?.id || 'alert-item')
    let uniqueId = rawId
    let suffix = 1
    while (usedIds.has(uniqueId)) {
      suffix += 1
      uniqueId = `${rawId}-${suffix}`
    }
    usedIds.add(uniqueId)
    alerts.push({ ...alert, id: uniqueId })
  }

  for (const account of accounts) {
    if (account.balanceState === 'depleted' || account.balanceState === 'low') {
      pushAlert({
        id: `alert-account-${account.platformKey || 'platform'}-${account.accountId || account.account}`,
        type: 'low_balance',
        severity: account.balanceState === 'depleted' ? 'high' : 'medium',
        title: `${account.account} requires funding`,
        action: account.noteAction || 'Top up now',
        accountId: account.accountId || null,
      })
    } else if (account.balanceState === 'setup') {
      pushAlert({
        id: `alert-setup-${account.platformKey || 'platform'}-${account.accountId || account.account}`,
        type: 'account_setup',
        severity: 'medium',
        title: `${account.account} setup is still in progress`,
        action: account.noteAction || 'Review',
      })
    }
  }
  for (const row of requests || []) {
    const status = String(row.status || '').toLowerCase()
    if (status === 'new' || status === 'processing' || status === 'pending') {
      pushAlert({
        id: `alert-request-${row.id || row.request_id || row.created_at || row.name || row.platform}`,
        type: 'approval',
        severity: 'medium',
        title: `${platformLabel(row.platform)} request is ${requestLabelFromStatus(row.status).toLowerCase()}`,
        action: 'Review',
      })
    }
  }
  for (const row of walletTopupRequests || []) {
    const status = String(row.status || '').toLowerCase()
    if (status && !['approved', 'completed', 'rejected'].includes(status)) {
      pushAlert({
        id: `alert-funding-${row.id || row.request_id || row.created_at || row.amount || status}`,
        type: 'funding_request',
        severity: 'low',
        title: `Funding request ${status}`,
        action: 'Open request',
      })
    }
  }
  return alerts.slice(0, 3)
}

export async function GET(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const dbMode = useDbFinanceRead()
  const { searchParams } = new URL(request.url)
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
    : dateRange(30)
  const rangeDays = diffDaysInclusive(current.from, current.to)
  const previous = previousRangeFor(current, rangeDays)
  const endpoints = [
    { name: 'wallet', path: '/wallet', required: true, fallback: null },
    { name: 'rates', path: '/rates/bcc', required: false, fallback: null },
    { name: 'spend_current', path: `/insights/overview?date_from=${current.fromStr}&date_to=${current.toStr}`, required: false, fallback: null },
    { name: 'spend_previous', path: `/insights/overview?date_from=${previous.fromStr}&date_to=${previous.toStr}`, required: false, fallback: null },
    { name: 'accounts', path: '/accounts?include_live_billing=1', required: true, fallback: [] },
    { name: 'account_spend', path: `/accounts/spend?date_from=${current.fromStr}&date_to=${current.toStr}`, required: false, fallback: { items: [] } },
    { name: 'account_spend_previous', path: `/accounts/spend?date_from=${previous.fromStr}&date_to=${previous.toStr}`, required: false, fallback: { items: [] } },
    { name: 'account_spend_daily', path: `/accounts/spend/daily?date_from=${current.fromStr}&date_to=${current.toStr}`, required: false, fallback: { items: [] } },
    { name: 'account_requests', path: '/account-requests', required: false, fallback: [] },
    { name: 'notifications', path: '/notifications', required: false, fallback: { items: [] } },
    { name: 'topups', path: '/topups', required: false, fallback: [] },
    { name: 'wallet_topup_requests', path: '/wallet/topup-requests', required: false, fallback: [] },
    { name: 'finance_docs', path: '/client-finance-documents', required: false, fallback: [] },
    ...(dbMode ? [{ name: 'finance_summary', path: '/accounts/finance/summary', required: false, fallback: { items: [] } }] : []),
  ]

  const responseMap = {}
  await Promise.all(
    endpoints.map(async (ep) => {
      try {
        responseMap[ep.name] = await upstreamFetch(ep.path, auth)
      } catch {
        responseMap[ep.name] = null
      }
    })
  )

  if (Object.values(responseMap).some((res) => res?.status === 401)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const issues = []
  const payloadMap = {}
  await Promise.all(
    endpoints.map(async (ep) => {
      payloadMap[ep.name] = await parseUpstreamJson({
        name: ep.name,
        path: ep.path,
        response: responseMap[ep.name],
        fallback: ep.fallback,
        required: ep.required,
        issues,
      })
    })
  )

  if (issues.length) {
    return NextResponse.json(
      {
        detail: 'Overview upstream failed',
        issues,
      },
      { status: 502 }
    )
  }

  try {
    const wallet = payloadMap.wallet
    const ratesPayload = payloadMap.rates
    const currentSpendPayload = payloadMap.spend_current
    const previousSpendPayload = payloadMap.spend_previous
    const accounts = payloadMap.accounts
    const accountSpendPayload = payloadMap.account_spend
    const accountSpendPreviousPayload = payloadMap.account_spend_previous
    const accountSpendDailyPayload = payloadMap.account_spend_daily
    const accountRequests = payloadMap.account_requests
    const notifications = payloadMap.notifications
    const topups = payloadMap.topups
    const walletTopupRequests = payloadMap.wallet_topup_requests
    const financeDocs = payloadMap.finance_docs
    const financeSummaryPayload = payloadMap.finance_summary || { items: [] }

    const financeSummaryMap = new Map(
      (Array.isArray(financeSummaryPayload?.items) ? financeSummaryPayload.items : [])
        .filter((row) => row?.account_id != null)
        .map((row) => [String(row.account_id), row])
    )

    const currentSpendDb = sumAccountSpendItems(accountSpendPayload)
    const previousSpendDb = sumAccountSpendItems(accountSpendPreviousPayload)
    const currentSpend = currentSpendDb == null ? sumOverviewSpend(currentSpendPayload) : currentSpendDb
    const previousSpend = previousSpendDb == null ? sumOverviewSpend(previousSpendPayload) : previousSpendDb
    const spendDelta = fmtDeltaPct(currentSpend, previousSpend)
    const uniqueWalletTopupRequests = dedupeBy(
      (walletTopupRequests || []).slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
      fundingRequestFingerprint
    )

    const completedFundingMap = aggregateCompletedFundingByAccount(topups)
    const periodSpendMap = new Map((accountSpendPayload?.items || []).map((row) => [String(row.account_id), row]))
    const requestMap = new Map()
    for (const row of accountRequests || []) {
      const key = `${String(row.platform || '').toLowerCase()}::${String(row.name || '').toLowerCase()}`
      if (!requestMap.has(key)) requestMap.set(key, row)
    }

    const uniqueAccounts = dedupeAccounts(accounts || [])
    const accountRows = uniqueAccounts.map((row) => {
    const dbSnapshot = financeSummaryMap.get(String(row.id))
    const spendRow = periodSpendMap.get(String(row.id))
    const platform = String(row.platform || '').toLowerCase()
    const liveSpend = extractLiveSpend(row.live_billing)
    const liveBalance = extractLiveBalance(row.live_billing)
    const spendValueRaw = Number(spendRow?.spend)
    const dbSpendTotal = Number(dbSnapshot?.spend_total)
    const dbSpendToday = Number(dbSnapshot?.spend_today)
    const spendValue = Number.isFinite(spendValueRaw)
      ? spendValueRaw
      : Number.isFinite(dbSpendTotal)
        ? dbSpendTotal
        : Number.isFinite(dbSpendToday)
          ? dbSpendToday
          : NaN
    const funding = completedFundingMap.get(String(row.id))
    const fundingValue =
      platform === 'yandex'
        ? Number(funding?.amountKzt || funding?.amount || 0)
        : Number(funding?.amountUsd || funding?.amount || 0)
    const dbRemaining = Number(dbSnapshot?.remaining_balance)
    const dbOptionalBalance = Number(dbSnapshot?.optional_balance)
    const hasLiveBalance = Number.isFinite(liveBalance) || Number.isFinite(dbOptionalBalance)
    const hasFundingFallback = Number.isFinite(fundingValue) && fundingValue > 0 && Number.isFinite(spendValue)
    const derivedBalance = Number.isFinite(dbRemaining)
      ? dbRemaining
      : Number.isFinite(liveBalance)
        ? liveBalance
        : Number.isFinite(dbOptionalBalance)
          ? dbOptionalBalance
          : hasFundingFallback
            ? fundingValue - spendValue
            : null
    const balanceSource = Number.isFinite(dbRemaining)
      ? 'db_remaining'
      : hasLiveBalance
        ? 'live'
        : hasFundingFallback
          ? 'fact_minus_spend'
          : 'none'
    const requestKey = `${String(row.platform || '').toLowerCase()}::${String(row.name || '').toLowerCase()}`
    const linkedRequest = requestMap.get(requestKey)
    const status = normalizeAccountStatus(row.status)

    let note = 'Healthy'
    let noteTone = 'good'
    let noteAction = 'Open'
    const monthlySpend = Number.isFinite(dbSpendToday)
      ? dbSpendToday
      : Number.isFinite(spendValue)
        ? spendValue
        : Number(liveSpend || 0)
    const balanceState = deriveBalanceState({
      status,
      derivedBalance,
      monthlySpend,
      linkedRequest,
      balanceSource,
    })

    if (balanceState === 'inactive') {
      note = status === 'Closed' ? 'Inactive' : 'Setup in progress'
      noteTone = 'warn'
      noteAction = 'Review'
    } else if (balanceState === 'setup') {
      note = 'Request in progress'
      noteTone = 'warn'
      noteAction = 'Review'
    } else if (balanceState === 'depleted') {
      note = 'Balance depleted'
      noteTone = 'warn'
      noteAction = 'Top up now'
    } else if (balanceState === 'low') {
      note = 'Low balance'
      noteTone = 'warn'
      noteAction = 'Top up now'
    } else if (balanceState === 'unknown') {
      note = 'Balance unavailable'
      noteTone = 'neutral'
      noteAction = 'Refresh'
    }

    return {
      accountId: row.id,
      platformKey: platform,
      currency: accountDisplayCurrency(row.platform, row.currency),
      account: row.name || `Account ${row.id}`,
      platform: platformLabel(row.platform),
      status,
      balanceState,
      balanceSource,
      balanceSourceLabel:
        balanceSource === 'db_remaining'
          ? 'Calculated'
          : balanceSource === 'live'
            ? 'Live'
            : balanceSource === 'fact_minus_spend'
              ? 'Estimated'
              : 'Unavailable',
      balance: derivedBalance != null ? fmtMoney(derivedBalance) : 'No data',
      spend: Number.isFinite(dbSpendTotal)
        ? `${fmtMoney(dbSpendTotal)}/total`
        : Number.isFinite(spendValue)
          ? `${fmtMoney(spendValue)}/mo`
          : liveSpend != null
            ? `${fmtMoney(liveSpend)}/live`
            : 'No data',
      note,
      noteTone,
      noteAction,
    }
    })

    const pendingSummary = buildPendingSummary(accountRequests, uniqueWalletTopupRequests, financeDocs)

    const spendDailyDb = dailySpendMapFromDb(accountSpendDailyPayload)
    const spendDailyRows = mergeDailySpend(currentSpendPayload)
    const spendDailyFallback = new Map(spendDailyRows.map((row) => [row.date, Number(row.spend || 0)]))
    const spendDaily = spendDailyDb || spendDailyFallback
    const topupsNormalized = aggregateCompletedTopups(topups, current.fromStr, current.toStr)
    const series = lastDaysSeries(current, spendDaily, topupsNormalized.daily, Math.min(31, Math.max(6, rangeDays)))
    const netFlow = topupsNormalized.total - currentSpend

    const recentActivity = (notifications?.items || []).slice(0, 4).map((item) => ({
    title: item.type === 'topup' ? 'Top-up confirmed' : 'Account approved',
    text: item.type === 'topup' ? `${fmtMoney(item.amount || 0, item.currency || 'USD')} completed` : `${platformLabel(item.platform)} ${item.name || ''}`.trim(),
    time: relativeTime(item.created_at),
    tone: item.type === 'topup' ? 'good' : 'info',
    }))

    const pendingRequests = [
    ...(accountRequests || [])
      .filter((row) => ['new', 'processing', 'pending', 'requested'].includes(String(row.status || '').toLowerCase()))
      .map((row, index) => ({
        id: `account-request-${row.id || row.request_id || row.created_at || index}`,
        title: `${platformLabel(row.platform)} request`,
        text: `${requestLabelFromStatus(row.status)} · ${row.name || 'Account request'}`,
        badge: requestToneFromStatus(row.status) === 'warn' ? 'Open' : null,
        marker: requestToneFromStatus(row.status),
      })),
    ...(uniqueWalletTopupRequests || [])
      .filter((row) => !['approved', 'completed', 'rejected'].includes(String(row.status || '').toLowerCase()))
      .map((row, index) => ({
        id: `funding-request-${row.id || row.request_id || row.created_at || index}`,
        title: 'Funding request',
        text: `${requestLabelFromStatus(row.status)} · ${fmtMoney(row.amount || 0, row.currency || 'KZT')}`,
        marker: 'neutral',
      })),
    ].slice(0, 3)

    const alerts = buildAlerts(accountRows, accountRequests, financeDocs, uniqueWalletTopupRequests)
    const activeAccounts = accountRows.filter((row) => row.status === 'Active').length
    const warnCount = accountRows.filter((row) => row.noteTone === 'warn').length
    const pendingSetupCount = accountRows.filter((row) => row.status !== 'Active').length
    const platformCount = new Set(uniqueAccounts.map((row) => row.platform).filter(Boolean)).size

    return NextResponse.json({
      financeMode: dbMode ? 'db_fallback' : 'runtime_live',
      metrics: [
        {
          label: 'Available Balance',
          value: fmtMoney(getWalletAvailableBalance(wallet), wallet?.currency || 'USD', 2),
          hint: buildWalletBalanceHint(wallet, ratesPayload),
          tone: 'good',
        },
        {
          label: 'Monthly Spend',
          value: fmtMoney(currentSpend),
          hint: spendDelta == null ? 'Current 30 days' : `vs last period ${spendDelta >= 0 ? '+' : ''}${spendDelta.toFixed(1)}%`,
          tone: spendDelta != null && spendDelta > 0 ? 'warn' : 'good',
        },
        {
          label: 'Active Accounts',
          value: String(activeAccounts),
          hint: `Across ${platformCount} platforms`,
        },
        {
          label: 'Pending Items',
          value: String(pendingSummary.total),
          hint: `${pendingSummary.approvals} approvals · ${pendingSummary.funding} funding · ${pendingSummary.documents} docs`,
          tone: pendingSummary.total > 0 ? 'warn' : undefined,
        },
      ],
      pending: pendingSummary,
      accounts: accountRows,
      accountTags: {
        active: activeAccounts,
        warn: warnCount,
        pending: pendingSetupCount,
      },
      capitalFlow: {
        mode: 'topups_only',
        spendVisible: false,
        currency: 'KZT',
        topupsValue: Number(topupsNormalized.total || 0),
        spend: fmtMoney(currentSpend),
        topups: fmtMoney(topupsNormalized.total, 'KZT'),
        net: `${netFlow >= 0 ? '+' : '-'}${fmtMoney(Math.abs(netFlow))}`,
        insight: 'Completed account funding by selected period.',
        series,
      },
      activity: recentActivity,
      requests: pendingRequests,
      alerts,
      mediaPlan: DEFAULT_MEDIA_PLAN,
      statusAlerts: `${alerts.length} Alerts`,
      statusRows: buildRateStatusRows(ratesPayload),
      range: {
        date_from: current.fromStr,
        date_to: current.toStr,
        custom: hasCustomRange,
      },
    })
  } catch (error) {
    const message = error?.message || 'Overview normalization failed'
    return NextResponse.json(
      {
        detail: message,
      },
      { status: 500 }
    )
  }
}
