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

function formatDate(value) {
  if (!value) return '—'
  const str = String(value)
  if (str.includes('T')) return str.split('T')[0]
  return str.split(' ')[0]
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('Загрузка пользователей...')

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

  async function fetchUsers() {
    try {
      const res = await safeFetch('/admin/users')
      if (!res.ok) throw new Error('Ошибка загрузки пользователей.')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Ошибка загрузки пользователей.')
    }
  }

  async function makeClient(userId, email) {
    const ok = window.confirm(`Перевести ${email || 'пользователя'} в клиента?`)
    if (!ok) return
    try {
      const res = await safeFetch(`/admin/users/${userId}/make-client`, { method: 'POST' })
      if (!res.ok) throw new Error('Ошибка перевода в клиента.')
      setStatus('Пользователь переведён в клиента.')
      await fetchUsers()
    } catch (e) {
      setStatus(e?.message || 'Ошибка перевода в клиента.')
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <AppShell area="admin" eyebrow="Envidicy · Admin" title="Пользователи" subtitle="Все зарегистрированные, кто ещё не стал клиентом.">
      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Пользователи</p>
            <h2>Зарегистрированные (ещё не клиенты)</h2>
          </div>
          <span className="chip chip-ghost">users</span>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead><tr><th>Email</th><th>Дата регистрации</th><th /></tr></thead>
            <tbody>
              {!rows.length ? (
                <tr><td colSpan={3} className="muted">Нет пользователей.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.email || '—'}</td>
                    <td>{formatDate(row.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn primary small" type="button" onClick={() => makeClient(row.id, row.email)}>Сделать клиентом</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="muted">{status}</p>
      </section>
    </AppShell>
  )
}
