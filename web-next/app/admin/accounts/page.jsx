'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../../../components/admin/AdminShell'
import styles from '../../../components/admin/admin.module.css'
import { clearAuth, getAuthToken } from '../../../lib/auth'
import { platformLabel as financePlatformLabel } from '../../../lib/finance/model'

function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function defaultCurrencyForPlatform(platform) {
  if (platform === 'yandex') return 'KZT'
  if (platform === 'telegram') return 'EUR'
  return 'USD'
}

function fundingSourceLabel(value) {
  if (value === 'topup') return 'Topup'
  if (value === 'admin_manual') return 'Manual'
  if (value === 'admin_reversal') return 'Reversal'
  return value || '—'
}

function statusChipClass(statusKey) {
  if (statusKey === 'active') return styles.statusChip
  if (statusKey === 'pending') return styles.statusChipWarn
  if (statusKey === 'paused') return styles.statusChipMuted
  if (statusKey === 'closed') return styles.statusChipMuted
  return styles.statusChipMuted
}

export default function AdminAccountsPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('Loading accounts...')
  const [bindStatus, setBindStatus] = useState('')
  const [fundingStatus, setFundingStatus] = useState('')
  const [fundingEvents, setFundingEvents] = useState([])
  const [fundingLoading, setFundingLoading] = useState(false)

  const [form, setForm] = useState({
    id: '',
    user_id: '',
    platform: 'meta',
    name: '',
    external_id: '',
    account_code: '',
    currency: 'USD',
    status: '',
  })
  const [fundingForm, setFundingForm] = useState({
    account_id: '',
    amount: '',
    currency: 'USD',
    occurred_at: '',
    note: '',
  })

  async function adminRouteFetch(path, options = {}) {
    const token = getAuthToken()
    const res = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    })
    if (res.status === 401) {
      clearAuth()
      router.push('/login')
      throw new Error('Unauthorized')
    }
    if (res.status === 403) {
      throw new Error('Admin access denied.')
    }
    return res
  }

  async function fetchAccounts() {
    try {
      const res = await adminRouteFetch('/api/admin/accounts')
      if (!res.ok) throw new Error('Failed to load accounts.')
      const data = await res.json()
      setRows(Array.isArray(data?.items) ? data.items : [])
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Failed to load accounts.')
    }
  }

  async function fetchUsers() {
    try {
      const res = await adminRouteFetch('/api/admin/user-options')
      if (!res.ok) throw new Error('Failed to load clients.')
      const data = await res.json()
      const out = Array.isArray(data?.items) ? data.items : []
      setUsers(out)
      if (!form.user_id && out.length) setForm((s) => ({ ...s, user_id: String(out[0].id) }))
    } catch (e) {
      setBindStatus(e?.message || 'Failed to load clients.')
    }
  }

  async function loadFundingEvents(accountId) {
    if (!accountId) {
      setFundingEvents([])
      return
    }
    setFundingLoading(true)
    setFundingStatus('Loading funding history...')
    try {
      const res = await adminRouteFetch(`/api/admin/accounts/${accountId}/funding-events`)
      if (!res.ok) throw new Error('Failed to load funding history.')
      const data = await res.json()
      setFundingEvents(Array.isArray(data?.items) ? data.items : [])
      setFundingStatus('')
    } catch (e) {
      setFundingEvents([])
      setFundingStatus(e?.message || 'Failed to load funding history.')
    } finally {
      setFundingLoading(false)
    }
  }

  function resetForm() {
    setForm((s) => ({
      ...s,
      id: '',
      platform: 'meta',
      name: '',
      external_id: '',
      account_code: '',
      currency: defaultCurrencyForPlatform('meta'),
      status: '',
    }))
    setBindStatus('')
  }

  function selectFundingAccount(row) {
    const accountId = String(row?.id || '')
    const currency = row?.display_currency || (row?.platform === 'yandex' ? 'KZT' : (row?.currency || defaultCurrencyForPlatform(row?.platform || 'meta')))
    setFundingForm({
      account_id: accountId,
      amount: '',
      currency,
      occurred_at: '',
      note: '',
    })
    setFundingStatus('')
    loadFundingEvents(accountId)
  }

  async function saveBind() {
    if (!form.user_id || !form.name.trim()) {
      setBindStatus('Select a client and enter the account name.')
      return
    }
    const payload = {
      user_id: Number(form.user_id),
      platform: form.platform,
      name: form.name.trim(),
      external_id: form.external_id.trim() || null,
      account_code: form.account_code.trim() || null,
      currency: form.platform === 'yandex' ? 'KZT' : form.currency || defaultCurrencyForPlatform(form.platform),
      status: form.status || null,
    }
    const isEdit = Boolean(form.id)
    try {
      const res = await adminRouteFetch(isEdit ? `/api/admin/accounts/${form.id}` : '/api/admin/accounts', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to save account binding.')
      setBindStatus('Account saved.')
      resetForm()
      await fetchAccounts()
    } catch (e) {
      setBindStatus(e?.message || 'Failed to save account binding.')
    }
  }

  async function saveFundingEvent() {
    if (!fundingForm.account_id || !fundingForm.amount) {
      setFundingStatus('Select an account and enter the amount.')
      return
    }
    try {
      const account = rows.find((row) => String(row.id) === String(fundingForm.account_id))
      const currency = account?.platform === 'yandex'
        ? 'KZT'
        : (fundingForm.currency || account?.display_currency || account?.currency || defaultCurrencyForPlatform(account?.platform || 'meta'))
      const res = await adminRouteFetch(`/api/admin/accounts/${fundingForm.account_id}/funding-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(fundingForm.amount),
          currency,
          occurred_at: fundingForm.occurred_at ? new Date(fundingForm.occurred_at).toISOString() : null,
          note: fundingForm.note || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || 'Failed to save historical funding.')
      }
      setFundingStatus('Historical funding saved.')
      setFundingForm((s) => ({ ...s, amount: '', occurred_at: '', note: '' }))
      await Promise.all([loadFundingEvents(fundingForm.account_id), fetchAccounts()])
    } catch (e) {
      setFundingStatus(e?.message || 'Failed to save historical funding.')
    }
  }

  async function reverseFundingEvent(eventId) {
    if (!fundingForm.account_id || !eventId) return
    const ok = window.confirm('Reverse this historical funding event? A correcting entry will be created.')
    if (!ok) return
    try {
      const res = await adminRouteFetch(`/api/admin/accounts/${fundingForm.account_id}/funding-events/${eventId}/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || 'Failed to reverse historical funding.')
      }
      setFundingStatus('Historical funding reversed with a correcting entry.')
      await Promise.all([loadFundingEvents(fundingForm.account_id), fetchAccounts()])
    } catch (e) {
      setFundingStatus(e?.message || 'Failed to reverse historical funding.')
    }
  }

  async function exportAccounts() {
    try {
      const token = getAuthToken()
      if (!token) return
      const res = await fetch('/api/admin/export/accounts', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Export unavailable')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'accounts.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setStatus(e?.message || 'Export failed.')
    }
  }

  useEffect(() => {
    fetchAccounts()
    fetchUsers()
  }, [])

  return (
    <AdminShell title="Accounts" subtitle="Open ad accounts, bindings and historical funding ledger.">
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.fieldLabel}>Admin</p>
            <h3 className={styles.cardTitle}>Accounts</h3>
          </div>
          <div className={styles.tableActions}>
            <button className={styles.buttonGhost} type="button" onClick={exportAccounts}>Export Excel</button>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th><th>Client</th><th>Platform</th><th>Account</th><th>Status</th><th>Agreement</th><th>External ID</th><th>Live Billing</th><th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr><td colSpan={9}>No data.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{(row.created_at || '').split(' ')[0] || '—'}</td>
                    <td>{row.user_email || '—'}</td>
                    <td>{financePlatformLabel(row.platform)}</td>
                    <td>{row.name}</td>
                    <td><span className={statusChipClass(row.status_key)}>{row.status_label || '—'}</span></td>
                    <td>{row.account_code || '—'}</td>
                    <td>{row.external_id || '—'}</td>
                    <td>{row.live_billing_summary?.label || 'No data'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={styles.buttonGhost}
                        type="button"
                        onClick={() =>
                          setForm({
                            id: String(row.id),
                            user_id: String(row.user_id || ''),
                            platform: row.platform || 'meta',
                            name: row.name || '',
                            external_id: row.external_id || '',
                            account_code: row.account_code || '',
                            currency: row.display_currency || row.currency || defaultCurrencyForPlatform(row.platform || 'meta'),
                            status: row.status || '',
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        className={styles.buttonGhost}
                        type="button"
                        onClick={() => selectFundingAccount(row)}
                        style={{ marginLeft: 8 }}
                      >
                        History
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className={styles.cardHeader}>
          <p className={styles.muted}>{status}</p>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.fieldLabel}>Binding</p>
            <h3 className={styles.cardTitle}>Create or update account</h3>
          </div>
        </div>
        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Client</span>
            <select className={styles.select} value={form.user_id} onChange={(e) => setForm((s) => ({ ...s, user_id: e.target.value }))}>
              <option value="">Select client</option>
              {users.map((u) => <option key={u.id} value={String(u.id)}>{u.email}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Platform</span>
            <select
              className={styles.select}
              value={form.platform}
              onChange={(e) => {
                const nextPlatform = e.target.value
                setForm((s) => ({
                  ...s,
                  platform: nextPlatform,
                  currency: nextPlatform === 'yandex' ? 'KZT' : s.currency || defaultCurrencyForPlatform(nextPlatform),
                }))
              }}
            >
              <option value="meta">Meta</option>
              <option value="google">Google</option>
              <option value="tiktok">TikTok</option>
              <option value="yandex">Yandex</option>
              <option value="telegram">Telegram</option>
              <option value="monochrome">Monochrome</option>
            </select>
          </label>
          <label className={styles.field}><span className={styles.fieldLabel}>Account name</span><input className={styles.input} value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></label>
          <label className={styles.field}><span className={styles.fieldLabel}>External ID</span><input className={styles.input} value={form.external_id} onChange={(e) => setForm((s) => ({ ...s, external_id: e.target.value }))} /></label>
          <label className={styles.field}><span className={styles.fieldLabel}>Agreement / code</span><input className={styles.input} value={form.account_code} onChange={(e) => setForm((s) => ({ ...s, account_code: e.target.value }))} /></label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Currency</span>
            <select
              className={styles.select}
              value={form.platform === 'yandex' ? 'KZT' : form.currency}
              disabled={form.platform === 'yandex'}
              onChange={(e) => setForm((s) => ({ ...s, currency: e.target.value }))}
            >
              {form.platform === 'yandex' ? <option value="KZT">KZT</option> : null}
              {form.platform !== 'yandex' ? <option value="USD">USD</option> : null}
              {form.platform !== 'yandex' ? <option value="EUR">EUR</option> : null}
              <option value="KZT">KZT</option>
            </select>
          </label>
          <label className={styles.field}><span className={styles.fieldLabel}>Status</span><input className={styles.input} value={form.status} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))} placeholder="active / archived / paused" /></label>
        </div>
        <div className={styles.cardHeader}>
          <div className={styles.tableActions}>
            <button className={styles.buttonPrimary} type="button" onClick={saveBind}>Save</button>
            <button className={styles.buttonGhost} type="button" onClick={resetForm}>Reset</button>
          </div>
        </div>
        <div className={styles.cardHeader}>
          <p className={styles.muted}>{bindStatus}</p>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <p className={styles.fieldLabel}>Ledger</p>
            <h3 className={styles.cardTitle}>Historical account funding</h3>
          </div>
        </div>
        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Account</span>
            <select
              className={styles.select}
              value={fundingForm.account_id}
              onChange={(e) => {
                const accountId = e.target.value
                const account = rows.find((row) => String(row.id) === accountId)
                setFundingForm((s) => ({
                  ...s,
                  account_id: accountId,
                  currency: account?.platform === 'yandex'
                    ? 'KZT'
                    : (account?.display_currency || account?.currency || defaultCurrencyForPlatform(account?.platform || 'meta')),
                }))
                setFundingStatus('')
                loadFundingEvents(accountId)
              }}
            >
              <option value="">Select account</option>
              {rows.map((row) => (
                <option key={row.id} value={String(row.id)}>
                  {row.user_email || '—'} · {row.platform} · {row.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Amount</span>
            <input
              className={styles.input}
              type="number"
              min="0"
              step="0.01"
              value={fundingForm.amount}
              onChange={(e) => setFundingForm((s) => ({ ...s, amount: e.target.value }))}
              placeholder="800000"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Currency</span>
            <select
              className={styles.select}
              value={fundingForm.currency}
              disabled={(rows.find((row) => String(row.id) === String(fundingForm.account_id))?.platform || '') === 'yandex'}
              onChange={(e) => setFundingForm((s) => ({ ...s, currency: e.target.value }))}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="KZT">KZT</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Date and time</span>
            <input
              className={styles.input}
              type="datetime-local"
              value={fundingForm.occurred_at}
              onChange={(e) => setFundingForm((s) => ({ ...s, occurred_at: e.target.value }))}
            />
          </label>
          <label className={styles.field} style={{ gridColumn: '1 / -1' }}>
            <span className={styles.fieldLabel}>Note</span>
            <input
              className={styles.input}
              value={fundingForm.note}
              onChange={(e) => setFundingForm((s) => ({ ...s, note: e.target.value }))}
              placeholder="Historical manual funding"
            />
          </label>
        </div>
        <div className={styles.cardHeader}>
          <div className={styles.tableActions}>
            <button className={styles.buttonPrimary} type="button" onClick={saveFundingEvent}>Add to ledger</button>
          </div>
        </div>
        <div className={styles.cardHeader}>
          <p className={styles.muted}>{fundingStatus}</p>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th><th>Source</th><th>Amount</th><th>Currency</th><th>Status</th><th>Note</th><th>Created by</th><th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {!fundingForm.account_id ? (
                <tr><td colSpan={8}>Select an account to view the ledger.</td></tr>
              ) : !fundingEvents.length && !fundingLoading ? (
                <tr><td colSpan={8}>No ledger entries for this account yet.</td></tr>
              ) : (
                fundingEvents.map((row) => (
                  <tr key={row.id}>
                    <td>{String(row.created_at || '').replace('T', ' ').slice(0, 16) || '—'}</td>
                    <td>{fundingSourceLabel(row.source_type)}</td>
                    <td>{formatMoney(row.amount)}</td>
                    <td>{row.currency || '—'}</td>
                    <td>{row.voided_at ? 'Reversed' : 'Active'}</td>
                    <td>{row.note || '—'}</td>
                    <td>{row.created_by || 'system'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {row.source_type === 'admin_manual' && !row.voided_at ? (
                        <button className={styles.buttonGhost} type="button" onClick={() => reverseFundingEvent(row.id)}>
                          Reverse
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  )
}
