import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../lib/api'
import {
  buildWalletBalanceHint,
  formatMoney,
  getMarkedRate,
  getTopupAccountFundingUsd,
  getTopupBreakdown,
  getWalletAvailableBalance,
  sumOverviewSpend,
} from '../../../../lib/finance/model'

export const dynamic = 'force-dynamic'

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
    fromStr: from.toISOString().slice(0, 10),
    toStr: to.toISOString().slice(0, 10),
  }
}

function fmtMoney(value, currency = 'USD', digits = 0) {
  return formatMoney(value, currency, digits)
}

function fmtDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
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
  return fmtDate(value)
}

function topupStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'completed' || value === 'approved') return 'Completed'
  if (value === 'invoice_ready' || value === 'invoice_pending' || value === 'requested' || value === 'pending') return 'Processing'
  if (value === 'rejected') return 'Rejected'
  return 'Processing'
}

function walletTxTypeLabel(type, amount) {
  const value = String(type || '').toLowerCase()
  if (value === 'adjustment') return 'Wallet Adjustment'
  if (value === 'topup_hold') return 'Funding Hold'
  if (value === 'topup_hold_release') return 'Hold Release'
  if (value === 'topup') return Number(amount || 0) < 0 ? 'Account Funding' : 'Funding Return'
  return Number(amount || 0) >= 0 ? 'Wallet Credit' : 'Wallet Debit'
}

function walletTxStatus(type) {
  const value = String(type || '').toLowerCase()
  if (value === 'topup_hold') return 'Processing'
  return 'Completed'
}

function walletTxNote(type, note) {
  const value = String(type || '').toLowerCase()
  if (value === 'topup_hold') return 'Reserved for pending account funding'
  if (value === 'topup_hold_release') return 'Previously reserved funding returned to wallet'
  if (value === 'topup') return note || 'Account funding movement'
  if (value === 'adjustment') return note || 'Manual wallet adjustment'
  return note || 'Wallet movement'
}

function buildDetailFromRow(first, financeDocs) {
  if (!first) {
    return {
      status: 'No data',
      referenceId: '—',
      legalEntity: '—',
      account: '—',
      category: '—',
      note: 'No recent financial movements were found for this period.',
      primaryAction: 'Raise a Question',
      secondaryAction: 'Download Document',
      primaryActionHref: null,
      secondaryActionHref: null,
      documentName: 'No document attached',
      documentMeta: '—',
      documentUrl: null,
      extraRows: [],
    }
  }

  const latestDoc = (financeDocs || [])[0]
  return {
    status: first.status,
    referenceId: first.referenceId || '—',
    legalEntity: first.entity || '—',
    account: first.account || 'Main Operating',
    category: first.type || 'Finance',
    note: first.note,
    primaryAction: first.primaryAction || (first.status === 'Action Required' ? 'Resolve Issue' : 'Raise a Question'),
    secondaryAction: first.secondaryAction || (latestDoc?.file_name ? 'Open Document' : 'Download Document'),
    primaryActionHref: first.primaryActionHref || null,
    secondaryActionHref: first.documentUrl || first.secondaryActionHref || null,
    documentName: latestDoc?.file_name || 'No document attached',
    documentMeta: latestDoc ? `Uploaded ${fmtDate(latestDoc.created_at || latestDoc.document_date)}` : '—',
    documentUrl: first.documentUrl || null,
    extraRows: Array.isArray(first.extraRows) ? first.extraRows : [],
  }
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

function buildRateTicks(ratesPayload) {
  const usdRate = getMarkedRate(ratesPayload?.rates?.USD)
  const eurRate = getMarkedRate(ratesPayload?.rates?.EUR)
  const ticks = []
  if (Number.isFinite(usdRate) && usdRate > 0) ticks.push({ label: 'USD/KZT', value: usdRate.toFixed(1) })
  if (Number.isFinite(eurRate) && eurRate > 0) ticks.push({ label: 'EUR/KZT', value: eurRate.toFixed(1) })
  return ticks
}

function buildRateStatusRows(ratesPayload) {
  const usdRate = getMarkedRate(ratesPayload?.rates?.USD)
  const eurRate = getMarkedRate(ratesPayload?.rates?.EUR)
  const rows = []
  if (Number.isFinite(usdRate) && usdRate > 0) rows.push({ icon: '$', label: `USD/KZT ${usdRate.toFixed(1)}` })
  if (Number.isFinite(eurRate) && eurRate > 0) rows.push({ icon: '€', label: `EUR/KZT ${eurRate.toFixed(1)}` })
  return rows
}

export async function GET(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const current = dateRange(30)

  const responses = await Promise.all([
    upstreamFetch('/wallet', auth),
    upstreamFetch('/rates/bcc', auth),
    upstreamFetch(`/insights/overview?date_from=${current.fromStr}&date_to=${current.toStr}`, auth),
    upstreamFetch('/wallet/transactions', auth),
    upstreamFetch('/topups', auth),
    upstreamFetch('/wallet/topup-requests', auth),
    upstreamFetch('/client-finance-documents', auth),
  ])

  if (responses.some((res) => res.status === 401)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const [walletRes, ratesRes, spendRes, walletTxRes, topupsRes, topupReqRes, financeDocsRes] = responses
  const [wallet, ratesPayload, spendPayload, walletTransactions, topups, topupRequests, financeDocs] = await Promise.all([
    walletRes.ok ? walletRes.json() : null,
    ratesRes.ok ? ratesRes.json() : null,
    spendRes.ok ? spendRes.json() : null,
    walletTxRes.ok ? walletTxRes.json() : [],
    topupsRes.ok ? topupsRes.json() : [],
    topupReqRes.ok ? topupReqRes.json() : [],
    financeDocsRes.ok ? financeDocsRes.json() : [],
  ])

  const periodSpend = sumOverviewSpend(spendPayload)
  const completedTopups = (topups || []).filter((row) => {
    const status = String(row.status || '').toLowerCase()
    const date = String(row.created_at || '').slice(0, 10)
    return status === 'completed' && date >= current.fromStr && date <= current.toStr
  })
  const periodTopups = completedTopups.reduce((sum, row) => sum + getTopupAccountFundingUsd(row), 0)
  const uniqueInvoiceRequests = dedupeBy(
    (topupRequests || []).slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    fundingRequestFingerprint
  )

  const openInvoiceRequests = uniqueInvoiceRequests.filter((row) =>
    ['requested', 'pending', 'invoice_pending', 'invoice_ready'].includes(String(row.status || '').toLowerCase())
  )

  const normalizedTransactions = (walletTransactions || [])
    .map((row, index) => {
      const amount = Number(row.amount || 0)
      const currency = row.currency || 'KZT'
      const positive = amount > 0
      const type = walletTxTypeLabel(row.type, amount)
      const status = walletTxStatus(row.type)
      return {
        id: `wallet-tx-${row.id || row.created_at || index}`,
        date: fmtDate(row.created_at),
        title: row.account_name || type,
        subtitle: walletTxNote(row.type, row.note),
        type,
        entity: row.account_platform ? String(row.account_platform).toUpperCase() : 'Client Wallet',
        amount: `${positive ? '+' : '-'}${fmtMoney(Math.abs(amount), currency, 2).replace(/^\$/, '$')}`,
        positive,
        status,
        referenceId: row.id ? `#WTX-${row.id}` : '—',
        account: row.account_name || 'Client Wallet',
        note: walletTxNote(row.type, row.note),
        primaryAction: 'Raise a Question',
        secondaryAction: 'Download Document',
        primaryActionHref: null,
        secondaryActionHref: null,
        documentUrl: null,
        rawCreatedAt: row.created_at || '',
      }
    })
    .sort((a, b) => String(b.rawCreatedAt).localeCompare(String(a.rawCreatedAt)))

  const normalizedTopups = (topups || [])
    .map((row, index) => {
      const amount = getTopupAccountFundingUsd(row)
      const breakdown = getTopupBreakdown(row)
      const hasAcquiring = breakdown.feePercent > 0
      return {
        id: `topup-${row.id || row.created_at || index}`,
        date: fmtDate(row.created_at),
        title: row.account_name || 'Account Funding',
        subtitle: `${breakdown.fxRate ? `FX ${breakdown.fxRate}` : 'No FX'} · ${hasAcquiring ? `Acquiring ${breakdown.feePercent}%` : 'No acquiring fee'}`,
        type: 'Account Funding',
        entity: row.account_platform ? String(row.account_platform).toUpperCase() : 'Ad Account',
        amount: fmtMoney(amount, 'USD', 2),
        positive: true,
        status: topupStatus(row.status),
        referenceId: row.id ? `#TOPUP-${row.id}` : '—',
        account: row.account_name || 'Ad Account',
        note: row.status === 'completed' ? 'Funding delivered to the ad account.' : 'Funding request is still in progress.',
        primaryAction: row.status === 'completed' ? 'View Funding' : 'Review Funding',
        secondaryAction: 'Download Document',
        primaryActionHref: null,
        secondaryActionHref: null,
        documentUrl: null,
        extraRows: [
          { label: 'Funding Currency', value: breakdown.inputCurrency },
          { label: 'Client Funding', value: fmtMoney(breakdown.inputAmount, breakdown.inputCurrency, 2) },
          { label: 'Acquiring Fee', value: hasAcquiring ? `-${fmtMoney(breakdown.feeAmount, breakdown.inputCurrency, 2)}` : 'Not applied' },
          { label: 'VAT', value: breakdown.vatPercent > 0 ? `-${fmtMoney(breakdown.vatAmount, breakdown.inputCurrency, 2)}` : 'Not applied' },
          { label: 'Total Wallet Debit', value: fmtMoney(breakdown.totalWalletDebit, breakdown.inputCurrency, 2) },
          { label: 'Net Account Funding', value: fmtMoney(breakdown.netAccountFunding, breakdown.accountCurrency, 2) },
          { label: 'FX Rate', value: breakdown.fxRate ? String(breakdown.fxRate) : 'Not applied' },
          { label: 'Acquiring', value: hasAcquiring ? `${breakdown.feePercent}% fee` : 'Not applied' },
        ],
        rawCreatedAt: row.created_at || '',
      }
    })
    .sort((a, b) => String(b.rawCreatedAt).localeCompare(String(a.rawCreatedAt)))

  const normalizedInvoices = uniqueInvoiceRequests
    .map((row, index) => ({
      id: `invoice-${row.id || row.created_at || index}`,
      date: fmtDate(row.invoice_date || row.created_at),
      title: row.invoice_number || 'Funding Invoice',
      subtitle: row.legal_entity_name || row.client_name || 'Invoice request',
      type: 'Invoice',
      entity: row.legal_entity_name || 'Client Entity',
      amount: fmtMoney(row.invoice_amount || row.amount || 0, row.invoice_currency || row.currency || 'KZT', 2),
      positive: false,
      status: topupStatus(row.status),
      referenceId: row.invoice_number || (row.id ? `#INV-${row.id}` : '—'),
      account: 'Wallet Funding',
      note: row.status === 'invoice_ready' ? 'Invoice is ready for payment.' : 'Invoice is still being prepared.',
      primaryAction: 'View Invoice',
      secondaryAction: 'Download PDF',
      primaryActionHref: row.id ? `/api/client/wallet-topup-requests/${row.id}/invoice` : null,
      secondaryActionHref: row.id ? `/api/client/wallet-topup-requests/${row.id}/pdf-generated` : null,
      documentUrl: row.id ? `/api/client/wallet-topup-requests/${row.id}/invoice` : null,
      rawCreatedAt: row.created_at || '',
    }))
    .sort((a, b) => String(b.rawCreatedAt).localeCompare(String(a.rawCreatedAt)))

  const normalizedDocs = (financeDocs || [])
    .map((row, index) => ({
      id: `doc-${row.id || row.created_at || index}`,
      date: fmtDate(row.document_date || row.created_at),
      title: row.title || row.file_name || 'Finance Document',
      subtitle: row.file_name || row.document_number || 'Uploaded document',
      type: String(row.document_type || '').toLowerCase() === 'avr' ? 'AVR' : 'Invoice Document',
      entity: row.currency || 'KZT',
      amount: row.amount != null ? fmtMoney(row.amount, row.currency || 'KZT', 2) : '—',
      positive: false,
      status: 'Completed',
      referenceId: row.document_number || (row.id ? `#DOC-${row.id}` : '—'),
      account: 'Finance Documents',
      note: 'Client finance document uploaded to the vault.',
      primaryAction: 'Open Document',
      secondaryAction: 'Download Document',
      primaryActionHref: row.id ? `/api/client/finance-documents/${row.id}` : null,
      secondaryActionHref: row.id ? `/api/client/finance-documents/${row.id}` : null,
      documentUrl: row.id ? `/api/client/finance-documents/${row.id}` : null,
      rawCreatedAt: row.created_at || '',
    }))
    .sort((a, b) => String(b.rawCreatedAt).localeCompare(String(a.rawCreatedAt)))

  const selectedDetail = buildDetailFromRow(normalizedTransactions[0], financeDocs)

  return NextResponse.json({
    metrics: [
      {
        label: 'Available Balance',
        value: fmtMoney(getWalletAvailableBalance(wallet), wallet?.currency || 'USD', 2),
        hint: buildWalletBalanceHint(wallet, ratesPayload),
        tone: 'good',
      },
      {
        label: 'Top-Ups This Period',
        value: fmtMoney(periodTopups, 'USD', 2),
        hint: 'Last 30 days',
        tone: periodTopups > 0 ? 'good' : undefined,
      },
      {
        label: 'Platform Spend',
        value: fmtMoney(periodSpend, 'USD', 2),
        hint: periodTopups > periodSpend ? 'Funding exceeds current spend' : 'Spend is leading funding',
        tone: periodTopups > periodSpend ? 'good' : 'warn',
      },
      {
        label: 'Outstanding Invoices',
        value: String(openInvoiceRequests.length),
        hint: openInvoiceRequests.length ? `${openInvoiceRequests.length} require immediate action` : 'No open invoice requests',
        tone: openInvoiceRequests.length ? 'warn' : undefined,
      },
    ],
    tabs: [
      { key: 'Transactions', count: normalizedTransactions.length },
      { key: 'Topups', count: normalizedTopups.length },
      { key: 'Invoices', count: normalizedInvoices.length },
      { key: 'Finance docs', count: normalizedDocs.length },
    ],
    transactions: normalizedTransactions.slice(0, 25),
    topups: normalizedTopups.slice(0, 25),
    invoices: normalizedInvoices.slice(0, 25),
    financeDocs: normalizedDocs.slice(0, 25),
    pager: {
      label: `Showing 1-${Math.min(normalizedTransactions.length, 25)} of ${normalizedTransactions.length} transactions`,
    },
    detail: selectedDetail,
    ticks: buildRateTicks(ratesPayload),
    statusAlerts: openInvoiceRequests.length ? `${openInvoiceRequests.length} Alerts` : 'No Alerts',
    statusRows: buildRateStatusRows(ratesPayload),
    financeDocsCount: Array.isArray(financeDocs) ? financeDocs.length : 0,
    invoiceRequestsCount: openInvoiceRequests.length,
    lastUpdated: relativeTime(normalizedTransactions[0]?.rawCreatedAt),
  })
}
