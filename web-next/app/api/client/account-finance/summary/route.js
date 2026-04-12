import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../../lib/api'

export const dynamic = 'force-dynamic'

function apiBase() {
  return getApiBase().replace(/\/$/, '')
}

function authHeader(request) {
  return (request.headers.get('authorization') || '').trim()
}

function buildPath(searchParams) {
  const params = new URLSearchParams(searchParams || [])
  const query = params.toString()
  return query ? `/accounts/finance/summary?${query}` : '/accounts/finance/summary'
}

export async function GET(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const path = buildPath(request.nextUrl.searchParams)
  const upstreamRes = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: auth },
    cache: 'no-store',
  })
  const data = await upstreamRes.json().catch(() => ({}))
  if (!upstreamRes.ok) {
    if (upstreamRes.status === 404) {
      return NextResponse.json(
        {
          detail:
            'Upstream backend does not support /accounts/finance/summary. Switch NEXT_PUBLIC_API_BASE to the new backend deployment.',
          upstream_status: 404,
        },
        { status: 502 }
      )
    }
    return NextResponse.json(
      { detail: data?.detail || 'Failed to load account finance summary' },
      { status: upstreamRes.status || 500 }
    )
  }
  return NextResponse.json(data)
}
