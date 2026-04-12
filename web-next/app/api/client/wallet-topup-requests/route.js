import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../lib/api'

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

export async function GET(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const upstreamRes = await upstreamFetch('/wallet/topup-requests', auth)
  if (upstreamRes.status === 401) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const data = await upstreamRes.json().catch(() => [])
  if (!upstreamRes.ok) {
    return NextResponse.json({ detail: data?.detail || 'Failed to fetch topup requests' }, { status: upstreamRes.status || 500 })
  }
  return NextResponse.json(Array.isArray(data) ? data : [])
}

export async function POST(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const payload = {
    amount: Number(body?.amount || 0),
    currency: String(body?.currency || 'KZT').toUpperCase(),
    note: body?.note ? String(body.note) : null,
    legal_entity_id: body?.legal_entity_id ? Number(body.legal_entity_id) : null,
  }

  if (!(Number.isFinite(payload.amount) && payload.amount > 0)) {
    return NextResponse.json({ detail: 'Enter a valid amount' }, { status: 400 })
  }

  const upstreamRes = await upstreamFetch('/wallet/topup-requests', auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await upstreamRes.json().catch(() => ({}))
  if (!upstreamRes.ok) {
    return NextResponse.json({ detail: data?.detail || 'Failed to create topup request' }, { status: upstreamRes.status || 500 })
  }

  return NextResponse.json(data)
}
