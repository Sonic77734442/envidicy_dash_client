'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AccountRequestModal from './AccountRequestModal'
import ClientShell from './ClientShell'
import styles from './client.module.css'
import { getAuthToken } from '../../lib/auth'

const METRICS = [
  { label: 'Available Balance', value: '$428,950.00', hint: '+12.5% from last month', tone: 'good' },
  { label: 'Top-Ups This Period', value: '$84,200.00', hint: 'Last 30 days', tone: 'good' },
  { label: 'Platform Spend', value: '$12,450.12', hint: '8% increase', tone: 'warn' },
  { label: 'Outstanding Invoices', value: '12', hint: '3 Require immediate action', tone: 'warn' },
]

const TRANSACTIONS = [
  {
    date: 'Oct 24, 2023',
    title: 'AWS Cloud Services',
    subtitle: 'Monthly infrastructure billing',
    type: 'Infrastructure',
    entity: 'Arch-Global Ltd',
    amount: '-$2,440.00',
    positive: false,
    status: 'Completed',
    selected: true,
  },
  {
    date: 'Oct 22, 2023',
    title: 'Legal Consulting - Q4',
    subtitle: 'Quarterly retainer fee',
    type: 'Professional Services',
    entity: 'Arch-UK Partners',
    amount: '-$15,000.00',
    positive: false,
    status: 'Processing',
  },
  {
    date: 'Oct 20, 2023',
    title: 'Client Deposit - Project X',
    subtitle: 'Inbound wire transfer',
    type: 'Revenue',
    entity: 'Arch-Global Ltd',
    amount: '+$45,000.00',
    positive: true,
    status: 'Completed',
  },
  {
    date: 'Oct 18, 2023',
    title: 'Office Lease - Manhattan',
    subtitle: 'Monthly rental payment',
    type: 'Rent',
    entity: 'Arch-US Holdings',
    amount: '-$8,200.00',
    positive: false,
    status: 'Action Required',
  },
]

const DETAIL_FALLBACK = {
  status: 'Completed',
  referenceId: '#TXN-94021',
  legalEntity: 'Architectural Ledger',
  account: 'Main Operating',
  category: 'Infrastructure',
  note: 'Standard recurring invoice for cloud computing resources. Automatic reconciliation successful against budget line item B-042.',
  primaryAction: 'Raise a Question',
  secondaryAction: 'Download Document',
  primaryActionHref: '#',
  secondaryActionHref: '#',
  documentName: 'Invoice_AWS_Oct.pdf',
  documentMeta: 'Uploaded Oct 24, 2023',
  documentUrl: '#',
  extraRows: [],
}

function MetricCard({ card }) {
  const hintClass =
    card.tone === 'good'
      ? `${styles.metricHint} ${styles.metricHintGood}`
      : card.tone === 'warn'
        ? `${styles.metricHint} ${styles.metricHintWarn}`
        : styles.metricHint

  return (
    <article className={styles.metricCard}>
      <p className={styles.metricLabel}>{card.label}</p>
      <p className={styles.metricValue}>{card.value}</p>
      <div className={hintClass}>{card.hint}</div>
    </article>
  )
}

export default function FinancePage() {
  const router = useRouter()
  const [metrics, setMetrics] = useState(METRICS)
  const [tab, setTab] = useState('Transactions')
  const [tabMeta, setTabMeta] = useState([
    { key: 'Transactions', count: TRANSACTIONS.length },
    { key: 'Topups', count: 0 },
    { key: 'Invoices', count: 0 },
    { key: 'Finance docs', count: 0 },
  ])
  const [datasets, setDatasets] = useState({
    Transactions: TRANSACTIONS,
    Topups: [],
    Invoices: [],
    'Finance docs': [],
  })
  const [selectedId, setSelectedId] = useState(TRANSACTIONS[0] ? `${TRANSACTIONS[0].date}-${TRANSACTIONS[0].title}` : null)
  const [detail, setDetail] = useState(DETAIL_FALLBACK)
  const [statusAlerts, setStatusAlerts] = useState('2 Alerts')
  const [statusRows, setStatusRows] = useState([
    { icon: '$', label: 'USD/KZT 471.2' },
    { icon: '€', label: 'EUR/USD 1.08' },
  ])
  const [ticks, setTicks] = useState([
    { label: 'USD/KZT', value: '471.2' },
    { label: 'EUR/USD', value: '1.08' },
  ])
  const [pagerLabel, setPagerLabel] = useState('Showing 1-10 of 142 transactions')
  const [accountRequestOpen, setAccountRequestOpen] = useState(false)
  const [actionStatus, setActionStatus] = useState('')
  const [exportingTopups, setExportingTopups] = useState(false)

  async function openProtectedAsset(url, mode = 'open', fallbackName = 'document') {
    const token = getAuthToken()
    if (!token || !url || url === '#') return

    setActionStatus('')
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const contentType = res.headers.get('content-type') || 'application/octet-stream'
      if (!res.ok) {
        const payload = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {}
        throw new Error(payload?.detail || 'Failed to open document')
      }

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const fileName = detail.documentName || fallbackName

      if (mode === 'download') {
        const link = document.createElement('a')
        link.href = objectUrl
        link.download = fileName
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
        return
      }

      const opened = window.open(objectUrl, '_blank', 'noopener')
      if (!opened) {
        URL.revokeObjectURL(objectUrl)
        throw new Error('Popup blocked while opening document')
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    } catch (e) {
      setActionStatus(e?.message || 'Failed to open document')
    }
  }

  async function exportTopups() {
    if (tab !== 'Topups' || exportingTopups) return
    const token = getAuthToken()
    if (!token) {
      router.replace('/login')
      return
    }

    setActionStatus('')
    setExportingTopups(true)
    try {
      const res = await fetch('/api/client/export/topups', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok) {
        const payload = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {}
        throw new Error(payload?.detail || 'Failed to export topups')
      }

      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const fileName = match?.[1] || `client-topups-${new Date().toISOString().slice(0, 10)}.csv`
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (e) {
      setActionStatus(e?.message || 'Failed to export topups')
    } finally {
      setExportingTopups(false)
    }
  }

  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      router.replace('/login')
      return
    }

    async function loadFinance() {
      try {
        const res = await fetch('/api/client/finance', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        if (res.status === 401) {
          router.replace('/login')
          return
        }
        if (!res.ok) throw new Error('Failed to load finance')
        const payload = await res.json()
        if (Array.isArray(payload.metrics) && payload.metrics.length) setMetrics(payload.metrics)
        const nextDatasets = {
          Transactions: Array.isArray(payload.transactions) && payload.transactions.length ? payload.transactions : TRANSACTIONS,
          Topups: Array.isArray(payload.topups) ? payload.topups : [],
          Invoices: Array.isArray(payload.invoices) ? payload.invoices : [],
          'Finance docs': Array.isArray(payload.financeDocs) ? payload.financeDocs : [],
        }
        setDatasets(nextDatasets)
        if (Array.isArray(payload.tabs) && payload.tabs.length) setTabMeta(payload.tabs)
        setSelectedId(nextDatasets.Transactions[0]?.id || null)
        if (payload.detail) setDetail(payload.detail)
        if (payload.statusAlerts) setStatusAlerts(payload.statusAlerts)
        if (Array.isArray(payload.statusRows) && payload.statusRows.length) setStatusRows(payload.statusRows)
        if (Array.isArray(payload.ticks) && payload.ticks.length) setTicks(payload.ticks)
        if (payload.pager?.label) setPagerLabel(payload.pager.label)
      } catch {
        // Keep fallback content when normalized finance payload is unavailable.
      }
    }

    loadFinance()
  }, [router])

  const activeRows = useMemo(() => datasets[tab] || [], [datasets, tab])

  useEffect(() => {
    const firstId = activeRows[0]?.id || null
    if (!activeRows.find((row) => row.id === selectedId)) {
      setSelectedId(firstId)
    }
  }, [activeRows, selectedId])

  const selectedRow = useMemo(
    () => activeRows.find((row) => row.id === selectedId) || activeRows[0] || null,
    [activeRows, selectedId]
  )

  useEffect(() => {
    if (!selectedRow) {
      setDetail(DETAIL_FALLBACK)
      return
    }
    setDetail({
      status: selectedRow.status,
      referenceId: selectedRow.referenceId || '—',
      legalEntity: selectedRow.entity || '—',
      account: selectedRow.account || '—',
      category: selectedRow.type || tab,
      note: selectedRow.note || 'No additional note is available for this item.',
      primaryAction: selectedRow.primaryAction || (selectedRow.status === 'Action Required' ? 'Resolve Issue' : 'Raise a Question'),
      secondaryAction: selectedRow.secondaryAction || (tab === 'Finance docs' ? 'Open Document' : 'Download Document'),
      primaryActionHref: selectedRow.primaryActionHref || '#',
      secondaryActionHref: selectedRow.secondaryActionHref || '#',
      documentName: selectedRow.title || 'No document attached',
      documentMeta: selectedRow.date || '—',
      documentUrl: selectedRow.documentUrl || '#',
      extraRows: Array.isArray(selectedRow.extraRows) ? selectedRow.extraRows : [],
    })
  }, [selectedRow, tab])

  const detailTitle = useMemo(() => {
    if (tab === 'Topups') return 'Funding Detail'
    if (tab === 'Invoices') return 'Invoice Detail'
    if (tab === 'Finance docs') return 'Document Detail'
    return 'Transaction Detail'
  }, [tab])

  return (
    <ClientShell
      activeNav="finance"
      pageTitle="Finance"
      pageSubtitle="Manage balances, transactions, invoices and financial documents."
      headerActionLabel="Create Request"
      headerActionOnClick={() => setAccountRequestOpen(true)}
      searchPlaceholder="Search Entity..."
      ticks={ticks}
      statusAlerts={statusAlerts}
      statusRows={statusRows}
    >
      <section className={styles.cardGrid4}>
        {metrics.map((card) => (
          <MetricCard card={card} key={card.label} />
        ))}
      </section>

      <section className={styles.financeLayout}>
        <div>
          <div className={styles.tabsRow}>
            <div className={styles.tabs}>
              <span className={styles.tabActive}>{tab}</span>
              {tabMeta
                .map((item) => item.key)
                .filter((item) => item !== tab)
                .map((item) => (
                  <button className={styles.tab} key={item} onClick={() => setTab(item)} type="button">
                    {item}
                  </button>
                ))}
            </div>
            <div className={styles.tableTools}>
              <button className={styles.toolButton} type="button">
                ≡
              </button>
              <button
                className={styles.toolButton}
                disabled={tab !== 'Topups' || exportingTopups}
                onClick={exportTopups}
                title={tab === 'Topups' ? 'Export Topups to Excel' : 'Export is available on Topups tab'}
                type="button"
              >
                ↓
              </button>
            </div>
          </div>

          <article className={styles.financeTableCard}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Transaction Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Entity</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row) => (
                    <tr
                      className={row.id === selectedId ? styles.selectedRow : ''}
                      key={row.id || `${row.date}-${row.title}`}
                      onClick={() => setSelectedId(row.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className={styles.tableStrong}>{row.date}</span>
                      </td>
                      <td>
                        <span className={styles.tableStrong}>{row.title}</span>
                        <span className={styles.tableSubtle}>{row.subtitle}</span>
                      </td>
                      <td>
                        <span className={styles.tableSubtle}>{row.type}</span>
                      </td>
                      <td>
                        <span className={styles.tableSubtle}>{row.entity}</span>
                      </td>
                      <td>
                        <span className={row.positive ? styles.amountPositive : styles.amountNegative}>{row.amount}</span>
                      </td>
                      <td>
                        <span
                          className={
                            row.status === 'Completed'
                              ? styles.statusChip
                              : row.status === 'Processing'
                                ? styles.statusChipWarn
                                : styles.statusChipMuted
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.pager}>
              <span>{`${tab}: ${activeRows.length} items`}</span>
              <div className={styles.pagerButtons}>
                <button type="button">Previous</button>
                <button type="button">Next</button>
              </div>
            </div>
          </article>
        </div>

        <aside className={styles.detailPanel}>
          <div className={styles.detailPanelInner}>
            <div className={styles.detailTitleRow}>
              <h3 className={styles.detailTitle}>{detailTitle}</h3>
              <button className={styles.closeGhost} type="button">
                ×
              </button>
            </div>

            <div className={styles.detailBlock}>
              <p className={styles.detailBlockLabel}>Core Information</p>
              <div className={styles.detailList}>
                <div className={styles.detailRow}>
                  <span>Status</span>
                  <strong>{detail.status}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Reference ID</span>
                  <strong>{detail.referenceId}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Legal Entity</span>
                  <strong>{detail.legalEntity}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Account</span>
                  <strong>{detail.account}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Category</span>
                  <strong>{detail.category}</strong>
                </div>
              </div>
            </div>

            {detail.extraRows && detail.extraRows.length ? (
              <div className={styles.detailBlock}>
                <p className={styles.detailBlockLabel}>Funding Terms</p>
                <div className={styles.detailList}>
                  {detail.extraRows.map((row) => (
                    <div className={styles.detailRow} key={`${row.label}-${row.value}`}>
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={styles.detailBlock}>
              <p className={styles.detailBlockLabel}>Processing Note</p>
              <p className={styles.processingNote}>{detail.note}</p>
            </div>

            <div className={styles.stackActions}>
              <button
                className={styles.stackPrimary}
                onClick={() => openProtectedAsset(detail.primaryActionHref, 'open', detail.documentName || detail.referenceId)}
                type="button"
              >
                {detail.primaryAction}
              </button>
              <button
                className={styles.stackSecondary}
                onClick={() => openProtectedAsset(detail.secondaryActionHref, 'download', detail.documentName || detail.referenceId)}
                type="button"
              >
                {detail.secondaryAction}
              </button>
            </div>

            <div className={styles.docCard}>
              <p className={styles.detailBlockLabel}>Attached Document</p>
              <div className={styles.docMeta}>
                <div className={styles.docIcon}>PDF</div>
                <div className={styles.docText}>
                  <strong>{detail.documentName}</strong>
                  <span>{detail.documentMeta}</span>
                </div>
              </div>
              <button
                className={styles.docAction}
                onClick={() => openProtectedAsset(detail.documentUrl, 'open', detail.documentName || detail.referenceId)}
                type="button"
              >
                Open Document
              </button>
            </div>
            {actionStatus ? <p className={styles.processingNote}>{actionStatus}</p> : null}
          </div>
        </aside>
      </section>
      <AccountRequestModal onClose={() => setAccountRequestOpen(false)} open={accountRequestOpen} />
    </ClientShell>
  )
}
