import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../../../lib/api'

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

export async function POST(request, { params }) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const status = String(body?.status || '').trim().toLowerCase()
  const id = params?.id

  if (!id) return NextResponse.json({ detail: 'id is required' }, { status: 400 })
  if (!status) return NextResponse.json({ detail: 'status is required' }, { status: 400 })

  const upstreamRes = await upstreamFetch(`/admin/topups/${id}/status?status=${encodeURIComponent(status)}`, auth, {
    method: 'POST',
  })

  const data = await upstreamRes.json().catch(() => ({}))
  if (!upstreamRes.ok) {
    return NextResponse.json({ detail: data?.detail || 'Failed to update topup status' }, { status: upstreamRes.status || 500 })
  }

  return NextResponse.json({ ok: true, data })
}
