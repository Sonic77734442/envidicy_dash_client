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
    return NextResponse.json({ detail: data?.detail || 'Failed to fetch invoice' }, { status: upstreamRes.status || 500 })
  }
  const headers = new Headers()
  const contentType = upstreamRes.headers.get('content-type') || 'text/html; charset=utf-8'
  const contentDisposition = upstreamRes.headers.get('content-disposition') || `inline; filename="${fallbackName}"`
  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', contentDisposition)

  const passThroughHeaders = ['cache-control', 'pragma', 'expires', 'last-modified', 'etag']
  for (const name of passThroughHeaders) {
    const value = upstreamRes.headers.get(name)
    if (value) headers.set(name, value)
  }

  if (contentType.toLowerCase().includes('text/html')) {
    const html = await upstreamRes.text()
    const patchedHtml = html.replace(
      /\/wallet\/topup-requests\/(\d+)\/pdf-generated(?:\?[^"']*)?/g,
      '/api/client/wallet-topup-requests/$1/pdf-generated'
    )
    return new NextResponse(patchedHtml, { status: upstreamRes.status || 200, headers })
  }

  return new NextResponse(upstreamRes.body, { status: upstreamRes.status || 200, headers })
}

export async function GET(request, { params }) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const id = params?.id
  if (!id) return NextResponse.json({ detail: 'id is required' }, { status: 400 })

  const upstreamRes = await upstreamFetch(`/wallet/topup-requests/${id}/invoice`, auth)
  return proxyBinaryResponse(upstreamRes, `invoice-${id}.html`)
}
