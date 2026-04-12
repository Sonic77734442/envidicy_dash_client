import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../lib/api'
import { platformLabel } from '../../../../lib/finance/model'

export const dynamic = 'force-dynamic'
const BLOCKED_EMAILS = new Set(['test1111@gmail.com'])

function apiBase() {
  return getApiBase().replace(/\/$/, '')
}

function authHeader(request) {
  return (request.headers.get('authorization') || '').trim()
}

async function upstreamFetch(path, auth, options = {}) {
  return fetch(`${apiBase()}${path}`, {
    ...options,
    headers: {
      ...(auth ? { Authorization: auth } : {}),
      ...(options.headers || {}),
    },
    cache: 'no-store',
  })
}

function walletTxTypeLabel(type, amount) {
  const value = String(type || '').toLowerCase()
  if (value === 'adjustment') return 'Wallet Adjustment'
  if (value === 'topup_hold') return 'Funding Hold'
  if (value === 'topup_hold_release') return 'Hold Release'
  if (value === 'topup') return Number(amount || 0) < 0 ? 'Account Funding' : 'Funding Return'
  return Number(amount || 0) >= 0 ? 'Wallet Credit' : 'Wallet Debit'
}

function normalizeWallet(row) {
  return {
    user_id: row?.user_id ?? null,
    user_email: row?.user_email || '',
    balance: Number(row?.balance || 0),
    low_threshold: Number(row?.low_threshold || 0),
    updated_at: row?.updated_at || '',
  }
}

function isBlockedEmail(email) {
  return BLOCKED_EMAILS.has(String(email || '').toLowerCase())
}

function normalizeWalletTransaction(row, index) {
  const amount = Number(row?.amount || 0)
  const note = String(row?.note || '')
  const topupIdMatch = note.match(/#(\d+)/)
  const topupId = topupIdMatch ? Number(topupIdMatch[1]) : null
  return {
    id: row?.id ?? `wallet-tx-${index}`,
    user_id: row?.user_id ?? null,
    account_id: row?.account_id ?? null,
    created_at: row?.created_at || '',
    user_email: row?.user_email || '',
    type: walletTxTypeLabel(row?.type, amount),
    raw_type: row?.type || '',
    amount,
    currency: row?.currency || 'KZT',
    note,
    topup_id: Number.isFinite(topupId) ? topupId : null,
    account_platform: row?.account_platform || '',
    account_platform_label: row?.account_platform ? platformLabel(row.account_platform) : '',
    account_name: row?.account_name || '',
    fee_amount: 0,
    vat_amount: 0,
    gross_amount: Math.abs(amount),
    fx_rate: null,
    operation_status: null,
  }
}

function normalizeProfitRow(row) {
  return {
    platform: row?.platform || '',
    platform_label: row?.platform ? platformLabel(row.platform) : '',
    currency: row?.currency || '',
    completed_count: Number(row?.completed_count || 0),
    amount_input_total: Number(row?.amount_input_total || 0),
    fee_total: Number(row?.fee_total || 0),
    fx_total: Number(row?.fx_total || 0),
    profit_total: Number(row?.profit_total || Number(row?.fee_total || 0) + Number(row?.fx_total || 0)),
  }
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function topupGrossAmount(row) {
  const amountInput = Number(row?.amount_input || 0)
  const feePercent = Number(row?.fee_percent || 0)
  const vatPercent = Number(row?.vat_percent || 0)
  const fee = Number(row?.fee_amount_kzt)
  const vat = Number(row?.vat_amount_kzt)
  const feeResolved = Number.isFinite(fee) ? fee : amountInput * (feePercent / 100)
  const vatResolved = Number.isFinite(vat) ? vat : amountInput * (vatPercent / 100)
  return amountInput + feeResolved + vatResolved
}

function createdAtMs(value) {
  if (!value) return 0
  const ts = Date.parse(String(value))
  return Number.isFinite(ts) ? ts : 0
}

function pickBestLinkedTopup(row, topups) {
  const candidates = topups.filter((topup) => {
    const sameAccount = row.account_id != null && Number(topup?.account_id || 0) === Number(row.account_id)
    const sameUser = String(topup?.user_email || '').toLowerCase() === String(row.user_email || '').toLowerCase()
    return sameAccount || sameUser
  })
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]

  const txGross = Math.abs(Number(row.amount || 0))
  const txTs = createdAtMs(row.created_at)
  let best = candidates[0]
  let bestScore = Number.POSITIVE_INFINITY
  for (const topup of candidates) {
    const gross = Math.abs(topupGrossAmount(topup))
    const grossDelta = Math.abs(gross - txGross)
    const timeDelta = Math.abs(createdAtMs(topup?.created_at) - txTs) / (1000 * 60)
    const score = grossDelta + timeDelta
    if (score < bestScore) {
      best = topup
      bestScore = score
    }
  }
  return best
}

function buildProfitFromTopups(topups) {
  const byKey = new Map()
  const overallByCurrency = new Map()
  const rows = asArray(topups).filter((row) => {
    const status = String(row?.status || '').toLowerCase()
    return status === 'completed' || status === 'approved'
  })

  for (const row of rows) {
    const platform = String(row?.account_platform || row?.platform || '').toLowerCase()
    const currency = String(row?.currency || 'KZT').toUpperCase()
    const amountInput = Number(row?.amount_input || 0)
    const feeTotal = Number(row?.fee_amount_kzt || 0)
    const fxTotal = Number(row?.fx_profit_kzt || 0)
    const profitTotal = Number(row?.profit_total_kzt || feeTotal + fxTotal)
    const key = `${platform}::${currency}`

    if (!byKey.has(key)) {
      byKey.set(key, {
        platform,
        platform_label: platform ? platformLabel(platform) : '',
        currency,
        completed_count: 0,
        amount_input_total: 0,
        fee_total: 0,
        fx_total: 0,
        profit_total: 0,
      })
    }
    const bucket = byKey.get(key)
    bucket.completed_count += 1
    bucket.amount_input_total += Number.isFinite(amountInput) ? amountInput : 0
    bucket.fee_total += Number.isFinite(feeTotal) ? feeTotal : 0
    bucket.fx_total += Number.isFinite(fxTotal) ? fxTotal : 0
    bucket.profit_total += Number.isFinite(profitTotal) ? profitTotal : 0

    if (!overallByCurrency.has(currency)) {
      overallByCurrency.set(currency, {
        currency,
        completed_count: 0,
        amount_input_total: 0,
        fee_total: 0,
        fx_total: 0,
        profit_total: 0,
      })
    }
    const overall = overallByCurrency.get(currency)
    overall.completed_count += 1
    overall.amount_input_total += Number.isFinite(amountInput) ? amountInput : 0
    overall.fee_total += Number.isFinite(feeTotal) ? feeTotal : 0
    overall.fx_total += Number.isFinite(fxTotal) ? fxTotal : 0
    overall.profit_total += Number.isFinite(profitTotal) ? profitTotal : 0
  }

  return {
    by_platform: Array.from(byKey.values()).map(normalizeProfitRow),
    overall: Array.from(overallByCurrency.values()).map((row) => ({
      currency: row.currency || '',
      completed_count: Number(row.completed_count || 0),
      amount_input_total: Number(row.amount_input_total || 0),
      fee_total: Number(row.fee_total || 0),
      fx_total: Number(row.fx_total || 0),
      profit_total: Number(row.profit_total || 0),
    })),
  }
}

export async function GET(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const [walletsRes, lowRes, txRes, topupsRes] = await Promise.all([
    upstreamFetch('/admin/wallets', auth),
    upstreamFetch('/admin/wallets?low_only=1', auth),
    upstreamFetch('/admin/wallet-transactions', auth),
    upstreamFetch('/admin/topups', auth),
  ])

  if ([walletsRes, lowRes, txRes, topupsRes].some((res) => res.status === 401)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }
  if ([walletsRes, lowRes, txRes, topupsRes].some((res) => res.status === 403)) {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })
  }
  if (![walletsRes, lowRes, txRes, topupsRes].every((res) => res.ok)) {
    return NextResponse.json({ detail: 'Failed to load admin wallet data' }, { status: 500 })
  }

  const [walletsData, lowData, txData, topupsData] = await Promise.all([
    walletsRes.json().catch(() => []),
    lowRes.json().catch(() => []),
    txRes.json().catch(() => []),
    topupsRes.json().catch(() => []),
  ])

  const wallets = (Array.isArray(walletsData) ? walletsData : []).map(normalizeWallet).filter((row) => !isBlockedEmail(row.user_email))
  const lowWallets = (Array.isArray(lowData) ? lowData : []).map(normalizeWallet).filter((row) => !isBlockedEmail(row.user_email))
  const topups = asArray(topupsData).filter((row) => !isBlockedEmail(row?.user_email))
  const topupsById = new Map(topups.map((row) => [Number(row?.id), row]))
  const transactions = (Array.isArray(txData) ? txData : [])
    .map(normalizeWalletTransaction)
    .filter((row) => !isBlockedEmail(row.user_email))
    .map((row) => {
    let linkedTopup = null
    if (Number.isFinite(Number(row.topup_id))) {
      linkedTopup = topupsById.get(Number(row.topup_id)) || null
    }
    if (!linkedTopup && (row.raw_type === 'topup' || row.raw_type === 'topup_hold' || row.raw_type === 'topup_hold_release')) {
      linkedTopup = pickBestLinkedTopup(row, topups)
    }
    if (!linkedTopup) return row
    const topupStatusRaw = String(linkedTopup?.status || '').toLowerCase()
    let operationStatus = null
    if (topupStatusRaw === 'completed' || topupStatusRaw === 'approved') operationStatus = 'completed'
    else if (topupStatusRaw === 'failed' || topupStatusRaw === 'rejected') {
      operationStatus = row.raw_type === 'topup_hold_release' ? 'released' : 'failed'
    } else if (topupStatusRaw === 'pending' || topupStatusRaw === 'requested' || topupStatusRaw === 'processing') {
      operationStatus = row.raw_type === 'topup_hold' ? 'held' : 'pending'
    }
    const amountInput = Number(linkedTopup?.amount_input || 0)
    const feePercent = Number(linkedTopup?.fee_percent || 0)
    const vatPercent = Number(linkedTopup?.vat_percent || 0)
    const fee = Number(linkedTopup?.fee_amount_kzt)
    const vat = amountInput * (vatPercent / 100)
    const fallbackFee = amountInput * (feePercent / 100)
    const gross = amountInput + (Number.isFinite(fee) ? fee : fallbackFee) + vat
    return {
      ...row,
      topup_id: row.topup_id || linkedTopup?.id || null,
      fee_amount: Number.isFinite(fee) ? fee : fallbackFee,
      vat_amount: Number.isFinite(vat) ? vat : 0,
      gross_amount: Number.isFinite(gross) ? gross : row.gross_amount,
      fx_rate: Number(linkedTopup?.fx_rate || 0) > 0 ? Number(linkedTopup.fx_rate) : null,
      operation_status: operationStatus,
    }
  })

  const profitSummary = buildProfitFromTopups(topups)

  return NextResponse.json({
    wallets,
    lowWallets,
    transactions,
    profitSummary,
  })
}
