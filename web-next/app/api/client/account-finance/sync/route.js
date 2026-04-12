import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../../lib/api'

export const dynamic = 'force-dynamic'

function apiBase() {
  return getApiBase().replace(/\/$/, '')
}

function authHeader(request) {
  return (request.headers.get('authorization') || '').trim()
}

function appendIfPresent(params, key, value) {
  if (value == null) return
  const text = String(value).trim()
  if (!text) return
  params.set(key, text)
}

export async function POST(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const params = new URLSearchParams()
  appendIfPresent(params, 'date_from', body?.date_from)
  appendIfPresent(params, 'date_to', body?.date_to)
  appendIfPresent(params, 'account_id', body?.account_id)
  appendIfPresent(params, 'refresh_live_billing', body?.refresh_live_billing)

  const query = params.toString()
  const path = query ? `/accounts/finance/sync?${query}` : '/accounts/finance/sync'

  const upstreamRes = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { Authorization: auth },
    cache: 'no-store',
  })
  const data = await upstreamRes.json().catch(() => ({}))
  if (!upstreamRes.ok) {
    return NextResponse.json(
      { detail: data?.detail || 'Failed to sync account finance stats' },
      { status: upstreamRes.status || 500 }
    )
  }
  return NextResponse.json(data)
}
