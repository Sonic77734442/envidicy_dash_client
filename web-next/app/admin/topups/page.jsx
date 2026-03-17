'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '../../../components/layout/AppShell'
import { apiFetch } from '../../../lib/api'
import { clearAuth, getAuthToken } from '../../../lib/auth'

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || 'https://envidicy-dash-client.onrender.com').replace(/\/$/, '')

function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AdminTopupsPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('Загрузка пополнений...')
  const [filters, setFilters] = useState({ status: '', email: '' })

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

  async function fetchTopups() {
    try {
      const res = await safeFetch('/admin/topups')
      if (!res.ok) throw new Error('Ошибка загрузки пополнений.')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Ошибка загрузки пополнений.')
    }
  }

  async function setTopupStatus(id, nextStatus) {
    try {
      const res = await safeFetch(`/admin/topups/${id}/status?status=${nextStatus}`, { method: 'POST' })
      if (!res.ok) throw new Error('Ошибка обновления статуса.')
      await fetchTopups()
    } catch (e) {
      setStatus(e?.message || 'Ошибка обновления статуса.')
    }
  }

  async function exportTopups() {
    try {
      const token = getAuthToken()
      if (!token) return
      const res = await fetch(`${API_BASE}/admin/export/topups.xlsx`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Экспорт недоступен')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'topups.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setStatus(e?.message || 'Ошибка экспорта.')
    }
  }

  useEffect(() => {
    fetchTopups()
  }, [])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (filters.status && row.status !== filters.status) return false
      if (filters.email && !String(row.user_email || '').toLowerCase().includes(filters.email.toLowerCase())) return false
      return true
    })
  }, [rows, filters])

  return (
    <AppShell area="admin" eyebrow="Envidicy · Admin" title="Пополнения" subtitle="Реестр оплат и статусы.">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Пополнения</p>
            <h2>Сводка по оплатам</h2>
          </div>
          <div className="panel-actions">
            <button className="btn ghost" type="button" onClick={exportTopups}>Экспорт Excel</button>
            <span className="chip chip-ghost">topups</span>
          </div>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Статус</span>
            <select value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}>
              <option value="">Все</option>
              <option value="pending">Ожидает</option>
              <option value="completed">Оплачен</option>
              <option value="failed">Ошибка</option>
            </select>
          </label>
          <label className="field">
            <span>Клиент (email)</span>
            <input value={filters.email} onChange={(e) => setFilters((s) => ({ ...s, email: e.target.value }))} placeholder="client@email.com" />
          </label>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th><th>Клиент</th><th>Платформа</th><th>Аккаунт</th><th>Сумма</th><th>Комиссия</th><th>К оплате</th><th>Статус</th><th style={{ textAlign: 'right' }}>Действие</th>
              </tr>
            </thead>
            <tbody>
              {!filtered.length ? (
                <tr><td colSpan={9}>Нет данных</td></tr>
              ) : (
                filtered.map((row) => {
                  const fee = row.amount_input ? row.amount_input * (Number(row.fee_percent || 0) / 100) : 0
                  const vat = row.amount_input ? row.amount_input * (Number(row.vat_percent || 0) / 100) : 0
                  const gross = Number(row.amount_input || 0) + fee + vat
                  return (
                    <tr key={row.id}>
                      <td>{String(row.created_at || '').split(' ')[0] || '—'}</td>
                      <td>{row.user_email || '—'}</td>
                      <td>{row.account_platform || '—'}</td>
                      <td>{row.account_name || '—'}</td>
                      <td>{formatMoney(row.amount_input)} {row.currency || ''}</td>
                      <td>{formatMoney(fee)} {row.currency || ''}</td>
                      <td>{formatMoney(gross)} {row.currency || ''}</td>
                      <td>{row.status || '—'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn ghost small" type="button" onClick={() => setTopupStatus(row.id, 'completed')}>Оплачен</button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="muted">{status}</p>
      </section>
    </AppShell>
  )
}
