import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../../lib/api'
import { getTopupBreakdown, platformLabel } from '../../../../../lib/finance/model'

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

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'completed' || value === 'approved') return 'Completed'
  if (value === 'failed' || value === 'rejected') return 'Failed'
  return 'Pending'
}

function withinDateRange(value, fromStr, toStr) {
  const date = String(value || '').slice(0, 10)
  if (!date) return false
  if (fromStr && date < fromStr) return false
  if (toStr && date > toStr) return false
  return true
}

function filterRows(rows, searchParams) {
  const from = String(searchParams.get('date_from') || '').trim()
  const to = String(searchParams.get('date_to') || '').trim()
  const status = String(searchParams.get('status') || '').trim().toLowerCase()
  const platform = String(searchParams.get('platform') || '').trim().toLowerCase()
  const accountId = String(searchParams.get('account_id') || '').trim()
  return (rows || []).filter((row) => {
    if (!withinDateRange(row?.created_at, from, to)) return false
    if (status && String(row?.status || '').trim().toLowerCase() !== status) return false
    if (platform && String(row?.account_platform || row?.platform || '').trim().toLowerCase() !== platform) return false
    if (accountId && String(row?.account_id || '') !== accountId) return false
    return true
  })
}

function buildCsv(rows) {
  const header = [
    'Date',
    'Topup ID',
    'Platform',
    'Account',
    'Client Funding',
    'Input Currency',
    'Acquiring Fee',
    'VAT',
    'Total Wallet Debit',
    'Net Account Funding',
    'Account Currency',
    'FX Rate',
    'Status',
  ]

  const lines = [
    header,
    ...rows.map((row) => {
      const breakdown = getTopupBreakdown(row)
      return [
        row?.created_at || '',
        row?.id ? `TOPUP-${row.id}` : '',
        platformLabel(row?.account_platform || row?.platform),
        row?.account_name || 'Ad Account',
        Number(breakdown.inputAmount || 0).toFixed(2),
        breakdown.inputCurrency || '',
        Number(breakdown.feeAmount || 0).toFixed(2),
        Number(breakdown.vatAmount || 0).toFixed(2),
        Number(breakdown.totalWalletDebit || 0).toFixed(2),
        Number(breakdown.netAccountFunding || 0).toFixed(2),
        breakdown.accountCurrency || '',
        breakdown.fxRate == null ? '' : String(breakdown.fxRate),
        normalizeStatus(row?.status),
      ]
    }),
  ]

  return `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\n')}`
}

export async function GET(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const upstreamRes = await upstreamFetch('/topups', auth)
  if (upstreamRes.status === 401) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  if (!upstreamRes.ok) {
    const data = await upstreamRes.json().catch(() => ({}))
    return NextResponse.json({ detail: data?.detail || 'Failed to export topups' }, { status: upstreamRes.status || 500 })
  }

  const rows = await upstreamRes.json().catch(() => [])
  const filteredRows = filterRows(Array.isArray(rows) ? rows : [], request.nextUrl.searchParams)
  const csv = buildCsv(filteredRows)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="client-topups.csv"',
    },
  })
}
