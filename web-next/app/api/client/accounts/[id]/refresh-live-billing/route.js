import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../../../lib/api'

export const dynamic = 'force-dynamic'

function apiBase() {
  return getApiBase().replace(/\/$/, '')
}

function authHeader(request) {
  return (request.headers.get('authorization') || '').trim()
}

export async function POST(request, { params }) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const id = params?.id
  if (!id) return NextResponse.json({ detail: 'id is required' }, { status: 400 })

  const upstreamRes = await fetch(`${apiBase()}/accounts/${id}/refresh-live-billing`, {
    method: 'POST',
    headers: {
      Authorization: auth,
    },
    cache: 'no-store',
  })

  const data = await upstreamRes.json().catch(() => ({}))
  if (!upstreamRes.ok) {
    return NextResponse.json(
      { detail: data?.detail || 'Failed to refresh account live billing' },
      { status: upstreamRes.status || 500 }
    )
  }

  return NextResponse.json({ ok: true, data })
}
