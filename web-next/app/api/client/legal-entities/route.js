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

  const upstreamRes = await upstreamFetch('/legal-entities', auth)
  if (upstreamRes.status === 401) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const data = await upstreamRes.json().catch(() => [])
  if (!upstreamRes.ok) {
    return NextResponse.json({ detail: data?.detail || 'Failed to fetch legal entities' }, { status: upstreamRes.status || 500 })
  }
  return NextResponse.json(Array.isArray(data) ? data : [])
}

export async function POST(request) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const payload = {
    name: String(body?.name || '').trim(),
    bin: body?.bin ? String(body.bin).trim() : null,
    address: body?.address ? String(body.address).trim() : null,
    email: body?.email ? String(body.email).trim() : null,
    issuer_type: body?.issuer_type ? String(body.issuer_type).trim() : null,
    tax_mode: body?.tax_mode ? String(body.tax_mode).trim() : null,
    contract_number: body?.contract_number ? String(body.contract_number).trim() : null,
    contract_date: body?.contract_date ? String(body.contract_date).trim() : null,
  }
  if (!payload.name) return NextResponse.json({ detail: 'Entity name is required' }, { status: 400 })

  const upstreamRes = await upstreamFetch('/legal-entities', auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await upstreamRes.json().catch(() => ({}))
  if (!upstreamRes.ok) {
    return NextResponse.json({ detail: data?.detail || 'Failed to create legal entity' }, { status: upstreamRes.status || 500 })
  }
  return NextResponse.json(data)
}
