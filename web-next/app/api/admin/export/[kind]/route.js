import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../../lib/api'

export const dynamic = 'force-dynamic'

const ALLOWED_KINDS = new Set(['requests', 'accounts', 'topups'])

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

function buildTopupsCsv(items) {
  const rows = Array.isArray(items) ? items : []
  const lines = [
    ['Date', 'Client', 'Platform', 'Account', 'Amount', 'Fee', 'VAT', 'Total Wallet Debit', 'Currency', 'Status'],
    ...rows.map((row) => {
      const amount = Number(row?.amount_input || 0)
      const feePercent = Number(row?.fee_percent || 0)
      const vatPercent = Number(row?.vat_percent || 0)
      const fee = amount * (feePercent / 100)
      const vat = amount * (vatPercent / 100)
      const total = amount + fee + vat
      return [
        row?.created_at || '',
        row?.user_email || '',
        row?.account_platform || row?.platform || '',
        row?.account_name || '',
        amount.toFixed(2),
        fee.toFixed(2),
        vat.toFixed(2),
        total.toFixed(2),
        row?.currency || '',
        row?.status || '',
      ]
    }),
  ]
  return `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\n')}`
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.results)) return payload.results
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function normalizeStatus(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'completed' || value === 'approved') return 'completed'
  if (value === 'failed' || value === 'rejected') return 'failed'
  return 'pending'
}

function hasManualRisk(row) {
  const amount = Number(row?.amount_input || 0)
  const feePercent = Number(row?.fee_percent || 0)
  const vatPercent = Number(row?.vat_percent || 0)
  const fee = amount * (feePercent / 100)
  const vat = amount * (vatPercent / 100)
  const fxRate = Number(row?.fx_rate)
  const status = normalizeStatus(row?.status)
  if (fee + vat > amount) return true
  if (!Number.isFinite(fxRate) || fxRate <= 0) return true
  if (status === 'failed') return true
  return false
}

function totalWalletDebit(row) {
  const amount = Number(row?.amount_input || 0)
  const feePercent = Number(row?.fee_percent || 0)
  const vatPercent = Number(row?.vat_percent || 0)
  const fee = amount * (feePercent / 100)
  const vat = amount * (vatPercent / 100)
  return amount + fee + vat
}

function filterTopups(items, searchParams) {
  const view = String(searchParams.get('view') || 'all').toLowerCase()
  const status = String(searchParams.get('status') || '').toLowerCase()
  const email = String(searchParams.get('email') || '').toLowerCase()
  const platform = String(searchParams.get('platform') || '').toLowerCase()
  const dateFrom = String(searchParams.get('dateFrom') || '')
  const dateTo = String(searchParams.get('dateTo') || '')
  const amountMin = Number(searchParams.get('amountMin') || 0)
  const hasAmountMin = Number.isFinite(amountMin) && amountMin > 0

  return items.filter((row) => {
    const rowStatus = normalizeStatus(row?.status)
    const created = String(row?.created_at || '').replace('T', ' ').split(' ')[0]
    const rowEmail = String(row?.user_email || '').toLowerCase()
    const rowPlatform = String(row?.account_platform || row?.platform || '').toLowerCase()
    const gross = totalWalletDebit(row)

    if (view === 'pending' && rowStatus !== 'pending') return false
    if (view === 'high' && gross < 100000) return false
    if (view === 'manual' && !hasManualRisk(row)) return false

    if (status && rowStatus !== status) return false
    if (email && !rowEmail.includes(email)) return false
    if (platform && rowPlatform !== platform) return false
    if (hasAmountMin && gross < amountMin) return false
    if (dateFrom && created && created < dateFrom) return false
    if (dateTo && created && created > dateTo) return false
    return true
  })
}

export async function GET(request, { params }) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const kind = String(params?.kind || '').trim().toLowerCase()
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ detail: 'Unsupported export kind' }, { status: 400 })
  }

  if (kind === 'topups') {
    const topupsRes = await upstreamFetch('/admin/topups', auth)
    if (!topupsRes.ok) {
      const data = await topupsRes.json().catch(() => ({}))
      return NextResponse.json({ detail: data?.detail || 'Failed to export data' }, { status: topupsRes.status || 500 })
    }
    const payload = await topupsRes.json().catch(() => [])
    const filtered = filterTopups(asArray(payload), request.nextUrl.searchParams)
    const csv = buildTopupsCsv(filtered)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="topups.csv"',
      },
    })
  }

  const upstreamRes = await upstreamFetch(`/admin/export/${kind}.xlsx`, auth)
  if (!upstreamRes.ok) {
    const data = await upstreamRes.json().catch(() => ({}))
    return NextResponse.json({ detail: data?.detail || 'Failed to export data' }, { status: upstreamRes.status || 500 })
  }

  const bytes = await upstreamRes.arrayBuffer()
  const contentType = upstreamRes.headers.get('content-type') || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const contentLength = upstreamRes.headers.get('content-length')
  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${kind}.xlsx"`,
  })
  if (contentLength) headers.set('Content-Length', contentLength)
  return new NextResponse(bytes, { status: 200, headers })
}
