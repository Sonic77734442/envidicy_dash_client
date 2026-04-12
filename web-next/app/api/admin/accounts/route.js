import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../lib/api'
import { normalizeAccountRecord } from '../../../../lib/finance/model'

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

function normalizeAccount(row) {
  const normalized = normalizeAccountRecord(row, { locale: 'ru' })
  return {
    id: row?.id ?? null,
    created_at: row?.created_at || '',
    user_id: row?.user_id ?? null,
    user_email: row?.user_email || '',
    platform: normalized.platform,
    platform_label: normalized.platform_label,
    name: row?.name || '',
    account_code: row?.account_code || '',
    visible_to_client: Number(row?.visible_to_client ?? 1) !== 0,
    external_id: row?.external_id || '',
    currency: row?.currency || '',
    display_currency: normalized.display_currency,
    status: row?.status || '',
    status_key: normalized.status_key,
    status_label: normalized.status_label,
    live_billing: normalized.live_billing,
    live_billing_summary: normalized.live_billing_summary,
  }
}

export async function GET(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const upstreamRes = await upstreamFetch('/admin/accounts', auth)
  if (upstreamRes.status === 401) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  if (upstreamRes.status === 403) return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })
  if (!upstreamRes.ok) {
    const data = await upstreamRes.json().catch(() => ({}))
    return NextResponse.json({ detail: data?.detail || 'Failed to load admin accounts' }, { status: upstreamRes.status || 500 })
  }

  const data = await upstreamRes.json().catch(() => [])
  const items = (Array.isArray(data) ? data : []).map(normalizeAccount)
  return NextResponse.json({ items, count: items.length })
}

export async function POST(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const upstreamRes = await upstreamFetch('/admin/accounts', auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await upstreamRes.json().catch(() => ({}))
  if (!upstreamRes.ok) {
    return NextResponse.json({ detail: data?.detail || 'Failed to create account' }, { status: upstreamRes.status || 500 })
  }
  return NextResponse.json({ ok: true, data })
}
