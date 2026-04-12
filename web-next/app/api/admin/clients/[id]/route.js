import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../../lib/api'
import {
  getTopupAccountFundingKzt,
  getTopupBreakdown,
  normalizeAccountRecord,
  platformLabel,
} from '../../../../../lib/finance/model'

export const dynamic = 'force-dynamic'

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

function normalizeAccounts(items) {
  return (Array.isArray(items) ? items : []).map((row) => normalizeAccountRecord(row, { locale: 'ru' }))
}

function normalizeRequests(items) {
  return (Array.isArray(items) ? items : []).map((row, index) => {
    const breakdown = getTopupBreakdown(row)
    return {
      ...row,
      id: row?.id ?? `request-${index}`,
      account_platform_label: platformLabel(row?.account_platform || row?.platform),
      breakdown: {
        inputAmount: breakdown.inputAmount,
        inputCurrency: breakdown.inputCurrency,
        feeAmount: breakdown.feeAmount,
        vatAmount: breakdown.vatAmount,
        totalWalletDebit: breakdown.totalWalletDebit,
        netAccountFunding: breakdown.netAccountFunding,
        accountCurrency: breakdown.accountCurrency,
        fxRate: breakdown.fxRate,
      },
    }
  })
}

function normalizeTopups(items) {
  return (Array.isArray(items) ? items : []).map((row, index) => {
    const breakdown = getTopupBreakdown(row)
    return {
      ...row,
      id: row?.id ?? `topup-${index}`,
      account_platform_label: platformLabel(row?.account_platform || row?.platform),
      breakdown: {
        inputAmount: breakdown.inputAmount,
        inputCurrency: breakdown.inputCurrency,
        feeAmount: breakdown.feeAmount,
        vatAmount: breakdown.vatAmount,
        totalWalletDebit: breakdown.totalWalletDebit,
        netAccountFunding: breakdown.netAccountFunding,
        accountCurrency: breakdown.accountCurrency,
        fxRate: breakdown.fxRate,
      },
    }
  })
}

function normalizeWalletTransactions(items) {
  return (Array.isArray(items) ? items : []).map((row, index) => ({
    ...row,
    id: row?.id ?? `wallet-${index}`,
    account_platform_label: platformLabel(row?.account_platform || row?.platform),
  }))
}

function isCompletedStatus(status) {
  const value = String(status || '').toLowerCase()
  return value === 'completed' || value === 'approved'
}

function isFailedStatus(status) {
  const value = String(status || '').toLowerCase()
  return value === 'failed' || value === 'rejected'
}

function matchesClient(row, id, email) {
  const rowUserId = row?.user_id != null ? String(row.user_id) : ''
  const rowOwnerId = row?.owner_id != null ? String(row.owner_id) : ''
  const rowClientId = row?.client_id != null ? String(row.client_id) : ''
  const rowId = row?.id != null ? String(row.id) : ''
  const rowEmail = String(row?.user_email || row?.email || row?.client_email || row?.owner_email || '').toLowerCase()
  const needleId = String(id || '')
  const needleEmail = String(email || '').toLowerCase()
  if (rowUserId && rowUserId === needleId) return true
  if (rowOwnerId && rowOwnerId === needleId) return true
  if (rowClientId && rowClientId === needleId) return true
  if (rowId && rowId === needleId) return true
  if (needleEmail && rowEmail && rowEmail === needleEmail) return true
  return false
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function buildSummary({ requests, topups, accounts }) {
  const completedTotal = (topups || []).reduce((sum, row) => {
    const value = getTopupAccountFundingKzt(row)
    return Number.isFinite(value) && value > 0 ? sum + value : sum
  }, 0)

  const profitTotal = (topups || []).reduce((sum, row) => {
    const value = Number(row?.profit_total_kzt || 0)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)

  return {
    pendingCount: Array.isArray(requests) ? requests.length : 0,
    completedTotalKzt: completedTotal,
    accountsCount: Array.isArray(accounts) ? accounts.length : 0,
    profitTotalKzt: profitTotal,
  }
}

export async function GET(request, { params }) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const id = params?.id
  if (!id) return NextResponse.json({ detail: 'id is required' }, { status: 400 })

  const responses = await Promise.all([
    upstreamFetch(`/admin/clients/${id}/requests`, auth),
    upstreamFetch(`/admin/clients/${id}/topups`, auth),
    upstreamFetch(`/admin/clients/${id}/wallet-transactions`, auth),
    upstreamFetch(`/admin/clients/${id}/accounts`, auth),
    upstreamFetch(`/admin/clients/${id}/profile`, auth),
    upstreamFetch(`/admin/users/${id}/fees`, auth),
    upstreamFetch(`/admin/clients/${id}/documents`, auth),
  ])

  const labels = ['requests', 'topups', 'walletTransactions', 'accounts', 'profile', 'fees', 'documents']
  let issues = responses
    .map((res, idx) => ({
      source: labels[idx],
      status: res.status,
      ok: res.ok,
    }))
    .filter((entry) => !entry.ok)

  if (responses.some((res) => res.status === 401)) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }
  if (responses.some((res) => res.status === 403)) {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })
  }

  const [requestsRes, topupsRes, walletRes, accountsRes, profileRes, feesRes, documentsRes] = responses
  let [requests, topups, walletTransactions, accounts, profile, fees, documents] = await Promise.all([
    requestsRes.ok ? requestsRes.json() : [],
    topupsRes.ok ? topupsRes.json() : [],
    walletRes.ok ? walletRes.json() : [],
    accountsRes.ok ? accountsRes.json() : [],
    profileRes.ok ? profileRes.json() : null,
    feesRes.ok ? feesRes.json() : null,
    documentsRes.ok ? documentsRes.json() : [],
  ])

  let fallbackEmail = String(profile?.email || '').toLowerCase()
  let fallbackUserId = String(profile?.id ?? profile?.user_id ?? id)
  if (!fallbackEmail) {
    const clientsRes = await upstreamFetch('/admin/clients', auth)
    if (clientsRes.ok) {
      const clients = await clientsRes.json().catch(() => [])
      const found = asArray(clients).find((row) => String(row?.id) === String(id))
      fallbackEmail = String(found?.email || '').toLowerCase()
      if (found?.id != null) fallbackUserId = String(found.id)
      if (found?.user_id != null) fallbackUserId = String(found.user_id)
    }
  }

  if (!fallbackEmail || !fallbackUserId || !feesRes.ok || !documentsRes.ok) {
    const usersRes = await upstreamFetch('/admin/users', auth)
    if (usersRes.ok) {
      const users = await usersRes.json().catch(() => [])
      const found = asArray(users).find((row) => {
        const rowId = String(row?.id ?? '')
        const rowEmail = String(row?.email || '').toLowerCase()
        if (rowId && rowId === String(id)) return true
        if (fallbackEmail && rowEmail && rowEmail === fallbackEmail) return true
        return false
      })
      if (found) {
        if (!fallbackEmail) fallbackEmail = String(found?.email || '').toLowerCase()
        if (found?.id != null) fallbackUserId = String(found.id)
        if (!feesRes.ok && !fees) {
          const feeKeys = ['meta', 'google', 'yandex', 'tiktok', 'telegram', 'monochrome']
          const snapshot = feeKeys.reduce((acc, key) => {
            const value = Number(found?.[key])
            if (Number.isFinite(value)) acc[key] = value
            return acc
          }, {})
          if (Object.keys(snapshot).length) {
            fees = snapshot
            issues = issues.filter((item) => item.source !== 'fees')
          }
        }
      }
    }
  }

  if (!requestsRes.ok || !topupsRes.ok || !walletRes.ok || !accountsRes.ok) {
    const [globalTopupsRes, globalWalletRes, globalAccountsRes] = await Promise.all([
      (!requestsRes.ok || !topupsRes.ok) ? upstreamFetch('/admin/topups', auth) : Promise.resolve(null),
      !walletRes.ok ? upstreamFetch('/admin/wallet-transactions', auth) : Promise.resolve(null),
      !accountsRes.ok ? upstreamFetch('/admin/accounts', auth) : Promise.resolve(null),
    ])

    if ((!requestsRes.ok || !topupsRes.ok) && globalTopupsRes?.ok) {
      const globalTopups = await globalTopupsRes.json().catch(() => [])
      const mine = asArray(globalTopups).filter((row) => matchesClient(row, fallbackUserId || id, fallbackEmail))
      if (!requestsRes.ok) {
        requests = mine.filter((row) => !isCompletedStatus(row?.status) && !isFailedStatus(row?.status))
        issues = issues.filter((item) => item.source !== 'requests')
      }
      if (!topupsRes.ok) {
        topups = mine.filter((row) => isCompletedStatus(row?.status))
        issues = issues.filter((item) => item.source !== 'topups')
      }
    }

    if (!walletRes.ok && globalWalletRes?.ok) {
      const globalWallet = await globalWalletRes.json().catch(() => [])
      walletTransactions = asArray(globalWallet).filter((row) => matchesClient(row, fallbackUserId || id, fallbackEmail))
      issues = issues.filter((item) => item.source !== 'walletTransactions')
    }

    if (!accountsRes.ok && globalAccountsRes?.ok) {
      const globalAccounts = await globalAccountsRes.json().catch(() => [])
      accounts = asArray(globalAccounts).filter((row) => matchesClient(row, fallbackUserId || id, fallbackEmail))
      issues = issues.filter((item) => item.source !== 'accounts')
    }

  }

  if (!feesRes.ok && !fees && fallbackUserId && String(fallbackUserId) !== String(id)) {
    const feesByUserRes = await upstreamFetch(`/admin/users/${fallbackUserId}/fees`, auth)
    if (feesByUserRes.ok) {
      fees = await feesByUserRes.json().catch(() => null)
      if (fees) issues = issues.filter((item) => item.source !== 'fees')
    }
  }

  if ((!documentsRes.ok || !Array.isArray(documents) || !documents.length) && fallbackUserId && String(fallbackUserId) !== String(id)) {
    const docsByUserRes = await upstreamFetch(`/admin/clients/${fallbackUserId}/documents`, auth)
    if (docsByUserRes.ok) {
      documents = await docsByUserRes.json().catch(() => [])
      if (Array.isArray(documents) && documents.length) {
        issues = issues.filter((item) => item.source !== 'documents')
      }
    }
  }

  const normalizedAccounts = normalizeAccounts(accounts)
  const normalizedRequests = normalizeRequests(requests)
  const normalizedTopups = normalizeTopups(topups)
  const normalizedWalletTransactions = normalizeWalletTransactions(walletTransactions)
  const summary = buildSummary({ requests: normalizedRequests, topups: normalizedTopups, accounts: normalizedAccounts })

  return NextResponse.json({
    requests: normalizedRequests,
    topups: normalizedTopups,
    walletTransactions: normalizedWalletTransactions,
    accounts: normalizedAccounts,
    profile: profile || null,
    fees: fees || null,
    documents: asArray(documents),
    summary,
    issues,
  })
}
