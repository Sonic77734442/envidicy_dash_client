import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../lib/api'
import {
  aggregateCompletedFundingByAccount,
  accountDisplayCurrency,
  buildWalletBalanceHint,
  extractLiveBalance,
  extractLiveSpend,
  formatMoney,
  getTopupAccountFundingUsd,
  getWalletAvailableBalance,
  normalizeAccountStatus,
  platformLabel,
  sumOverviewSpend,
} from '../../../../lib/finance/model'

export const dynamic = 'force-dynamic'

const DEFAULT_MEDIA_PLAN = {
  status: 'Not connected',
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

function dateRange(days) {
  const to = startOfDay(new Date())
  const from = new Date(to)
  from.setDate(from.getDate() - (days - 1))
  return {
    from,
    to,
    fromStr: from.toISOString().slice(0, 10),
    toStr: to.toISOString().slice(0, 10),
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
    fromStr: from.toISOString().slice(0, 10),
    toStr: to.toISOString().slice(0, 10),
  }
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

function aggregateCompletedTopups(topups, fromStr, toStr) {
  const daily = new Map()
  let total = 0
  for (const row of topups || []) {
    const status = String(row.status || '').toLowerCase()
    if (status !== 'completed') continue
    const date = String(row.created_at || '').slice(0, 10)
    if (!date || date < fromStr || date > toStr) continue
    const amount = getTopupAccountFundingUsd(row)
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
    dates.push(value.toISOString().slice(0, 10))
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
    soft: Math.max(24, Math.round((row.topups / max) * 188)),
    strong: Math.max(24, Math.round((row.spend / max) * 188)),
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
  for (const account of accounts) {
    if (account.balanceState === 'depleted' || account.balanceState === 'low') {
      alerts.push({
        id: `alert-account-${account.account}`,
        type: 'low_balance',
        severity: account.balanceState === 'depleted' ? 'high' : 'medium',
        title: `${account.account} requires funding`,
        action: account.noteAction || 'Top up now',
        accountId: account.accountId || null,
      })
    } else if (account.balanceState === 'setup') {
      alerts.push({
        id: `alert-setup-${account.account}`,
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
      alerts.push({
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
      alerts.push({
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
  const current = dateRange(30)
  const previous = previousRange(30)

  const responses = await Promise.all([
    upstreamFetch('/wallet', auth),
    upstreamFetch('/rates/bcc', auth),
    upstreamFetch(`/insights/overview?date_from=${current.fromStr}&date_to=${current.toStr}`, auth),
    upstreamFetch(`/insights/overview?date_from=${previous.fromStr}&date_to=${previous.toStr}`, auth),
    upstreamFetch('/accounts?include_live_billing=1', auth),
    upstreamFetch('/accounts/funding-totals', auth),
    upstreamFetch(`/accounts/spend?date_from=${current.fromStr}&date_to=${current.toStr}`, auth),
    upstreamFetch('/account-requests', auth),
    upstreamFetch('/notifications', auth),
    upstreamFetch('/topups', auth),
    upstreamFetch('/wallet/topup-requests', auth),
    upstreamFetch('/client-finance-documents', auth),
    dbMode ? upstreamFetch('/accounts/finance/summary', auth) : Promise.resolve(null),
  ])

  if (responses.some((res) => res.status === 401)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const [
    walletRes,
    ratesRes,
    currentSpendRes,
    previousSpendRes,
    accountsRes,
    fundingRes,
    accountSpendRes,
    requestsRes,
    notificationsRes,
    topupsRes,
    topupReqRes,
    financeDocsRes,
    financeSummaryRes,
  ] = responses

  const [
    wallet,
    ratesPayload,
    currentSpendPayload,
    previousSpendPayload,
    accounts,
    fundingPayload,
    accountSpendPayload,
    accountRequests,
    notifications,
    topups,
    walletTopupRequests,
    financeDocs,
    financeSummaryPayload,
  ] = await Promise.all([
    walletRes.ok ? walletRes.json() : null,
    ratesRes.ok ? ratesRes.json() : null,
    currentSpendRes.ok ? currentSpendRes.json() : null,
    previousSpendRes.ok ? previousSpendRes.json() : null,
    accountsRes.ok ? accountsRes.json() : [],
    fundingRes.ok ? fundingRes.json() : { items: [] },
    accountSpendRes.ok ? accountSpendRes.json() : { items: [] },
    requestsRes.ok ? requestsRes.json() : [],
    notificationsRes.ok ? notificationsRes.json() : { items: [] },
    topupsRes.ok ? topupsRes.json() : [],
    topupReqRes.ok ? topupReqRes.json() : [],
    financeDocsRes.ok ? financeDocsRes.json() : [],
    financeSummaryRes?.ok ? financeSummaryRes.json() : { items: [] },
  ])

  const financeSummaryMap = new Map(
    (Array.isArray(financeSummaryPayload?.items) ? financeSummaryPayload.items : [])
      .filter((row) => row?.account_id != null)
      .map((row) => [String(row.account_id), row])
  )

  const currentSpend = sumOverviewSpend(currentSpendPayload)
  const previousSpend = sumOverviewSpend(previousSpendPayload)
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

  const spendDailyRows = mergeDailySpend(currentSpendPayload)
  const spendDaily = new Map(spendDailyRows.map((row) => [row.date, Number(row.spend || 0)]))
  const topupsNormalized = aggregateCompletedTopups(topups, current.fromStr, current.toStr)
  const series = lastDaysSeries(current, spendDaily, topupsNormalized.daily)
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
      spend: fmtMoney(currentSpend),
      topups: fmtMoney(topupsNormalized.total),
      net: `${netFlow >= 0 ? '+' : '-'}${fmtMoney(Math.abs(netFlow))}`,
      insight: netFlow >= 0 ? 'Completed account funding is currently covering period spend.' : 'Completed account funding is trailing period spend.',
      series,
    },
    activity: recentActivity,
    requests: pendingRequests,
    alerts,
    mediaPlan: DEFAULT_MEDIA_PLAN,
    statusAlerts: `${alerts.length} Alerts`,
    statusRows: [
      { icon: '$', label: 'USD/KZT 471.2' },
      { icon: '€', label: 'EUR/USD 1.08' },
    ],
  })
}
