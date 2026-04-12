'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminShell from '../../../components/admin/AdminShell'
import styles from '../../../components/admin/admin.module.css'
import { clearAuth, getAuthToken } from '../../../lib/auth'

function formatMoney(value, digits = 2) {
  const num = Number(value || 0)
  return num.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatDate(value) {
  if (!value) return '—'
  const raw = String(value).replace('T', ' ')
  const [date] = raw.split(' ')
  return date || '—'
}

function typeMeta(rawType, amount) {
  const key = String(rawType || '').toLowerCase()
  if (key === 'topup_hold') return { key: 'funding_hold', label: 'Funding Hold', status: 'held' }
  if (key === 'topup_hold_release') return { key: 'hold_release', label: 'Hold Release', status: 'released' }
  if (key === 'adjustment') return { key: 'adjustment', label: 'Adjustment', status: 'completed' }
  if (key === 'topup') {
    return Number(amount || 0) < 0
      ? { key: 'funding_debit', label: 'Funding Debit', status: 'completed' }
      : { key: 'invoice_credit', label: 'Invoice Credit', status: 'credited' }
  }
  return { key: 'unknown', label: 'Unknown', status: 'pending' }
}

function statusLabel(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'completed' || value === 'credited') return 'Completed'
  if (value === 'held') return 'Held'
  if (value === 'released') return 'Released'
  if (value === 'failed') return 'Failed'
  return 'Pending'
}

function statusClass(status) {
  const value = String(status || '').toLowerCase()
  if (value === 'completed' || value === 'credited' || value === 'released') return styles.statusChip
  if (value === 'failed') return styles.statusChipWarn
  return styles.statusChipMuted
}

function downloadCsv(filename, rows) {
  const csvCell = (value) => {
    const text = String(value ?? '')
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
  }
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
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

export default function AdminWalletPage() {
  const router = useRouter()

  const [mode, setMode] = useState('ledger')
  const [transactions, setTransactions] = useState([])
  const [profitSummary, setProfitSummary] = useState({ by_platform: [], overall: [] })
  const [selectedId, setSelectedId] = useState('')
  const [status, setStatus] = useState('Loading wallets...')
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    client: '',
    platform: '',
    amountMin: '',
    dateFrom: '',
    dateTo: '',
  })

  const [form, setForm] = useState({ user_email: '', amount: '', note: '' })

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

  async function fetchWallets() {
    const res = await adminRouteFetch('/api/admin/wallet')
    if (!res.ok) throw new Error('Failed to load wallet data.')
    const data = await res.json()
    const tx = Array.isArray(data?.transactions) ? data.transactions : []
    setTransactions(tx)
    if (!selectedId && tx.length) setSelectedId(String(tx[0].id))
    setProfitSummary({
      by_platform: Array.isArray(data?.profitSummary?.by_platform) ? data.profitSummary.by_platform : [],
      overall: Array.isArray(data?.profitSummary?.overall) ? data.profitSummary.overall : [],
    })
  }

  async function loadAll() {
    try {
      await fetchWallets()
      setStatus('')
    } catch (e) {
      setStatus(e?.message || 'Failed to load wallets.')
    }
  }

  async function adjustWallet(sign) {
    const email = form.user_email.trim()
    const amountRaw = Number(form.amount || 0)
    if (!email || !amountRaw) {
      setStatus('Provide client email and amount.')
      return
    }
    try {
      const res = await adminRouteFetch('/api/admin/wallet/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_email: email,
          amount: sign * amountRaw,
          note: form.note.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Failed to update wallet balance.')
      setStatus('Wallet balance updated.')
      setForm((s) => ({ ...s, amount: '', note: '' }))
      await loadAll()
    } catch (e) {
      setStatus(e?.message || 'Failed to update wallet balance.')
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const ledgerRows = useMemo(() => {
    return transactions.map((row) => {
      const meta = typeMeta(row.raw_type || row.type, row.amount)
      const amount = Number(row.amount || 0)
      const gross = Number(row.gross_amount || Math.abs(amount))
      const fee = Number(row.fee_amount || 0)
      const vat = Number(row.vat_amount || 0)
      const fxRate = Number(row.fx_rate || 0)
      const noteLower = String(row.note || '').toLowerCase()
      const failed = noteLower.includes('failed') || noteLower.includes('reject') || noteLower.includes('dispute')
      const operationStatus = String(row.operation_status || '').toLowerCase()
      return {
        id: String(row.id),
        createdAt: row.created_at || '',
        client: row.user_email || '—',
        typeKey: meta.key,
        typeLabel: meta.label,
        reference: `WT-${row.id}`,
        topupId: row.topup_id || null,
        gross,
        fee,
        vat,
        fxRate: Number.isFinite(fxRate) && fxRate > 0 ? fxRate : null,
        net: amount,
        ccy: row.currency || 'KZT',
        statusKey: failed ? 'failed' : (operationStatus || meta.status),
        platform: row.account_platform || '',
        account: row.account_name || '',
        note: row.note || '',
      }
    })
  }, [transactions])

  const profitRows = useMemo(() => {
    return (profitSummary.by_platform || []).map((row, index) => {
      const feeTotal = Number(row.fee_total || 0)
      const fxTotal = Number(row.fx_total || 0)
      const totalProfit = Number(row.profit_total || feeTotal + fxTotal)
      const inputTotal = Number(row.amount_input_total || 0)
      const margin = inputTotal > 0 ? (totalProfit / inputTotal) * 100 : 0
      return {
        id: `${row.platform || 'unknown'}-${row.currency || 'NA'}-${index}`,
        date: '—',
        client: 'Multiple Clients',
        reference: `${String(row.platform || 'platform').toUpperCase()}-${row.currency || 'NA'}`,
        platform: row.platform || 'unknown',
        totalProfit,
        feeProfit: feeTotal,
        fxProfit: fxTotal,
        status: totalProfit > 0 ? 'realized' : 'pending',
        margin,
        inputTotal,
        completedCount: Number(row.completed_count || 0),
        currency: row.currency || 'KZT',
      }
    })
  }, [profitSummary])

  const filteredLedgerRows = useMemo(() => {
    return ledgerRows.filter((row) => {
      const created = formatDate(row.createdAt)
      if (filters.type && row.typeKey !== filters.type) return false
      if (filters.status && row.statusKey !== filters.status) return false
      if (filters.client && !String(row.client).toLowerCase().includes(filters.client.toLowerCase())) return false
      if (filters.platform && String(row.platform).toLowerCase() !== filters.platform.toLowerCase()) return false
      if (filters.amountMin && Number(row.gross) < Number(filters.amountMin || 0)) return false
      if (filters.dateFrom && created !== '—' && created < filters.dateFrom) return false
      if (filters.dateTo && created !== '—' && created > filters.dateTo) return false
      return true
    })
  }, [ledgerRows, filters])

  const filteredProfitRows = useMemo(() => {
    return profitRows.filter((row) => {
      if (filters.platform && String(row.platform).toLowerCase() !== filters.platform.toLowerCase()) return false
      if (filters.status && String(row.status).toLowerCase() !== filters.status.toLowerCase()) return false
      if (filters.amountMin && Number(row.totalProfit || 0) < Number(filters.amountMin || 0)) return false
      return true
    })
  }, [profitRows, filters])

  const selectedLedger = useMemo(() => {
    if (!filteredLedgerRows.length) return null
    return filteredLedgerRows.find((row) => row.id === selectedId) || filteredLedgerRows[0]
  }, [filteredLedgerRows, selectedId])

  const selectedProfit = useMemo(() => {
    if (!filteredProfitRows.length) return null
    return filteredProfitRows.find((row) => row.id === selectedId) || filteredProfitRows[0]
  }, [filteredProfitRows, selectedId])

  useEffect(() => {
    const rows = mode === 'ledger' ? filteredLedgerRows : filteredProfitRows
    if (!rows.length) return
    if (!selectedId || !rows.some((row) => row.id === selectedId)) {
      setSelectedId(rows[0].id)
    }
  }, [mode, filteredLedgerRows, filteredProfitRows, selectedId])

  const profitStats = useMemo(() => {
    const totalProfit = filteredProfitRows.reduce((sum, row) => sum + Number(row.totalProfit || 0), 0)
    const feeProfit = filteredProfitRows.reduce((sum, row) => sum + Number(row.feeProfit || 0), 0)
    const fxProfit = filteredProfitRows.reduce((sum, row) => sum + Number(row.fxProfit || 0), 0)
    const inputTotal = filteredProfitRows.reduce((sum, row) => sum + Number(row.inputTotal || 0), 0)
    const pending = filteredProfitRows
      .filter((row) => String(row.status).toLowerCase() === 'pending')
      .reduce((sum, row) => sum + Number(row.totalProfit || 0), 0)
    return {
      fxProfit,
      feeProfit,
      totalProfit,
      pending,
      margin: inputTotal > 0 ? (totalProfit / inputTotal) * 100 : 0,
    }
  }, [filteredProfitRows])

  const holdStats = useMemo(() => {
    const holdRows = ledgerRows.filter((row) => row.typeKey === 'funding_hold' && (row.statusKey === 'held' || row.statusKey === 'pending'))
    const reservedAmount = holdRows.reduce((sum, row) => sum + Number(row.gross || 0), 0)
    const pendingCount = holdRows.length
    const netImpact = holdRows.reduce((sum, row) => sum + Number(row.net || 0), 0)
    return {
      reservedAmount,
      pendingCount,
      netImpact,
    }
  }, [ledgerRows])

  function exportCurrentView() {
    if (mode === 'ledger') {
      const rows = [
        ['Date', 'Client', 'Type', 'Reference', 'Gross', 'Fee', 'VAT', 'Net', 'Currency', 'Status'],
        ...filteredLedgerRows.map((row) => [
          formatDate(row.createdAt),
          row.client,
          row.typeLabel,
          row.reference,
          row.gross.toFixed(2),
          row.fee.toFixed(2),
          row.vat.toFixed(2),
          row.net.toFixed(2),
          row.ccy,
          statusLabel(row.statusKey),
        ]),
      ]
      downloadCsv(`wallet-ledger-${new Date().toISOString().slice(0, 10)}.csv`, rows)
      return
    }
    const rows = [
      ['Platform', 'Currency', 'Completed Count', 'Input Total', 'FX Profit', 'Fee Profit', 'Total Profit', 'Status'],
      ...filteredProfitRows.map((row) => [
        row.platform,
        row.currency,
        String(row.completedCount),
        row.inputTotal.toFixed(2),
        row.fxProfit.toFixed(2),
        row.feeProfit.toFixed(2),
        row.totalProfit.toFixed(2),
        String(row.status).toUpperCase(),
      ]),
    ]
    downloadCsv(`wallet-profit-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  return (
    <AdminShell title="Wallet Management" subtitle="Ledger operations and profit controls aligned with the new financial backend model.">
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.modeSwitch}>
            <button
              className={mode === 'ledger' ? styles.modeSwitchActive : styles.modeSwitchButton}
              onClick={() => setMode('ledger')}
              type="button"
            >
              Ledger
            </button>
            <button
              className={mode === 'profit' ? styles.modeSwitchActive : styles.modeSwitchButton}
              onClick={() => setMode('profit')}
              type="button"
            >
              Profit Mode
            </button>
          </div>
          <div className={styles.tableActions}>
            <button className={styles.buttonGhost} onClick={exportCurrentView} type="button">Export CSV</button>
          </div>
        </div>
      </section>

      <section className={styles.card} id="wallet-adjustment-form">
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>Manual Adjustment</h3>
            <p className={styles.cardSubtle}>Primary wallet control: controlled credit/debit by client email with audit note.</p>
          </div>
        </div>
        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Client Email</span>
            <input className={styles.input} value={form.user_email} onChange={(e) => setForm((s) => ({ ...s, user_email: e.target.value }))} placeholder="client@email.com" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Amount KZT</span>
            <input className={styles.input} type="number" step="0.01" value={form.amount} onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Note</span>
            <input className={styles.input} value={form.note} onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))} placeholder="Reason for adjustment" />
          </label>
        </div>
        <div className={styles.cardHeader}>
          <div className={styles.tableActions}>
            <button className={styles.buttonPrimary} type="button" onClick={() => adjustWallet(1)}>Credit Wallet</button>
            <button className={styles.buttonGhost} type="button" onClick={() => adjustWallet(-1)}>Debit Wallet</button>
          </div>
        </div>
        {status ? (
          <div className={styles.cardHeader}>
            <p className={styles.muted}>{status}</p>
          </div>
        ) : null}
      </section>

      <section className={styles.statsGrid}>
        <StatCard label="Reserved (Pending Holds)" value={`₸${formatMoney(holdStats.reservedAmount)}`} hint="Not confirmed topups only" />
        <StatCard label="Pending Hold Requests" value={holdStats.pendingCount} hint="Awaiting admin decision" />
        <StatCard
          label="Wallet Net Impact (Holds)"
          value={`${holdStats.netImpact < 0 ? '-' : '+'}₸${formatMoney(Math.abs(holdStats.netImpact))}`}
          hint="Temporary locked cash movement"
        />
        <StatCard label="Profit Mode" value={`₸${formatMoney(profitStats.totalProfit)}`} hint={`Pending profit: ₸${formatMoney(profitStats.pending)}`} />
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h3 className={styles.cardTitle}>{mode === 'ledger' ? 'Ledger Activity' : 'Profit Performance'}</h3>
            <p className={styles.cardSubtle}>
              {mode === 'ledger'
                ? 'Track wallet debits, holds and credits with immutable references.'
                : `Realized: ₸${formatMoney(profitStats.totalProfit)} · Pending: ₸${formatMoney(profitStats.pending)} · Margin: ${formatMoney(profitStats.margin, 2)}%`}
            </p>
          </div>
        </div>
        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Type</span>
            <select className={styles.select} value={filters.type} onChange={(e) => setFilters((s) => ({ ...s, type: e.target.value }))}>
              <option value="">All types</option>
              <option value="invoice_credit">Invoice Credit</option>
              <option value="funding_hold">Funding Hold</option>
              <option value="funding_debit">Funding Debit</option>
              <option value="hold_release">Hold Release</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Status</span>
            <select className={styles.select} value={filters.status} onChange={(e) => setFilters((s) => ({ ...s, status: e.target.value }))}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="held">Held</option>
              <option value="credited">Credited</option>
              <option value="completed">Completed</option>
              <option value="released">Released</option>
              <option value="failed">Failed</option>
              <option value="realized">Realized</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Client</span>
            <input className={styles.input} value={filters.client} onChange={(e) => setFilters((s) => ({ ...s, client: e.target.value }))} placeholder="client@email.com" />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Platform</span>
            <select className={styles.select} value={filters.platform} onChange={(e) => setFilters((s) => ({ ...s, platform: e.target.value }))}>
              <option value="">All</option>
              <option value="meta">Meta</option>
              <option value="google">Google Ads</option>
              <option value="tiktok">TikTok Ads</option>
              <option value="yandex">Yandex Direct</option>
              <option value="telegram">Telegram</option>
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Date From</span>
            <input className={styles.input} type="date" value={filters.dateFrom} onChange={(e) => setFilters((s) => ({ ...s, dateFrom: e.target.value }))} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Amount Min</span>
            <input className={styles.input} type="number" min="0" value={filters.amountMin} onChange={(e) => setFilters((s) => ({ ...s, amountMin: e.target.value }))} placeholder="10000" />
          </label>
        </div>
        <div className={styles.walletWorkbench}>
          <div className={styles.tableWrap} style={{ border: '1px solid #ece5d9', borderRadius: 18, background: '#fff' }}>
            <table className={styles.table}>
              <thead>
                {mode === 'ledger' ? (
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Gross</th>
                    <th>Net</th>
                    <th>CCY</th>
                    <th>Status</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Platform</th>
                    <th>Currency</th>
                    <th>Completed</th>
                    <th>Input Total</th>
                    <th>FX Profit</th>
                    <th>Fee Profit</th>
                    <th>Total Profit</th>
                    <th>Status</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {mode === 'ledger' ? (
                  !filteredLedgerRows.length ? (
                    <tr><td colSpan={8}>No ledger rows found for current filters.</td></tr>
                  ) : (
                    filteredLedgerRows.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setSelectedId(row.id)}
                        style={row.id === selectedLedger?.id ? { background: '#faf7f2', boxShadow: 'inset 3px 0 0 #2457ff', cursor: 'pointer' } : { cursor: 'pointer' }}
                      >
                        <td>{formatDate(row.createdAt)}</td>
                        <td>
                          <span className={styles.tableStrong}>{row.client}</span>
                          <span className={styles.tableMeta}>{row.account || 'Wallet operation'}</span>
                        </td>
                        <td><span className={styles.platformBadge}>{row.typeLabel}</span></td>
                        <td>{row.reference}</td>
                        <td>₸{formatMoney(row.gross)}</td>
                        <td style={{ color: row.net < 0 ? '#bf5138' : '#1b8b60', fontWeight: 700 }}>
                          {row.net < 0 ? '-' : '+'}₸{formatMoney(Math.abs(row.net))}
                        </td>
                        <td>{row.ccy}</td>
                        <td><span className={statusClass(row.statusKey)}>{statusLabel(row.statusKey)}</span></td>
                      </tr>
                    ))
                  )
                ) : !filteredProfitRows.length ? (
                  <tr><td colSpan={8}>No profit rows found for current filters.</td></tr>
                ) : (
                  filteredProfitRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      style={row.id === selectedProfit?.id ? { background: '#faf7f2', boxShadow: 'inset 3px 0 0 #2457ff', cursor: 'pointer' } : { cursor: 'pointer' }}
                    >
                      <td>{row.platform}</td>
                      <td>{row.currency}</td>
                      <td>{row.completedCount}</td>
                      <td>₸{formatMoney(row.inputTotal)}</td>
                      <td>₸{formatMoney(row.fxProfit)}</td>
                      <td>₸{formatMoney(row.feeProfit)}</td>
                      <td style={{ fontWeight: 700 }}>₸{formatMoney(row.totalProfit)}</td>
                      <td><span className={statusClass(row.status)}>{String(row.status).toUpperCase()}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <aside className={styles.sidePanel}>
            {mode === 'ledger' ? (
              <>
                <div className={styles.payloadCard}>
                  <p className={styles.detailSectionTitle}>Transaction Detail</p>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Reference</span>
                    <span className={styles.detailValue}>{selectedLedger?.reference || '—'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Client</span>
                    <span className={styles.detailValue}>{selectedLedger?.client || '—'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Net</span>
                    <span className={styles.detailValue}>{selectedLedger ? `${selectedLedger.net < 0 ? '-' : '+'}₸${formatMoney(Math.abs(selectedLedger.net))}` : '—'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Fee</span>
                    <span className={styles.detailValue}>{selectedLedger ? `₸${formatMoney(selectedLedger.fee || 0)}` : '—'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>FX Rate</span>
                    <span className={styles.detailValue}>{selectedLedger?.fxRate ? formatMoney(selectedLedger.fxRate, 4) : 'Not provided'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Linked Objects</span>
                    <span className={styles.detailValue}>
                      Wallet Tx {selectedLedger?.reference || '—'}
                      {selectedLedger?.topupId ? ` · Topup #${selectedLedger.topupId}` : ''}
                    </span>
                  </div>
                </div>
                <div className={styles.eventCard}>
                  <p className={styles.detailSectionTitle}>Audit Trail</p>
                  <div className={styles.eventList}>
                    <div className={styles.eventItem}>
                      <strong>Wallet Event Logged</strong>
                      <div>{formatDate(selectedLedger?.createdAt)}</div>
                    </div>
                    <div className={styles.eventItem}>
                      <strong>Status Applied</strong>
                      <div>{statusLabel(selectedLedger?.statusKey)}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className={styles.payloadCard}>
                  <p className={styles.detailSectionTitle}>Formula Snapshot</p>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Platform</span>
                    <span className={styles.detailValue}>{selectedProfit?.platform || '—'}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Input Total</span>
                    <span className={styles.detailValue}>₸{formatMoney(selectedProfit?.inputTotal || 0)}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Spread Margin</span>
                    <span className={styles.detailValue}>{formatMoney(selectedProfit?.margin || 0)}%</span>
                  </div>
                </div>
                <div className={styles.eventCard}>
                  <p className={styles.detailSectionTitle}>Audit Trail</p>
                  <div className={styles.eventList}>
                    <div className={styles.eventItem}>
                      <strong>Profit Calculated</strong>
                      <div>Based on completed topups summary</div>
                    </div>
                    <div className={styles.eventItem}>
                      <strong>Status</strong>
                      <div>{selectedProfit ? String(selectedProfit.status).toUpperCase() : '—'}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </section>
    </AdminShell>
  )
}
