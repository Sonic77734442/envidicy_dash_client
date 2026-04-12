import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../lib/api'

export const dynamic = 'force-dynamic'

function apiBase() {
  return getApiBase().replace(/\/$/, '')
}

function authHeader(request) {
  return (request.headers.get('authorization') || '').trim()
}

export async function POST(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const payload = body?.payload
  const name = String(payload?.name || '').trim()
  const platform = String(payload?.platform || '').trim().toLowerCase()

  if (!name) return NextResponse.json({ detail: 'Account name is required' }, { status: 400 })
  if (!platform) return NextResponse.json({ detail: 'Platform is required' }, { status: 400 })

  const res = await fetch(`${apiBase()}/account-requests`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      platform,
      name,
      payload,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return NextResponse.json({ detail: data?.detail || 'Failed to create account request' }, { status: res.status || 500 })
  }

  return NextResponse.json({ ok: true, request: data })
}
