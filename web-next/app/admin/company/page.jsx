'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '../../../components/layout/AppShell'
import { apiFetch } from '../../../lib/api'
import { clearAuth, getAuthToken } from '../../../lib/auth'

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AdminCompanyPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Загрузка реквизитов...')
  const [form, setForm] = useState({
    name: '',
    bin: '',
    iin: '',
    legal_address: '',
    factual_address: '',
  })

  async function safeFetch(path, options = {}) {
    const res = await apiFetch(path, { ...options, headers: { ...(options.headers || {}), ...authHeaders() } })
    if (res.status === 401) {
      clearAuth()
      router.push('/login')
      throw new Error('Unauthorized')
    }
    if (res.status === 403) throw new Error('Нет доступа к админке.')
    return res
  }

  async function loadCompany() {
    try {
      const res = await safeFetch('/admin/company-profile')
      if (!res.ok) throw new Error('Ошибка загрузки реквизитов.')
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
      setStatus(e?.message || 'Ошибка загрузки реквизитов.')
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
      if (!res.ok) throw new Error('Ошибка сохранения.')
      setStatus('Сохранено.')
    } catch (e) {
      setStatus(e?.message || 'Ошибка сохранения.')
    }
  }

  useEffect(() => {
    loadCompany()
  }, [])

  return (
    <AppShell area="admin" eyebrow="Envidicy · Admin" title="Компания" subtitle="Настройте реквизиты и адреса для счетов.">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Админка</p>
            <h2>Реквизиты нашей компании</h2>
          </div>
          <span className="chip chip-ghost">company_profile</span>
        </div>
        <div className="form-grid">
          <label className="field"><span>Наименование компании</span><input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="ИП Art Book Inc." /></label>
          <label className="field"><span>БИН</span><input value={form.bin} onChange={(e) => setForm((s) => ({ ...s, bin: e.target.value }))} placeholder="960910300234" /></label>
          <label className="field"><span>ИИН</span><input value={form.iin} onChange={(e) => setForm((s) => ({ ...s, iin: e.target.value }))} /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>Юридический адрес</span><input value={form.legal_address} onChange={(e) => setForm((s) => ({ ...s, legal_address: e.target.value }))} /></label>
          <label className="field" style={{ gridColumn: '1 / -1' }}><span>Фактический адрес</span><input value={form.factual_address} onChange={(e) => setForm((s) => ({ ...s, factual_address: e.target.value }))} /></label>
        </div>
        <div className="panel-actions" style={{ marginTop: 16 }}>
          <button className="btn primary" type="button" onClick={saveCompany}>Сохранить</button>
        </div>
        <p className="muted">{status}</p>
      </section>
    </AppShell>
  )
}
