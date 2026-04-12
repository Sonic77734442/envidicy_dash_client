import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../../../lib/api'

export const dynamic = 'force-dynamic'

function apiBase() {
  return getApiBase().replace(/\/$/, '')
}

function authHeader(request) {
  const direct = (request.headers.get('authorization') || '').trim()
  if (direct) return direct
  const cookieToken = (request.cookies?.get('auth_token')?.value || '').trim()
  if (cookieToken) return `Bearer ${cookieToken}`
  const token = (request.nextUrl?.searchParams?.get('token') || '').trim()
  return token ? `Bearer ${token}` : ''
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

async function proxyBinaryResponse(upstreamRes, fallbackName) {
  if (!upstreamRes.ok) {
    const data = await upstreamRes.json().catch(() => ({}))
    return NextResponse.json({ detail: data?.detail || 'Failed to fetch generated pdf' }, { status: upstreamRes.status || 500 })
  }
  const headers = new Headers()
  const contentType = upstreamRes.headers.get('content-type') || 'application/pdf'
  const contentDisposition = upstreamRes.headers.get('content-disposition') || `attachment; filename="${fallbackName}"`
  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', contentDisposition)

  const passThroughHeaders = ['cache-control', 'pragma', 'expires', 'last-modified', 'etag']
  for (const name of passThroughHeaders) {
    const value = upstreamRes.headers.get(name)
    if (value) headers.set(name, value)
  }

  return new NextResponse(upstreamRes.body, { status: upstreamRes.status || 200, headers })
}

export async function GET(request, { params }) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const id = params?.id
  if (!id) return NextResponse.json({ detail: 'id is required' }, { status: 400 })

  const upstreamRes = await upstreamFetch(`/wallet/topup-requests/${id}/pdf-generated`, auth)
  return proxyBinaryResponse(upstreamRes, `invoice-${id}.pdf`)
}
