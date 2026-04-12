'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../../../components/admin/AdminShell'
import styles from '../../../components/admin/admin.module.css'
import { clearAuth, getAuthToken } from '../../../lib/auth'

function formatMoney(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatFxRate(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return 'Not applied'
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function statusLabel(value) {
  if (value === 'completed') return 'Completed'
  if (value === 'failed') return 'Failed'
  if (value === 'pending') return 'Pending'
  return value || '—'
}

function statusClass(value) {
  if (value === 'completed') return styles.statusChip
  if (value === 'failed') return styles.statusChipWarn
  return styles.statusChipMuted
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

function formatDate(value) {
  if (!value) return '—'
  const raw = String(value).replace('T', ' ')
  return raw.split(' ')[0] || '—'
}

function formatTime(value) {
  if (!value) return '—'
  const raw = String(value).replace('T', ' ')
  const parts = raw.split(' ')
  return parts[1]?.slice(0, 5) || '—'
}

function topupRiskFlags(row) {
  const out = []
  const breakdown = row?.breakdown || {}
  const feeVat = Number(breakdown.acquiringFee || 0) + Number(breakdown.vat || 0)
  if (Number(feeVat) > Number(breakdown.clientFunding || 0)) {
    out.push({ level: 'high', label: 'Fee mismatch', note: 'Fee + VAT exceeds client funding amount.' })
  }
  if (!Number.isFinite(Number(breakdown.fxRate)) || Number(breakdown.fxRate) <= 0) {
    out.push({ level: 'low', label: 'FX not provided', note: 'Request does not include a valid FX rate.' })
  }
  if (row?.status === 'failed') {
    out.push({ level: 'high', label: 'Failed transaction', note: 'Requires manual reconciliation before retry.' })
  }
  return out
}

export default function AdminTopupsPage() {
  const router = useRouter()
  const [rows, setRows] = useState([])
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, failed: 0, completedGross: 0 })
  const [status, setStatus] = useState('Loading topups...')
  const [filters, setFilters] = useState({
    status: '',
    email: '',
    platform: '',
    amountMin: '',
    dateFrom: '',
    dateTo: '',
  })
  const [activeView, setActiveView] = useState('all')
  const [selectedId, setSelectedId] = useState('')
  const [exporting, setExporting] = useState(false)

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

  async function fetchTopups() {
    try {
      const res = await adminRouteFetch('/api/admin/topups')
      if (!res.ok) throw new Error('Failed to load topups.')
      const data = await res.json()
      const nextRows = Array.isArray(data?.items) ? data.items : []
      setRows(nextRows)
      setStats(data?.stats || { total: 0, pending: 0, completed: 0, failed: 0, completedGross: 0 })
      if (!selectedId && nextRows.length) {
        setSelectedId(String(nextRows[0].id))
      }
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Failed to load topups.')
    }
  }

  async function setTopupStatus(id, nextStatus) {
    try {
      const res = await adminRouteFetch(`/api/admin/topups/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error('Failed to update topup status.')
      await fetchTopups()
    } catch (e) {
      setStatus(e?.message || 'Failed to update topup status.')
    }
  }

  async function exportTopups() {
    if (exporting) return
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (activeView && activeView !== 'all') params.set('view', activeView)
      if (filters.status) params.set('status', filters.status)
      if (filters.email) params.set('email', filters.email)
      if (filters.platform) params.set('platform', filters.platform)
      if (filters.amountMin) params.set('amountMin', filters.amountMin)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      const query = params.toString() ? `?${params.toString()}` : ''
      const res = await adminRouteFetch(`/api/admin/export/topups${query}`)
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.detail || 'Export unavailable')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      a.download = match?.[1] || `topups-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setStatus('Topups export downloaded.')
    } catch (e) {
      setStatus(e?.message || 'Export failed.')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    fetchTopups()
  }, [])

  const viewFiltered = useMemo(() => {
    return rows.filter((row) => {
      if (activeView === 'pending' && row.status !== 'pending') return false
      if (activeView === 'high') return Number(row?.total_wallet_debit || 0) >= 100000
      if (activeView === 'manual') return topupRiskFlags(row).length > 0
      return true
    })
  }, [rows, activeView])

  const filtered = useMemo(() => {
    return viewFiltered.filter((row) => {
      const created = String(row.created_at || '').split(' ')[0]
      if (filters.status && row.status !== filters.status) return false
      if (filters.email && !String(row.user_email || '').toLowerCase().includes(filters.email.toLowerCase())) return false
      if (filters.platform && String(row.account_platform || '').toLowerCase() !== filters.platform.toLowerCase()) return false
      if (filters.amountMin && Number(row.total_wallet_debit || 0) < Number(filters.amountMin || 0)) return false
      if (filters.dateFrom && created < filters.dateFrom) return false
      if (filters.dateTo && created > filters.dateTo) return false
      return true
    })
  }, [viewFiltered, filters])

  const selected = useMemo(() => {
    if (!filtered.length) return null
    return filtered.find((row) => String(row.id) === String(selectedId)) || filtered[0]
  }, [filtered, selectedId])

  useEffect(() => {
    if (!filtered.length) return
    if (!selectedId || !filtered.some((row) => String(row.id) === String(selectedId))) {
      setSelectedId(String(filtered[0].id))
    }
  }, [filtered, selectedId])

  const selectedBreakdown = selected?.breakdown || {}
  const selectedRisk = selected ? topupRiskFlags(selected) : []

  return (
    <AdminShell title="Topups" subtitle="Payment registry, workflow statuses and manual financial review.">
      <section className={styles.statsGrid}>
        <StatCard label="Total Topups" value={stats.total} hint="All payment intents from clients" />
        <StatCard label="Pending" value={stats.pending} hint="Require payment confirmation or review" />
        <StatCard label="Completed" value={stats.completed} hint="Already credited to the workflow" />
        <StatCard label="Completed Gross" value={`${formatMoney(stats.completedGross)} KZT`} hint="Input amount with fee and VAT" />
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>Topup Queue</h3>
            <p className={styles.cardSubtle}>Filter payment requests by workflow status or client email.</p>
          </div>
          <div className={styles.tableActions}>
            <button className={styles.buttonGhost} type="button" onClick={exportTopups} disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
          </div>
        </div>

        <div className={styles.cardHeader} style={{ borderBottom: 0, paddingTop: 8 }}>
          <div className={styles.tableActions} style={{ justifyContent: 'flex-start' }}>
            <button className={styles.buttonGhost} type="button" onClick={() => setActiveView('all')} aria-pressed={activeView === 'all'}>All Transactions</button>
            <button className={styles.buttonGhost} type="button" onClick={() => setActiveView('pending')} aria-pressed={activeView === 'pending'}>Pending Review</button>
            <button className={styles.buttonGhost} type="button" onClick={() => setActiveView('high')} aria-pressed={activeView === 'high'}>High Amount</button>
            <button className={styles.buttonGhost} type="button" onClick={() => setActiveView('manual')} aria-pressed={activeView === 'manual'}>Manual Review</button>
          </div>
        </div>

        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <select className={styles.select} value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}>
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Client Email</span>
            <input className={styles.input} value={filters.email} onChange={(e) => setFilters((s) => ({ ...s, email: e.target.value }))} placeholder="client@email.com" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Platform</span>
            <select className={styles.select} value={filters.platform} onChange={(e) => setFilters((s) => ({ ...s, platform: e.target.value }))}>
              <option value="">All</option>
              <option value="meta">Meta</option>
              <option value="google">Google</option>
              <option value="tiktok">TikTok</option>
              <option value="yandex">Yandex</option>
              <option value="telegram">Telegram</option>
              <option value="monochrome">Monochrome</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Date From</span>
            <input className={styles.input} type="date" value={filters.dateFrom} onChange={(e) => setFilters((s) => ({ ...s, dateFrom: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Date To</span>
            <input className={styles.input} type="date" value={filters.dateTo} onChange={(e) => setFilters((s) => ({ ...s, dateTo: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Amount Min</span>
            <input className={styles.input} type="number" min="0" value={filters.amountMin} onChange={(e) => setFilters((s) => ({ ...s, amountMin: e.target.value }))} placeholder="10000" />
          </label>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.55fr) minmax(300px, 0.9fr)',
            gap: 14,
            alignItems: 'start',
            padding: '12px 22px 20px',
          }}
        >
          <div
            className={styles.tableWrap}
            style={{
              border: '1px solid #ece5d9',
              borderRadius: 18,
              background: '#fff',
              overflow: 'hidden',
            }}
          >
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ref ID</th>
                  <th>Client</th>
                  <th>Platform</th>
                  <th>FX Rate</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {!filtered.length ? (
                  <tr><td colSpan={7}>No topups found.</td></tr>
                ) : (
                  filtered.map((row) => {
                    const isSelected = String(row.id) === String(selected?.id)
                    return (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId(String(row.id))}
                        style={isSelected ? { background: '#faf7f2', boxShadow: 'inset 3px 0 0 #2457ff', cursor: 'pointer' } : { cursor: 'pointer' }}
                      >
                        <td>
                          <span className={styles.tableStrong}>{formatDate(row.created_at)}</span>
                          <span className={styles.tableMeta}>{formatTime(row.created_at)}</span>
                        </td>
                        <td>
                          <span className={styles.tableStrong}>{row.reference_id || `TXN-${row.id}`}</span>
                          <span className={styles.tableMeta}>#{row.id}</span>
                        </td>
                        <td>
                          <span className={styles.tableStrong}>{row.user_email || '—'}</span>
                          <span className={styles.tableMeta}>{row.account_name || 'Ad Account'}</span>
                        </td>
                        <td><span className={styles.platformBadge}>{row.account_platform_label || '—'}</span></td>
                        <td>{formatFxRate((row.breakdown || {}).fxRate || row.fx_rate)}</td>
                        <td><span className={statusClass(row.status)}>{statusLabel(row.status)}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          {row.status === 'pending' ? (
                            <button className={styles.buttonPrimary} type="button" onClick={() => setSelectedId(String(row.id))}>
                              Review
                            </button>
                          ) : (
                            <span className={styles.statusChipMuted}>Done</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <aside
            style={{
              background: 'linear-gradient(180deg, #fffdfa 0%, #fff9f2 100%)',
              border: '1px solid #ece5d9',
              borderRadius: 18,
              boxShadow: '0 8px 24px rgba(29, 27, 24, 0.08)',
              padding: 18,
              display: 'grid',
              gap: 14,
              alignContent: 'start',
              alignSelf: 'start',
              position: 'sticky',
              top: 18,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 28, lineHeight: 1, letterSpacing: '-0.03em', fontWeight: 800 }}>Review Transaction</h4>

            {!selected ? (
              <p className={styles.muted}>Select a row to review transaction details.</p>
            ) : (
              <>
                <div className={styles.detailSection}>
                  <span className={styles.fieldLabel}>Current Status</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span className={statusClass(selected.status)}>{statusLabel(selected.status)}</span>
                    <span className={styles.muted}>{formatDate(selected.created_at)} {formatTime(selected.created_at)}</span>
                  </div>
                </div>

                <div className={styles.detailSection}>
                  <span className={styles.fieldLabel}>Risk Assessment</span>
                  {!selectedRisk.length ? (
                    <span className={styles.statusChip}>No risk flags</span>
                  ) : (
                    selectedRisk.map((risk, idx) => (
                      <div key={`${risk.label}-${idx}`} style={{ display: 'grid', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span className={risk.level === 'high' ? styles.statusChipWarn : styles.statusChipMuted}>{risk.label}</span>
                          <span className={styles.muted}>{risk.level.toUpperCase()}</span>
                        </div>
                        <p className={styles.muted} style={{ margin: 0 }}>{risk.note}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className={styles.detailSection}>
                  <span className={styles.fieldLabel}>Financial Ledger</span>
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>Client Funding</span><strong>{formatMoney(selectedBreakdown.clientFunding)} {selectedBreakdown.inputCurrency || ''}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>Acquiring Fee</span><strong>-{formatMoney(selectedBreakdown.acquiringFee)} {selectedBreakdown.inputCurrency || ''}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>VAT</span><strong>-{formatMoney(selectedBreakdown.vat)} {selectedBreakdown.inputCurrency || ''}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>Total Wallet Debit</span><strong>{formatMoney(selectedBreakdown.totalWalletDebit)} {selectedBreakdown.inputCurrency || ''}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>Net Account Funding</span><strong>{formatMoney(selectedBreakdown.netAccountFunding)} {selectedBreakdown.accountCurrency || ''}</strong></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><span>FX Rate</span><strong>{formatFxRate(selectedBreakdown.fxRate || selected?.fx_rate)}</strong></div>
                  </div>
                </div>

                <div className={styles.detailSection}>
                  <span className={styles.fieldLabel}>Metadata</span>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Reference</span>
                    <span className={styles.detailValue}>{selected.reference_id || `Topup #${selected.id}`}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Raw Status</span>
                    <span className={styles.detailValue}>{selected.raw_status || selected.status || '—'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Target Account</span>
                    <span className={styles.detailValue}>{selected.account_name || '—'} ({selectedBreakdown.accountCurrency || '—'})</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Platform</span>
                    <span className={styles.detailValue}>{selected.account_platform_label || '—'}</span>
                  </div>
                </div>

                <div className={styles.buttonRow}>
                  <button className={styles.buttonPrimary} type="button" disabled={selected.status !== 'pending'} onClick={() => setTopupStatus(selected.id, 'completed')}>
                    Approve
                  </button>
                  <button className={styles.buttonGhost} type="button" disabled={selected.status !== 'pending'} onClick={() => setTopupStatus(selected.id, 'failed')}>
                    Fail
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>

        <div className={styles.cardHeader}>
          <p className={styles.muted}>{status || 'Topups are read directly from the current backend queue.'}</p>
        </div>
      </section>
    </AdminShell>
  )
}
