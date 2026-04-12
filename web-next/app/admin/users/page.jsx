'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../../../components/admin/AdminShell'
import styles from '../../../components/admin/admin.module.css'
import { adminFetch } from '../../../lib/admin'

function formatDate(value) {
  if (!value) return '—'
  const str = String(value)
  if (str.includes('T')) return str.split('T')[0]
  return str.split(' ')[0]
}

function isRecent(value) {
  if (!value) return false
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return false
  return Date.now() - time <= 1000 * 60 * 60 * 24 * 30
}

function StatCard({ label, value, hint }) {
  return (
    <article className={styles.statCard}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
      <div className={styles.statHint}>{hint}</div>
    </article>
  )
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('Loading users...')
  const [emailFilter, setEmailFilter] = useState('')

  async function safeFetch(path, options = {}) {
    return adminFetch(router, path, options)
  }

  async function fetchUsers() {
    try {
      const res = await safeFetch('/admin/users')
      if (!res.ok) throw new Error('Failed to load users.')
      const data = await res.json()
      setRows(Array.isArray(data) ? data : [])
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Failed to load users.')
    }
  }

  async function makeClient(userId, email) {
    const ok = window.confirm(`Convert ${email || 'this user'} into a client?`)
    if (!ok) return
    try {
      const res = await safeFetch(`/admin/users/${userId}/make-client`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to convert user to client.')
      setStatus('User converted to client.')
      await fetchUsers()
    } catch (e) {
      setStatus(e?.message || 'Failed to convert user to client.')
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filtered = useMemo(() => {
    const query = emailFilter.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) => String(row.email || '').toLowerCase().includes(query))
  }, [rows, emailFilter])

  const stats = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1
        if (isRecent(row.created_at)) acc.recent += 1
        return acc
      },
      { total: 0, recent: 0 }
    )
  }, [rows])

  return (
    <AdminShell title="Users" subtitle="Registered users who have not been converted into clients yet.">
      <section className={styles.statsGrid}>
        <StatCard label="Pending Users" value={stats.total} hint="Registered users not yet converted to clients" />
        <StatCard label="Last 30 Days" value={stats.recent} hint="Recent registrations still waiting for activation" />
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>User Intake</h3>
            <p className={styles.cardSubtle}>Review newly registered users and promote them into clients when ready.</p>
          </div>
        </div>

        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Email Search</span>
            <input className={styles.input} value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} placeholder="client@email.com" />
          </label>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Email</th><th>Registered</th><th>State</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
            <tbody>
              {!filtered.length ? (
                <tr><td colSpan={4}>No users found.</td></tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className={styles.tableStrong}>{row.email || '—'}</span>
                      <span className={styles.tableMeta}>User ID {row.id}</span>
                    </td>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <span className={isRecent(row.created_at) ? styles.statusChip : styles.statusChipMuted}>
                        {isRecent(row.created_at) ? 'Recent Signup' : 'Waiting Conversion'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className={styles.buttonPrimary} type="button" onClick={() => makeClient(row.id, row.email)}>
                        Make Client
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.cardHeader}>
          <p className={styles.muted}>{status || 'Only users without client status are shown here.'}</p>
        </div>
      </section>
    </AdminShell>
  )
}
