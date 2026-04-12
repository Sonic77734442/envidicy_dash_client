import { NextResponse } from 'next/server'
import { getApiBase } from '../../../../../../../lib/api'

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

function buildFilename({ documentType, documentNumber, title, fileName }) {
  if (fileName) return fileName
  const prefix = String(documentType || '').toLowerCase() === 'avr' ? 'avr' : 'invoice'
  const suffix = String(documentNumber || title || '').trim().replace(/[^\w.-]+/g, '_')
  return suffix ? `${prefix}_${suffix}` : `${prefix}.pdf`
}

export async function GET(request, { params }) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const id = params?.id
  const docId = params?.docId
  if (!id || !docId) return NextResponse.json({ detail: 'id and docId are required' }, { status: 400 })

  const upstreamRes = await upstreamFetch(`/admin/clients/${id}/documents/${docId}`, auth)
  if (!upstreamRes.ok) {
    const data = await upstreamRes.json().catch(() => ({}))
    return NextResponse.json({ detail: data?.detail || 'Failed to download document' }, { status: upstreamRes.status || 500 })
  }

  const bytes = await upstreamRes.arrayBuffer()
  const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream'
  const contentLength = upstreamRes.headers.get('content-length')
  const fileName = buildFilename({
    documentType: request.nextUrl.searchParams.get('document_type'),
    documentNumber: request.nextUrl.searchParams.get('document_number'),
    title: request.nextUrl.searchParams.get('title'),
    fileName: request.nextUrl.searchParams.get('file_name'),
  })

  const headers = new Headers({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${fileName}"`,
  })
  if (contentLength) headers.set('Content-Length', contentLength)

  return new NextResponse(bytes, { status: 200, headers })
}

export async function DELETE(request, { params }) {
  const auth = authHeader(request)
  if (!auth) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const id = params?.id
  const docId = params?.docId
  if (!id || !docId) return NextResponse.json({ detail: 'id and docId are required' }, { status: 400 })

  const upstreamRes = await upstreamFetch(`/admin/clients/${id}/documents/${docId}`, auth, { method: 'DELETE' })
  const data = await upstreamRes.json().catch(() => ({}))
  if (!upstreamRes.ok) {
    return NextResponse.json({ detail: data?.detail || 'Failed to delete document' }, { status: upstreamRes.status || 500 })
  }

  return NextResponse.json({ ok: true, data })
}
