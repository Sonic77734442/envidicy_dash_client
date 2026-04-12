'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../../../components/admin/AdminShell'
import { adminFetch } from '../../../lib/admin'

export default function AdminCompanyPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Loading company profile...')
  const [form, setForm] = useState({
    name: '',
    bin: '',
    iin: '',
    legal_address: '',
    factual_address: '',
  })

  async function safeFetch(path, options = {}) {
    return adminFetch(router, path, options)
  }

  async function loadCompany() {
    try {
      const res = await safeFetch('/admin/company-profile')
      if (!res.ok) throw new Error('Failed to load company profile.')
      const data = await res.json()
      setForm({
        name: data.name || '',
        bin: data.bin || '',
        iin: data.iin || '',
        legal_address: data.legal_address || '',
        factual_address: data.factual_address || '',
      })
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Failed to load company profile.')
    }
  }

  async function saveCompany() {
    try {
      const res = await safeFetch('/admin/company-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || null,
          bin: form.bin.trim() || null,
          iin: form.iin.trim() || null,
          legal_address: form.legal_address.trim() || null,
          factual_address: form.factual_address.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to save company profile.')
      setStatus('Saved.')
    } catch (e) {
      setStatus(e?.message || 'Failed to save company profile.')
    }
  }

  useEffect(() => {
    loadCompany()
  }, [])

  return (
    <AdminShell title="Company" subtitle="Manage the issuer profile used for invoices and billing documents.">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Admin</p>
            <h2>Company billing profile</h2>
          </div>
          <span className="chip chip-ghost">company_profile</span>
        </div>
        <div className="form-grid">
          <label className="field"><span>Company name</span><input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Art Book Inc." /></label>
          <label className="field"><span>BIN</span><input value={form.bin} onChange={(e) => setForm((s) => ({ ...s, bin: e.target.value }))} placeholder="960910300234" /></label>
          <label className="field"><span>IIN</span><input value={form.iin} onChange={(e) => setForm((s) => ({ ...s, iin: e.target.value }))} /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>Legal address</span><input value={form.legal_address} onChange={(e) => setForm((s) => ({ ...s, legal_address: e.target.value }))} /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>Operational address</span><input value={form.factual_address} onChange={(e) => setForm((s) => ({ ...s, factual_address: e.target.value }))} /></label>
        </div>
        <div className="panel-actions" style={{ marginTop: 16 }}>
          <button className="btn primary" type="button" onClick={saveCompany}>Save profile</button>
        </div>
        <p className="muted">{status}</p>
      </section>
    </AdminShell>
  )
}
