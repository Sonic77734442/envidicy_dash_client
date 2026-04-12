import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../../lib/api'

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

export async function GET(request, { params }) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const id = params?.id
  if (!id) return NextResponse.json({ detail: 'id is required' }, { status: 400 })

  const upstreamRes = await upstreamFetch(`/client-finance-documents/${id}`, auth)
  if (!upstreamRes.ok) {
    const data = await upstreamRes.json().catch(() => ({}))
    return NextResponse.json({ detail: data?.detail || 'Failed to fetch finance document' }, { status: upstreamRes.status || 500 })
  }

  const bytes = await upstreamRes.arrayBuffer()
  const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream'
  const contentLength = upstreamRes.headers.get('content-length')
  const contentDisposition = upstreamRes.headers.get('content-disposition') || `attachment; filename="finance-document-${id}"`
  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': contentDisposition,
  })
  if (contentLength) headers.set('Content-Length', contentLength)
  return new NextResponse(bytes, { status: 200, headers })
}
