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

function normalizeClient(row) {
  return {
    id: row?.id ?? null,
    email: row?.email || '',
    pending_requests: Number(row?.pending_requests || 0),
    completed_total_kzt: Number(row?.completed_total_kzt ?? row?.completed_total ?? 0),
    completed_total: Number(row?.completed_total ?? row?.completed_total_kzt ?? 0),
  }
}

export async function GET(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const upstreamRes = await upstreamFetch('/admin/clients', auth)
  if (upstreamRes.status === 401) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  if (upstreamRes.status === 403) return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })
  if (!upstreamRes.ok) {
    const data = await upstreamRes.json().catch(() => ({}))
    return NextResponse.json({ detail: data?.detail || 'Failed to load admin clients' }, { status: upstreamRes.status || 500 })
  }

  const data = await upstreamRes.json().catch(() => [])
  const items = (Array.isArray(data) ? data : []).map(normalizeClient)
  return NextResponse.json({ items, count: items.length })
}
