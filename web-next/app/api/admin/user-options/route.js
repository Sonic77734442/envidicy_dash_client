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

  const [clientsRes, usersRes] = await Promise.all([
    upstreamFetch('/admin/clients', auth),
    upstreamFetch('/admin/users', auth),
  ])

  if (clientsRes.status === 401 || usersRes.status === 401) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }
  if (clientsRes.status === 403 || usersRes.status === 403) {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })
  }
  if (!clientsRes.ok || !usersRes.ok) {
    const [clientsErr, usersErr] = await Promise.all([
      clientsRes.json().catch(() => ({})),
      usersRes.json().catch(() => ({})),
    ])
    return NextResponse.json(
      { detail: clientsErr?.detail || usersErr?.detail || 'Failed to load admin user options' },
      { status: clientsRes.status || usersRes.status || 500 }
    )
  }

  const [clients, users] = await Promise.all([
    clientsRes.json().catch(() => []),
    usersRes.json().catch(() => []),
  ])

  const unique = new Map()
  for (const row of [...(Array.isArray(clients) ? clients : []), ...(Array.isArray(users) ? users : [])]) {
    if (row?.id != null && row?.email) unique.set(String(row.id), { id: row.id, email: row.email })
  }

  const items = Array.from(unique.values()).sort((a, b) => String(a.email).localeCompare(String(b.email), 'ru'))
  return NextResponse.json({ items, count: items.length })
}
