'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AccountRequestModal from './AccountRequestModal'
import ClientShell from './ClientShell'
import styles from './client.module.css'
import { getAuthToken } from '../../lib/auth'
import { useI18n } from '../../lib/i18n/client'

const PAGE_SIZE = 12

function detailFallback(tr) {
  return {
    status: tr('No data', 'Нет данных'),
    referenceId: '—',
    legalEntity: '—',
    account: '—',
    category: tr('Finance', 'Финансы'),
    note: tr('No financial movements found for the selected filter.', 'Для выбранного фильтра финансовые операции не найдены.'),
    primaryAction: tr('Action unavailable', 'Действие недоступно'),
    secondaryAction: tr('No document', 'Нет документа'),
    primaryActionHref: null,
    secondaryActionHref: null,
    documentName: tr('No document attached', 'Документ не прикреплен'),
    documentMeta: '—',
    documentUrl: null,
    extraRows: [],
  }
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
  const { tr } = useI18n()
  const [metrics, setMetrics] = useState([])
  const [tab, setTab] = useState('Transactions')
  const [tabMeta, setTabMeta] = useState([
    { key: 'Transactions', count: 0 },
    { key: 'Topups', count: 0 },
    { key: 'Invoices', count: 0 },
    { key: 'Finance docs', count: 0 },
  ])
  const [datasets, setDatasets] = useState({
    Transactions: [],
    Topups: [],
    Invoices: [],
    'Finance docs': [],
  })
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(detailFallback(tr))
  const [statusAlerts, setStatusAlerts] = useState(tr('0 Alerts', '0 уведомлений'))
  const [statusRows, setStatusRows] = useState([
    { icon: '$', label: 'USD/KZT 471.2' },
    { icon: '€', label: 'EUR/USD 1.08' },
  ])
  const [ticks, setTicks] = useState([
    { label: 'USD/KZT', value: '471.2' },
    { label: 'EUR/USD', value: '1.08' },
  ])
  const [accountRequestOpen, setAccountRequestOpen] = useState(false)
  const [actionStatus, setActionStatus] = useState('')
  const [exportingTopups, setExportingTopups] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [pageByTab, setPageByTab] = useState({
    Transactions: 1,
    Topups: 1,
    Invoices: 1,
    'Finance docs': 1,
  })
  const [detailClosed, setDetailClosed] = useState(false)

  function trMetricLabel(value) {
    const v = String(value || '')
    if (v === 'Available Balance') return tr('Available Balance', 'Доступный баланс')
    if (v === 'Top-Ups This Period') return tr('Top-Ups This Period', 'Пополнения за период')
    if (v === 'Platform Spend') return tr('Platform Spend', 'Расход по платформам')
    if (v === 'Outstanding Invoices') return tr('Outstanding Invoices', 'Открытые счета')
    return v
  }

  function trMetricHint(value) {
    const v = String(value || '')
    if (v === 'Last 30 days') return tr('Last 30 days', 'Последние 30 дней')
    if (v === 'Spend is leading funding') return tr('Spend is leading funding', 'Расход опережает пополнения')
    if (v === 'Funding exceeds current spend') return tr('Funding exceeds current spend', 'Пополнения покрывают текущий расход')
    if (v === 'No open invoice requests') return tr('No open invoice requests', 'Нет открытых запросов на счет')
    const urgentMatch = v.match(/^(\d+)\s+require immediate action$/i)
    if (urgentMatch) return tr(`${urgentMatch[1]} require immediate action`, `${urgentMatch[1]} требуют немедленного действия`)
    return v
  }

  function trStatus(value) {
    const v = String(value || '')
    if (v === 'Completed') return tr('Completed', 'Завершено')
    if (v === 'Processing') return tr('Processing', 'В обработке')
    if (v === 'Action Required') return tr('Action Required', 'Требует действия')
    if (v === 'Pending') return tr('Pending', 'Ожидает')
    if (v === 'Failed') return tr('Failed', 'Ошибка')
    return v
  }

  function trTab(value) {
    const v = String(value || '')
    if (v === 'Transactions') return tr('Transactions', 'Транзакции')
    if (v === 'Topups') return tr('Topups', 'Пополнения')
    if (v === 'Invoices') return tr('Invoices', 'Счета')
    if (v === 'Finance docs') return tr('Finance docs', 'Фин. документы')
    return v
  }

  async function openProtectedAsset(url, mode = 'open', fallbackName = 'document') {
    const token = getAuthToken()
    if (!url || url === '#') {
      setActionStatus(tr('This action is not available for this record.', 'Это действие недоступно для этой записи.'))
      return
    }
    if (!token) return

    setActionStatus('')
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const contentType = res.headers.get('content-type') || 'application/octet-stream'
      if (!res.ok) {
        const payload = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {}
        throw new Error(payload?.detail || tr('Failed to open document', 'Не удалось открыть документ'))
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
        throw new Error(tr('Popup blocked while opening document', 'Браузер заблокировал открытие окна'))
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    } catch (e) {
      setActionStatus(e?.message || tr('Failed to open document', 'Не удалось открыть документ'))
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
        throw new Error(payload?.detail || tr('Failed to export topups', 'Не удалось выгрузить пополнения'))
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
      setActionStatus(e?.message || tr('Failed to export topups', 'Не удалось выгрузить пополнения'))
    } finally {
      setExportingTopups(false)
    }
  }

  const loadFinance = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      router.replace('/login')
      return
    }
    try {
      setLoadError('')
      const res = await fetch('/api/client/finance', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error(tr('Failed to load finance', 'Не удалось загрузить финансы'))
      const payload = await res.json()
      setMetrics(Array.isArray(payload.metrics) ? payload.metrics : [])
      const nextDatasets = {
        Transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
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
    } catch {
      setLoadError(tr('Failed to load finance data. Please refresh or contact support.', 'Не удалось загрузить финансовые данные. Обновите страницу или обратитесь в поддержку.'))
    }
  }, [router, tr])

  useEffect(() => {
    loadFinance()
  }, [loadFinance])

  useEffect(() => {
    function applyHashTab() {
      if (typeof window === 'undefined') return
      const hash = String(window.location.hash || '').replace(/^#/, '').toLowerCase()
      if (hash === 'invoices') setTab('Invoices')
      if (hash === 'topups') setTab('Topups')
      if (hash === 'transactions') setTab('Transactions')
      if (hash === 'finance-docs' || hash === 'financedocs') setTab('Finance docs')
    }
    applyHashTab()
    window.addEventListener('hashchange', applyHashTab)
    return () => window.removeEventListener('hashchange', applyHashTab)
  }, [])

  useEffect(() => {
    function onInvoiceGenerated() {
      setTab('Invoices')
      loadFinance()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('invoice-generated', onInvoiceGenerated)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('invoice-generated', onInvoiceGenerated)
      }
    }
  }, [loadFinance])

  const activeRows = useMemo(() => datasets[tab] || [], [datasets, tab])
  const currentPage = Math.max(1, Number(pageByTab[tab] || 1))
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE))
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return activeRows.slice(start, start + PAGE_SIZE)
  }, [activeRows, currentPage])

  function setCurrentPage(nextPage) {
    const safePage = Math.min(Math.max(1, Number(nextPage || 1)), totalPages)
    setPageByTab((prev) => ({ ...prev, [tab]: safePage }))
  }

  const pageRangeLabel = useMemo(() => {
    if (!activeRows.length) return tr('0 items', '0 записей')
    const start = (currentPage - 1) * PAGE_SIZE + 1
    const end = Math.min(currentPage * PAGE_SIZE, activeRows.length)
    return `${start}-${end} ${tr('of', 'из')} ${activeRows.length}`
  }, [activeRows.length, currentPage, tr])

  const displayMetrics = useMemo(
    () =>
      (metrics || []).map((card) => ({
        ...card,
        label: trMetricLabel(card?.label),
        hint: trMetricHint(card?.hint),
      })),
    [metrics, tr]
  )

  const displayStatusRows = useMemo(
    () =>
      (statusRows || []).map((row) => ({
        ...row,
        label: trMetricHint(row?.label),
      })),
    [statusRows, tr]
  )

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages, tab])

  useEffect(() => {
    const firstId = activeRows[0]?.id || null
    if (!activeRows.find((row) => row.id === selectedId)) {
      setSelectedId(firstId)
    }
  }, [activeRows, selectedId])

  const selectedRow = useMemo(
    () => (detailClosed ? null : activeRows.find((row) => row.id === selectedId) || activeRows[0] || null),
    [activeRows, selectedId, detailClosed]
  )

  useEffect(() => {
    if (!selectedRow) {
      setDetail(detailFallback(tr))
      return
    }
    setDetail({
      status: selectedRow.status,
      referenceId: selectedRow.referenceId || '—',
      legalEntity: selectedRow.entity || '—',
      account: selectedRow.account || '—',
      category: selectedRow.type || tab,
      note: selectedRow.note || tr('No additional note is available for this item.', 'Для этого элемента нет дополнительного комментария.'),
      primaryAction: selectedRow.primaryAction || (selectedRow.status === 'Action Required' ? tr('Resolve Issue', 'Решить проблему') : tr('Raise a Question', 'Задать вопрос')),
      secondaryAction: selectedRow.secondaryAction || (tab === 'Finance docs' ? tr('Open Document', 'Открыть документ') : tr('Download Document', 'Скачать документ')),
      primaryActionHref: selectedRow.primaryActionHref || '#',
      secondaryActionHref: selectedRow.secondaryActionHref || '#',
      documentName: selectedRow.title || tr('No document attached', 'Документ не прикреплен'),
      documentMeta: selectedRow.date || '—',
      documentUrl: selectedRow.documentUrl || '#',
      extraRows: Array.isArray(selectedRow.extraRows) ? selectedRow.extraRows : [],
    })
  }, [selectedRow, tab])

  const detailTitle = useMemo(() => {
    if (tab === 'Topups') return tr('Funding Detail', 'Детали пополнения')
    if (tab === 'Invoices') return tr('Invoice Detail', 'Детали счета')
    if (tab === 'Finance docs') return tr('Document Detail', 'Детали документа')
    return tr('Transaction Detail', 'Детали транзакции')
  }, [tab, tr])

  const canRunPrimaryAction = Boolean(detail?.primaryActionHref && detail.primaryActionHref !== '#')
  const canRunSecondaryAction = Boolean(detail?.secondaryActionHref && detail.secondaryActionHref !== '#')
  const canOpenDocument = Boolean(detail?.documentUrl && detail.documentUrl !== '#')

  return (
    <ClientShell
      activeNav="finance"
      pageTitle={tr('Finance', 'Финансы')}
      pageSubtitle={tr('Manage balances, transactions, invoices and financial documents.', 'Управляйте балансами, транзакциями, счетами и финансовыми документами.')}
      headerActionLabel={tr('Create Request', 'Создать запрос')}
      headerActionOnClick={() => setAccountRequestOpen(true)}
      searchPlaceholder={tr('Search Entity...', 'Поиск по юрлицу...')}
      ticks={ticks}
      statusAlerts={statusAlerts}
      statusRows={displayStatusRows}
    >
      {loadError ? <div className={styles.pageErrorBanner}>{loadError}</div> : null}
      <section className={styles.cardGrid4}>
        {displayMetrics.map((card) => (
          <MetricCard card={card} key={card.label} />
        ))}
      </section>

      <section className={styles.financeLayout}>
        <div>
          <div className={styles.tabsRow}>
            <div className={styles.tabs}>
              <span className={styles.tabActive}>{trTab(tab)}</span>
              {tabMeta
                .map((item) => item.key)
                .filter((item) => item !== tab)
                .map((item) => (
                  <button
                    className={styles.tab}
                    key={item}
                    onClick={() => {
                      setTab(item)
                      setDetailClosed(false)
                    }}
                    type="button"
                  >
                    {trTab(item)}
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
                title={tab === 'Topups' ? tr('Export Topups to Excel', 'Экспорт пополнений в Excel') : tr('Export is available on Topups tab', 'Экспорт доступен во вкладке Пополнения')}
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
                    <th>{tr('Transaction Date', 'Дата транзакции')}</th>
                    <th>{tr('Description', 'Описание')}</th>
                    <th>{tr('Type', 'Тип')}</th>
                    <th>{tr('Entity', 'Юрлицо')}</th>
                    <th>{tr('Amount', 'Сумма')}</th>
                    <th>{tr('Status', 'Статус')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => (
                    <tr
                      className={row.id === selectedId ? styles.selectedRow : ''}
                      key={row.id || `${row.date}-${row.title}`}
                      onClick={() => {
                        setSelectedId(row.id)
                        setDetailClosed(false)
                      }}
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
                          {trStatus(row.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.pager}>
              <span>{`${trTab(tab)}: ${pageRangeLabel}`}</span>
              <div className={styles.pagerButtons}>
                <button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}>
                  {tr('Previous', 'Назад')}
                </button>
                <button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
                  {tr('Next', 'Далее')}
                </button>
              </div>
            </div>
          </article>
        </div>

        <aside className={styles.detailPanel}>
          <div className={styles.detailPanelInner}>
            <div className={styles.detailTitleRow}>
              <h3 className={styles.detailTitle}>{detailTitle}</h3>
              <button className={styles.closeGhost} type="button" onClick={() => setDetailClosed(true)}>
                ×
              </button>
            </div>

            <div className={styles.detailBlock}>
              <p className={styles.detailBlockLabel}>{tr('Core Information', 'Основная информация')}</p>
              <div className={styles.detailList}>
                <div className={styles.detailRow}>
                  <span>{tr('Status', 'Статус')}</span>
                  <strong>{detail.status}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>{tr('Reference ID', 'ID ссылки')}</span>
                  <strong>{detail.referenceId}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>{tr('Legal Entity', 'Юрлицо')}</span>
                  <strong>{detail.legalEntity}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>{tr('Account', 'Аккаунт')}</span>
                  <strong>{detail.account}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>{tr('Category', 'Категория')}</span>
                  <strong>{detail.category}</strong>
                </div>
              </div>
            </div>

            {detail.extraRows && detail.extraRows.length ? (
              <div className={styles.detailBlock}>
                <p className={styles.detailBlockLabel}>{tr('Funding Terms', 'Условия пополнения')}</p>
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
              <p className={styles.detailBlockLabel}>{tr('Processing Note', 'Комментарий')}</p>
              <p className={styles.processingNote}>{detail.note}</p>
            </div>

            <div className={styles.stackActions}>
              <button
                className={styles.stackPrimary}
                disabled={!canRunPrimaryAction}
                onClick={() => openProtectedAsset(detail.primaryActionHref, 'open', detail.documentName || detail.referenceId)}
                type="button"
              >
                {detail.primaryAction}
              </button>
              <button
                className={styles.stackSecondary}
                disabled={!canRunSecondaryAction}
                onClick={() => openProtectedAsset(detail.secondaryActionHref, 'download', detail.documentName || detail.referenceId)}
                type="button"
              >
                {detail.secondaryAction}
              </button>
            </div>

            <div className={styles.docCard}>
              <p className={styles.detailBlockLabel}>{tr('Attached Document', 'Прикрепленный документ')}</p>
              <div className={styles.docMeta}>
                <div className={styles.docIcon}>PDF</div>
                <div className={styles.docText}>
                  <strong>{detail.documentName}</strong>
                  <span>{detail.documentMeta}</span>
                </div>
              </div>
              <button
                className={styles.docAction}
                disabled={!canOpenDocument}
                onClick={() => openProtectedAsset(detail.documentUrl, 'open', detail.documentName || detail.referenceId)}
                type="button"
              >
                {tr('Open Document', 'Открыть документ')}
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
