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
  const csv = buildCsv(Array.isArray(rows) ? rows : [])
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="client-topups.csv"',
    },
  })
}

