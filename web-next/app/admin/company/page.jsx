'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../../../components/admin/AdminShell'
import { adminFetch } from '../../../lib/admin'

const EMPTY = {
  name: '',
  bin: '',
  iin: '',
  legal_address: '',
  factual_address: '',
  bank: '',
  iban: '',
  bic: '',
  kbe: '',
  currency: 'KZT',
}

function issuerLabel(code) {
  return code === 'ip' ? 'IP (Without VAT)' : 'TOO (With VAT)'
}

export default function AdminCompanyPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Loading issuer profiles...')
  const [forms, setForms] = useState({ too: { ...EMPTY }, ip: { ...EMPTY } })
  const [saving, setSaving] = useState('')

  async function safeFetch(path, options = {}) {
    return adminFetch(router, path, options)
  }

  async function loadIssuers() {
    try {
      const res = await safeFetch('/admin/billing-issuers')
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.detail || 'Failed to load issuer profiles.')
      }
      const data = await res.json().catch(() => [])
      const next = { too: { ...EMPTY }, ip: { ...EMPTY } }
      ;(Array.isArray(data) ? data : []).forEach((row) => {
        const key = row?.issuer_type === 'ip' ? 'ip' : 'too'
        next[key] = {
          name: row?.name || '',
          bin: row?.bin || '',
          iin: row?.iin || '',
          legal_address: row?.legal_address || '',
          factual_address: row?.factual_address || '',
          bank: row?.bank || '',
          iban: row?.iban || '',
          bic: row?.bic || '',
          kbe: row?.kbe || '',
          currency: row?.currency || 'KZT',
        }
      })
      setForms(next)
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Failed to load issuer profiles.')
    }
  }

  async function saveIssuer(code) {
    if (saving) return
    setSaving(code)
    setStatus('')
    try {
      const form = forms[code] || EMPTY
      const res = await safeFetch(`/admin/billing-issuers/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || null,
          bin: form.bin.trim() || null,
          iin: form.iin.trim() || null,
          legal_address: form.legal_address.trim() || null,
          factual_address: form.factual_address.trim() || null,
          bank: form.bank.trim() || null,
          iban: form.iban.trim() || null,
          bic: form.bic.trim() || null,
          kbe: form.kbe.trim() || null,
          currency: form.currency.trim() || 'KZT',
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.detail || 'Failed to save issuer profile.')
      }
      setStatus(`${issuerLabel(code)} saved.`)
    } catch (e) {
      setStatus(e?.message || 'Failed to save issuer profile.')
    } finally {
      setSaving('')
    }
  }

  useEffect(() => {
    loadIssuers()
  }, [])

  function setField(code, key, value) {
    setForms((prev) => ({
      ...prev,
      [code]: {
        ...prev[code],
        [key]: value,
      },
    }))
  }

  return (
    <AdminShell title="Company" subtitle="Manage billing issuers for contract-based invoicing (TOO/IP).">
      {['too', 'ip'].map((code) => (
        <section className="panel" key={code} style={{ marginBottom: 16 }}>
          <div className="panel-head">
            <div>
              <p className="eyebrow">Issuer</p>
              <h2>{issuerLabel(code)}</h2>
            </div>
            <span className="chip chip-ghost">{code}</span>
          </div>
          <div className="form-grid">
            <label className="field"><span>Name</span><input value={forms[code].name} onChange={(e) => setField(code, 'name', e.target.value)} /></label>
            <label className="field"><span>BIN</span><input value={forms[code].bin} onChange={(e) => setField(code, 'bin', e.target.value)} /></label>
            <label className="field"><span>IIN</span><input value={forms[code].iin} onChange={(e) => setField(code, 'iin', e.target.value)} /></label>
            <label className="field"><span>Bank</span><input value={forms[code].bank} onChange={(e) => setField(code, 'bank', e.target.value)} /></label>
            <label className="field"><span>IBAN</span><input value={forms[code].iban} onChange={(e) => setField(code, 'iban', e.target.value)} /></label>
            <label className="field"><span>BIC</span><input value={forms[code].bic} onChange={(e) => setField(code, 'bic', e.target.value)} /></label>
            <label className="field"><span>KBE</span><input value={forms[code].kbe} onChange={(e) => setField(code, 'kbe', e.target.value)} /></label>
            <label className="field"><span>Currency</span><input value={forms[code].currency} onChange={(e) => setField(code, 'currency', e.target.value)} /></label>
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Legal Address</span><input value={forms[code].legal_address} onChange={(e) => setField(code, 'legal_address', e.target.value)} /></label>
            <label className="field" style={{ gridColumn: '1 / -1' }}><span>Operational Address</span><input value={forms[code].factual_address} onChange={(e) => setField(code, 'factual_address', e.target.value)} /></label>
          </div>
          <div className="panel-actions" style={{ marginTop: 16 }}>
            <button className="btn primary" type="button" onClick={() => saveIssuer(code)} disabled={saving === code}>
              {saving === code ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </section>
      ))}
      <p className="muted">{status}</p>
    </AdminShell>
  )
}
