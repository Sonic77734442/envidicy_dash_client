'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthToken } from '../../../lib/auth'
import AdminShell from '../../../components/admin/AdminShell'
import styles from '../../../components/admin/admin.module.css'
import { adminFetch } from '../../../lib/admin'

const PAGE_SIZE = 12
const ACCOUNT_STATUS_OPTIONS = ['active', 'pending', 'paused', 'archived', 'closed']

function statusLabel(status) {
  if (status === 'approved') return 'Opened'
  if (status === 'processing') return 'In Progress'
  if (status === 'rejected') return 'Rejected'
  return 'New'
}

function platformLabel(platform) {
  const value = String(platform || '').toLowerCase()
  if (value === 'meta') return 'Meta'
  if (value === 'google') return 'Google Ads'
  if (value === 'tiktok') return 'TikTok Ads'
  if (value === 'yandex') return 'Yandex Direct'
  if (value === 'telegram') return 'Telegram Ads'
  if (value === 'monochrome') return 'Monochrome'
  return platform || '—'
}

function statusClass(status) {
  if (status === 'approved') return styles.statusChip
  if (status === 'processing') return styles.statusChipMuted
  if (status === 'rejected') return styles.statusChipWarn
  return styles.statusChipMuted
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(value) {
  if (!value) return '—'
  const raw = String(value).replace('T', ' ')
  const [datePart, timePart] = raw.split(' ')
  if (!datePart) return '—'
  return `${datePart}${timePart ? ` ${timePart.slice(0, 5)}` : ''}`
}

function clientKey(row) {
  const userId = row?.user_id != null ? String(row.user_id) : ''
  const email = String(row?.user_email || '').toLowerCase()
  if (userId) return `u:${userId}`
  if (email) return `e:${email}`
  return `r:${row?.id ?? 'unknown'}`
}

function normalizePayload(payload) {
  if (!payload) return {}
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch {
      return {}
    }
  }
  return typeof payload === 'object' ? payload : {}
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

export default function AdminRequestsPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [accountRows, setAccountRows] = useState([])
  const [status, setStatus] = useState('Loading requests…')
  const [accountsStatus, setAccountsStatus] = useState('')
  const [workbenchMode, setWorkbenchMode] = useState('accounts')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState('')
  const [selectedClientKey, setSelectedClientKey] = useState('')
  const [selectedAccountItemKey, setSelectedAccountItemKey] = useState('')
  const [form, setForm] = useState({
    contract_code: '',
    account_code: '',
    budget_total: '',
    manager_email: '',
    comment: '',
  })
  const [accountCardOpen, setAccountCardOpen] = useState(false)
  const [requestCardOpen, setRequestCardOpen] = useState(false)
  const [accountForm, setAccountForm] = useState({
    id: '',
    user_id: '',
    platform: 'meta',
    name: '',
    external_id: '',
    account_code: '',
    currency: 'USD',
    status: 'active',
    visible_to_client: true,
  })

  async function safeFetch(path, options = {}) {
    return adminFetch(router, path, options)
  }

  async function fetchRequests() {
    try {
      const res = await safeFetch('/admin/account-requests')
      if (!res.ok) throw new Error('Failed to load requests.')
      const data = await res.json()
      const items = Array.isArray(data) ? data : []
      setRows(items)
      setStatus('')
      if (!selectedId && items.length) setSelectedId(String(items[0].id))
    } catch (error) {
      setStatus(error?.message || 'Failed to load requests.')
    }
  }

  async function fetchAccounts() {
    try {
      const token = getAuthToken()
      if (!token) return
      const res = await fetch('/api/admin/accounts', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to load accounts.')
      setAccountRows(Array.isArray(data?.items) ? data.items : [])
      setAccountsStatus('')
    } catch (error) {
      setAccountsStatus(error?.message || 'Failed to load accounts.')
    }
  }

  async function submitSideAction(action, row) {
    if (!row) return
    const budgetRaw = String(form.budget_total || '').trim()
    const budgetTotal = budgetRaw === '' ? null : Number(budgetRaw)
    if (budgetRaw !== '' && Number.isNaN(budgetTotal)) {
      setStatus('Enter a valid budget.')
      return
    }

    try {
      if (action === 'comment') {
        if (!form.comment.trim() && !form.manager_email.trim()) {
          setStatus('Add a comment or manager email.')
          return
        }
        const commentRes = await safeFetch(`/admin/account-requests/${row.id}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'comment',
            comment: form.comment.trim() || null,
            manager_email: form.manager_email.trim() || null,
          }),
        })
        if (!commentRes.ok) throw new Error('Failed to add comment.')
        setForm((prev) => ({ ...prev, comment: '' }))
        return
      }

      const nextStatus = action === 'save' ? row.status || 'processing' : action
      const res = await safeFetch(`/admin/account-requests/${row.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          contract_code: form.contract_code.trim() || null,
          account_code: form.account_code.trim() || null,
          manager_email: form.manager_email.trim() || null,
          comment: form.comment.trim() || null,
          budget_total: budgetTotal,
        }),
      })
      if (!res.ok) throw new Error('Failed to update request.')
      await fetchRequests()
    } catch (error) {
      setStatus(error?.message || 'Failed to update request.')
    }
  }

  async function exportRequests() {
    try {
      const token = getAuthToken()
      if (!token) return
      const res = await fetch('/api/admin/export/requests', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Export unavailable')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'requests.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setStatus(error?.message || 'Export failed.')
    }
  }

  async function saveAccountCard() {
    if (!accountForm.user_id || !accountForm.name.trim()) {
      setAccountsStatus('Select client and account name.')
      return
    }
    try {
      const token = getAuthToken()
      if (!token) throw new Error('Unauthorized')
      const payload = {
        user_id: Number(accountForm.user_id),
        platform: accountForm.platform,
        name: accountForm.name.trim(),
        external_id: accountForm.external_id.trim() || null,
        account_code: accountForm.account_code.trim() || null,
        currency: accountForm.currency || 'USD',
        status: accountForm.status || 'active',
        visible_to_client: !!accountForm.visible_to_client,
      }
      const isEdit = Boolean(accountForm.id)
      const path = isEdit ? `/api/admin/accounts/${accountForm.id}` : '/api/admin/accounts'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to save account.')
      setAccountsStatus('Account saved.')
      await fetchAccounts()
    } catch (error) {
      setAccountsStatus(error?.message || 'Failed to save account.')
    }
  }

  async function deleteAccountCard() {
    const accountId = String(accountForm.id || selectedAccount?.id || '').trim()
    if (!accountId) {
      setAccountsStatus('Account id is missing.')
      return
    }
    if (!window.confirm('Delete this account? It will be removed from client portal lists.')) return

    try {
      const token = getAuthToken()
      if (!token) throw new Error('Unauthorized')
      const res = await fetch(`/api/admin/accounts/${encodeURIComponent(accountId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Failed to delete account.')
      setAccountsStatus('Account deleted.')
      setAccountCardOpen(false)
      await fetchAccounts()
      setSelectedAccountItemKey('')
    } catch (error) {
      setAccountsStatus(error?.message || 'Failed to delete account.')
    }
  }

  useEffect(() => {
    fetchRequests()
    fetchAccounts()
  }, [])

  const stats = useMemo(() => {
    const total = rows.length
    const fresh = rows.filter((row) => row.status === 'new').length
    const processing = rows.filter((row) => row.status === 'processing').length
    const approved = rows.filter((row) => row.status === 'approved').length
    const rejected = rows.filter((row) => row.status === 'rejected').length
    const needsFundingReview = rows.filter((row) => {
      const budget = Number(row.budget_total || 0)
      const funded = Number(row.topup_completed_total || 0)
      return budget > 0 && funded < budget
    }).length
    return { total, fresh, processing, approved, rejected, needsFundingReview }
  }, [rows])

  const groupedClients = useMemo(() => {
    const map = new Map()
    rows.forEach((row) => {
      const key = clientKey(row)
      const current = map.get(key) || {
        key,
        email: row.user_email || '—',
        userId: row.user_id ?? null,
        managerEmail: row.manager_email || '',
        requests: [],
        latestAt: '',
      }
      current.requests.push(row)
      if (!current.latestAt || String(row.created_at || '') > current.latestAt) current.latestAt = String(row.created_at || '')
      if (!current.managerEmail && row.manager_email) current.managerEmail = row.manager_email
      map.set(key, current)
    })
    return Array.from(map.values())
      .map((group) => ({
        ...group,
        requests: group.requests.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
      }))
      .sort((a, b) => String(b.latestAt || '').localeCompare(String(a.latestAt || '')))
  }, [rows])

  const totalPages = Math.max(1, Math.ceil(groupedClients.length / PAGE_SIZE))
  const pageClients = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return groupedClients.slice(start, start + PAGE_SIZE)
  }, [groupedClients, page])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const selectedRow = useMemo(() => {
    if (!rows.length) return null
    return rows.find((row) => String(row.id) === String(selectedId)) || rows[0]
  }, [rows, selectedId])

  useEffect(() => {
    if (!groupedClients.length) {
      setSelectedClientKey('')
      return
    }
    if (!selectedClientKey || !groupedClients.some((group) => group.key === selectedClientKey)) {
      setSelectedClientKey(groupedClients[0].key)
    }
  }, [groupedClients, selectedClientKey])

  const selectedClientGroup = useMemo(() => {
    if (!groupedClients.length) return null
    return groupedClients.find((group) => group.key === selectedClientKey) || groupedClients[0]
  }, [groupedClients, selectedClientKey])

  const selectedClientAccounts = useMemo(() => {
    if (!selectedClientGroup) return []
    const byUserId = selectedClientGroup.userId != null
      ? accountRows.filter((acc) => String(acc.user_id) === String(selectedClientGroup.userId))
      : []
    if (byUserId.length) return byUserId
    const emailNeedle = String(selectedClientGroup.email || '').toLowerCase()
    return accountRows.filter((acc) => String(acc.user_email || '').toLowerCase() === emailNeedle)
  }, [accountRows, selectedClientGroup])

  const accountWorkbenchItems = useMemo(() => {
    const accountItems = selectedClientAccounts.map((acc) => ({
      kind: 'account',
      key: `acc:${acc.id}`,
      account: acc,
      request: null,
    }))
    const requestItems = (selectedClientGroup?.requests || [])
      .filter((row) => row.status === 'new' || row.status === 'processing')
      .map((row) => ({
        kind: 'request',
        key: `req:${row.id}`,
        account: null,
        request: row,
      }))
    return [...accountItems, ...requestItems].sort((a, b) => {
      const aAt = a.kind === 'account' ? String(a.account?.created_at || '') : String(a.request?.created_at || '')
      const bAt = b.kind === 'account' ? String(b.account?.created_at || '') : String(b.request?.created_at || '')
      return bAt.localeCompare(aAt)
    })
  }, [selectedClientAccounts, selectedClientGroup?.requests])

  const selectedAccountItem = useMemo(() => {
    if (!accountWorkbenchItems.length) return null
    return accountWorkbenchItems.find((item) => item.key === selectedAccountItemKey) || accountWorkbenchItems[0]
  }, [accountWorkbenchItems, selectedAccountItemKey])

  const selectedAccount = selectedAccountItem?.kind === 'account' ? selectedAccountItem.account : null
  const selectedAccountRequest = selectedAccountItem?.kind === 'request' ? selectedAccountItem.request : null

  useEffect(() => {
    if (!accountWorkbenchItems.length) {
      setSelectedAccountItemKey('')
      setAccountForm({
        id: '',
        user_id: selectedClientGroup?.userId != null ? String(selectedClientGroup.userId) : '',
        platform: 'meta',
        name: '',
        external_id: '',
        account_code: '',
        currency: 'USD',
        status: 'active',
        visible_to_client: true,
      })
      return
    }
    if (!selectedAccountItemKey || !accountWorkbenchItems.some((item) => item.key === selectedAccountItemKey)) {
      setSelectedAccountItemKey(accountWorkbenchItems[0].key)
    }
  }, [accountWorkbenchItems, selectedClientGroup?.userId, selectedAccountItemKey])

  useEffect(() => {
    if (workbenchMode !== 'accounts') return
    if (!selectedAccountItemKey && accountWorkbenchItems.length) {
      setSelectedAccountItemKey(accountWorkbenchItems[0].key)
    }
  }, [workbenchMode, selectedAccountItemKey, accountWorkbenchItems])

  useEffect(() => {
    if (!selectedRow) return
    setSelectedClientKey((prev) => prev || clientKey(selectedRow))
    setSelectedAccountItemKey((prev) => prev || `req:${selectedRow.id}`)
  }, [selectedRow?.id])

  useEffect(() => {
    if (!selectedRow) return
    setForm({
      contract_code: selectedRow.contract_code || '',
      account_code: selectedRow.account_code || selectedRow.account_code_db || '',
      budget_total: selectedRow.budget_total ?? '',
      manager_email: selectedRow.manager_email || '',
      comment: selectedRow.comment || '',
    })
  }, [selectedRow?.id])

  useEffect(() => {
    if (!selectedAccount) return
    setAccountForm({
      id: String(selectedAccount.id || ''),
      user_id: String(selectedAccount.user_id || ''),
      platform: selectedAccount.platform || 'meta',
      name: selectedAccount.name || '',
      external_id: selectedAccount.external_id || '',
      account_code: selectedAccount.account_code || '',
      currency: selectedAccount.display_currency || selectedAccount.currency || 'USD',
      status: selectedAccount.status || 'active',
      visible_to_client: selectedAccount.visible_to_client !== false,
    })
  }, [selectedAccount?.id])

  return (
    <AdminShell title="Account Requests" subtitle="Compact queue with review panel and controlled lifecycle actions." actionLabel="Export Excel" actionOnClick={exportRequests}>
      <section className={styles.statsGrid}>
        <StatCard label="Total" value={stats.total} hint="All account requests" />
        <StatCard label="New" value={stats.fresh} hint="Need first action" />
        <StatCard label="In Progress" value={stats.processing} hint="Review in process" />
        <StatCard label="Funding Review" value={stats.needsFundingReview} hint="Budget exceeds completed topups" />
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.modeSwitch}>
            <button className={workbenchMode === 'requests' ? styles.modeSwitchActive : styles.modeSwitchButton} type="button" onClick={() => setWorkbenchMode('requests')}>Requests</button>
            <button className={workbenchMode === 'accounts' ? styles.modeSwitchActive : styles.modeSwitchButton} type="button" onClick={() => setWorkbenchMode('accounts')}>Accounts</button>
          </div>
          <div className={styles.tableActions} style={{ justifyContent: 'flex-start' }}>
            <span className={styles.statusChipMuted}>Client Queue</span>
            <span className={styles.statusChipMuted}>Accounts</span>
            <span className={styles.statusChipMuted}>New Requests</span>
          </div>
        </div>

        <div className={styles.walletWorkbench}>
          {workbenchMode === 'requests' ? (
            <div className={styles.tableWrap} style={{ border: '1px solid #ece5d9', borderRadius: 18, background: '#fff' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Queue</th>
                    <th>Accounts Requested</th>
                    <th>Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {!pageClients.length ? (
                    <tr><td colSpan={4}>No requests found.</td></tr>
                  ) : (
                    pageClients.map((group) => {
                      const statuses = group.requests.reduce(
                        (acc, row) => {
                          if (row.status === 'new') acc.newCount += 1
                          else if (row.status === 'processing') acc.processingCount += 1
                          else if (row.status === 'approved') acc.approvedCount += 1
                          else if (row.status === 'rejected') acc.rejectedCount += 1
                          return acc
                        },
                        { newCount: 0, processingCount: 0, approvedCount: 0, rejectedCount: 0 }
                      )
                      const accountPreview = group.requests
                        .slice(0, 3)
                        .map((row) => `${platformLabel(row.platform)}: ${row.name || '—'}`)
                        .join(' · ')
                      return (
                        <tr
                          key={group.key}
                          onClick={() => {
                            setSelectedClientKey(group.key)
                            setSelectedAccountItemKey('')
                          }}
                          style={selectedClientKey === group.key ? { background: '#f8f3eb', cursor: 'pointer' } : { background: '#fcfaf6', cursor: 'pointer' }}
                        >
                          <td>
                            <span className={styles.tableStrong}>{group.email}</span>
                            <span className={styles.tableMeta}>{group.managerEmail || 'Manager not assigned'}</span>
                          </td>
                          <td>
                            <div className={styles.tableActions} style={{ justifyContent: 'flex-start' }}>
                              {statuses.newCount ? <span className={styles.statusChipMuted}>{`${statuses.newCount} New`}</span> : null}
                              {statuses.processingCount ? <span className={styles.statusChipMuted}>{`${statuses.processingCount} In Progress`}</span> : null}
                              {statuses.approvedCount ? <span className={styles.statusChip}>{`${statuses.approvedCount} Opened`}</span> : null}
                              {statuses.rejectedCount ? <span className={styles.statusChipWarn}>{`${statuses.rejectedCount} Rejected`}</span> : null}
                            </div>
                          </td>
                          <td>
                            <span className={styles.tableStrong}>{group.requests.length} requests</span>
                            <span className={styles.tableMeta}>{accountPreview}{group.requests.length > 3 ? ' …' : ''}</span>
                          </td>
                          <td><span className={styles.tableMeta}>{formatDateTime(group.latestAt)}</span></td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
              <div className={styles.cardHeader}>
                <p className={styles.muted}>
                  Showing {(page - 1) * PAGE_SIZE + (pageClients.length ? 1 : 0)}-{(page - 1) * PAGE_SIZE + pageClients.length} of {groupedClients.length} clients
                </p>
                <div className={styles.tableActions}>
                  <button className={styles.buttonGhost} type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
                  <button className={styles.buttonGhost} type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.tableWrap} style={{ border: '1px solid #ece5d9', borderRadius: 18, background: '#fff' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Platform</th>
                    <th>Account</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedClientGroup ? (
                    <tr><td colSpan={4}>Select client in Requests tab.</td></tr>
                  ) : !accountWorkbenchItems.length ? (
                    <tr><td colSpan={4}>No accounts or active requests.</td></tr>
                  ) : (
                    accountWorkbenchItems.map((item) => (
                      <tr
                        key={item.key}
                        onClick={() => {
                          setSelectedAccountItemKey(item.key)
                          if (item.kind === 'request') setSelectedId(String(item.request.id))
                        }}
                        style={item.key === selectedAccountItem?.key ? { background: '#faf7f2', boxShadow: 'inset 3px 0 0 #2457ff', cursor: 'pointer' } : { cursor: 'pointer' }}
                      >
                        <td>
                          <span className={styles.tableStrong}>{item.kind === 'request' ? `Request #${item.request.id}` : `Account #${item.account.id}`}</span>
                          <span className={styles.tableMeta}>{formatDateTime(item.kind === 'request' ? item.request.created_at : item.account.created_at)}</span>
                        </td>
                        <td><span className={styles.platformBadge}>{platformLabel(item.kind === 'request' ? item.request.platform : item.account.platform)}</span></td>
                        <td>{item.kind === 'request' ? (item.request.name || '—') : (item.account.name || '—')}</td>
                        <td>
                          {item.kind === 'request'
                            ? <span className={statusClass(item.request.status)}>{statusLabel(item.request.status)}</span>
                            : <span className={statusClass(item.account.status_key || item.account.status)}>{item.account.status_label || item.account.status || 'Active'}</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className={styles.cardHeader}>
                <p className={styles.muted}>{selectedClientGroup ? `Client: ${selectedClientGroup.email}` : 'No client selected.'}</p>
              </div>
            </div>
          )}

          <aside className={styles.sidePanel}>
            {!selectedClientGroup ? (
              <div className={styles.payloadCard}>
                <p className={styles.muted}>Select a client and account/request item.</p>
              </div>
            ) : selectedAccountItem?.kind === 'request' && selectedAccountRequest ? (
              <>
                <div className={styles.sideSnapshot}>
                  <div>
                    <span className={styles.sideSnapshotLabel}>New Request</span>
                    <strong className={styles.sideSnapshotValue}>#{selectedAccountRequest.id}</strong>
                  </div>
                  <span className={statusClass(selectedAccountRequest.status)}>{platformLabel(selectedAccountRequest.platform)}</span>
                </div>

                <div className={styles.formStack}>
                  {workbenchMode === 'accounts' ? (
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Account ID</span>
                      <input className={styles.input} value={form.account_code} onChange={(e) => setForm((s) => ({ ...s, account_code: e.target.value }))} />
                    </label>
                  ) : (
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>Contract Code</span>
                      <input className={styles.input} value={form.contract_code} onChange={(e) => setForm((s) => ({ ...s, contract_code: e.target.value }))} />
                    </label>
                  )}
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Manager Email</span>
                    <input className={styles.input} value={form.manager_email} onChange={(e) => setForm((s) => ({ ...s, manager_email: e.target.value }))} />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Comment</span>
                    <textarea className={styles.textarea} value={form.comment} onChange={(e) => setForm((s) => ({ ...s, comment: e.target.value }))} />
                  </label>
                </div>

                <div className={styles.buttonRow}>
                  <button className={styles.buttonGhost} type="button" onClick={() => submitSideAction('save', selectedAccountRequest)}>Save</button>
                  <button className={styles.buttonGhost} type="button" onClick={() => submitSideAction('processing', selectedAccountRequest)}>Move to In Progress</button>
                  <button className={styles.buttonPrimary} type="button" onClick={() => submitSideAction('approved', selectedAccountRequest)}>Approve</button>
                  <button className={styles.buttonGhost} type="button" onClick={() => submitSideAction('rejected', selectedAccountRequest)}>Reject</button>
                  <button className={styles.buttonGhost} type="button" onClick={() => setRequestCardOpen(true)}>Open Full Request Card</button>
                </div>
              </>
            ) : selectedAccountItem?.kind === 'account' && selectedAccount ? (
              <>
                <div className={styles.sideSnapshot}>
                  <div>
                    <span className={styles.sideSnapshotLabel}>Account Card</span>
                    <strong className={styles.sideSnapshotValue}>{selectedAccount.name || 'Account'}</strong>
                  </div>
                  <span className={statusClass(selectedAccount.status_key || selectedAccount.status)}>{selectedAccount.status_label || 'Active'}</span>
                </div>

                <div className={styles.payloadCard}>
                  <p className={styles.detailSectionTitle}>Account Summary</p>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Platform</span>
                    <span className={styles.detailValue}>{platformLabel(selectedAccount.platform)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Account ID</span>
                    <span className={styles.detailValue}>{selectedAccount.account_code || '—'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>External ID</span>
                    <span className={styles.detailValue}>{selectedAccount.external_id || '—'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Client Visibility</span>
                    <span className={styles.detailValue}>{selectedAccount.visible_to_client ? 'Visible' : 'Hidden'}</span>
                  </div>
                </div>

                <div className={styles.buttonRow}>
                  <button className={styles.buttonPrimary} type="button" onClick={() => setAccountCardOpen(true)}>Open Full Account Card</button>
                </div>
              </>
            ) : (
              <div className={styles.payloadCard}>
                <p className={styles.muted}>Select an account or request row.</p>
              </div>
            )}
          </aside>
        </div>

        <div className={styles.cardHeader}>
          <p className={styles.muted}>{accountsStatus || status || 'Accounts and requests are managed in one flow.'}</p>
        </div>
      </section>

      {accountCardOpen && selectedAccount ? (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setAccountCardOpen(false) }}>
          <article className={styles.modal} style={{ width: 'min(980px, 100%)' }}>
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.topbarEyebrow}>Account Card</p>
                <h3 className={styles.modalTitle}>{accountForm.name || selectedAccount.name || 'Account'}</h3>
                <p className={styles.modalSubtitle}>{selectedClientGroup?.email || selectedAccount.user_email || ''}</p>
              </div>
              <button className={styles.buttonGhost} type="button" onClick={() => setAccountCardOpen(false)}>Close</button>
            </header>
            <div style={{ padding: '14px 24px 24px', display: 'grid', gap: 12 }}>
              <div className={styles.formStack}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Platform</span>
                  <select className={styles.select} value={accountForm.platform} onChange={(e) => setAccountForm((s) => ({ ...s, platform: e.target.value }))}>
                    <option value="meta">Meta</option>
                    <option value="google">Google</option>
                    <option value="tiktok">TikTok</option>
                    <option value="yandex">Yandex</option>
                    <option value="telegram">Telegram</option>
                    <option value="monochrome">Monochrome</option>
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Account Name</span>
                  <input className={styles.input} value={accountForm.name} onChange={(e) => setAccountForm((s) => ({ ...s, name: e.target.value }))} />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Account ID</span>
                  <input className={styles.input} value={accountForm.account_code} onChange={(e) => setAccountForm((s) => ({ ...s, account_code: e.target.value }))} />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>External ID</span>
                  <input className={styles.input} value={accountForm.external_id} onChange={(e) => setAccountForm((s) => ({ ...s, external_id: e.target.value }))} />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Currency</span>
                  <input className={styles.input} value={accountForm.currency} onChange={(e) => setAccountForm((s) => ({ ...s, currency: e.target.value.toUpperCase() }))} />
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Status</span>
                  <select className={styles.select} value={accountForm.status} onChange={(e) => setAccountForm((s) => ({ ...s, status: e.target.value }))}>
                    {ACCOUNT_STATUS_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field} style={{ alignItems: 'start' }}>
                  <span className={styles.fieldLabel}>Visible In Client Portal</span>
                  <input
                    type="checkbox"
                    checked={!!accountForm.visible_to_client}
                    onChange={(e) => setAccountForm((s) => ({ ...s, visible_to_client: e.target.checked }))}
                    style={{ width: 18, height: 18, marginTop: 6 }}
                  />
                </label>
              </div>
              <div className={styles.buttonRow}>
                <button className={styles.buttonPrimary} type="button" onClick={saveAccountCard}>Save Account</button>
                <button className={styles.buttonGhost} type="button" onClick={deleteAccountCard}>Delete Account</button>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {requestCardOpen && selectedAccountRequest ? (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setRequestCardOpen(false) }}>
          <article className={styles.modal} style={{ width: 'min(980px, 100%)' }}>
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.topbarEyebrow}>Request Card</p>
                <h3 className={styles.modalTitle}>#{selectedAccountRequest.id} · {platformLabel(selectedAccountRequest.platform)}</h3>
                <p className={styles.modalSubtitle}>{selectedClientGroup?.email || selectedAccountRequest.user_email || ''}</p>
              </div>
              <button className={styles.buttonGhost} type="button" onClick={() => setRequestCardOpen(false)}>Close</button>
            </header>
            <div style={{ padding: '14px 24px 24px', display: 'grid', gap: 12 }}>
              <div className={styles.payloadCard}>
                <p className={styles.detailSectionTitle}>Opening Data</p>
                {Object.entries(normalizePayload(selectedAccountRequest.payload)).length ? (
                  Object.entries(normalizePayload(selectedAccountRequest.payload)).map(([key, value]) => (
                    <div className={styles.detailRow} key={key}>
                      <span className={styles.detailLabel}>{key.replace(/_/g, ' ')}</span>
                      <span className={styles.detailValue}>{Array.isArray(value) ? JSON.stringify(value) : String(value ?? '—')}</span>
                    </div>
                  ))
                ) : (
                  <p className={styles.muted}>No additional opening fields.</p>
                )}
              </div>
            </div>
          </article>
        </div>
      ) : null}

    </AdminShell>
  )
}
