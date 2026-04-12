'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AccountRequestModal from './AccountRequestModal'
import ClientShell from './ClientShell'
import FundingModal from './FundingModal'
import styles from './client.module.css'
import { getAuthToken } from '../../lib/auth'
import { useI18n } from '../../lib/i18n/client'

const FALLBACK_METRICS = [
  { label: 'Available Balance', value: '$142,850', hint: 'Ready for allocation', tone: 'good' },
  { label: 'Monthly Spend', value: '$82,492', hint: 'vs last period +8.4%', tone: 'warn' },
  { label: 'Active Accounts', value: '24', hint: 'Across 4 platforms' },
  { label: 'Pending Items', value: '07', hint: 'Approvals, docs, renewals' },
]

const FALLBACK_ACCOUNTS = [
  {
    account: 'Google Ads UK',
    platform: 'Google Ads',
    status: 'Active',
    balance: '$12,489',
    spend: '$4,200/mo',
    note: 'Healthy',
    noteTone: 'good',
    noteAction: 'Open',
  },
  {
    account: 'Meta Business',
    platform: 'Meta',
    status: 'Pending Setup',
    balance: '$820',
    spend: '$1,100/mo',
    note: 'Docs required',
    noteTone: 'warn',
    noteAction: 'Review',
  },
]

const FALLBACK_ACTIVITY = [
  { title: 'Top-up confirmed', text: 'Top-up of $25,000 processed for Google Ads UK', time: '1 hour ago', tone: 'good' },
  { title: 'Invoice uploaded', text: 'Q3 Media Spend Summary.pdf', time: '3 hours ago', tone: 'info' },
  { title: 'Budget approved', text: 'Q4 media budget approved for Meta Business entity', time: '6 hours ago', tone: 'good' },
  { title: 'Comment on Request', text: 'Legal added a comment to Upload residency document', time: 'Yesterday', tone: 'warn' },
]

const FALLBACK_REQUESTS = [
  { id: 'fallback-request-1', title: 'Submit allocation plan', text: 'Due Oct 24  Wait: Marketing', badge: 'High Priority', marker: 'good' },
  { id: 'fallback-request-2', title: 'Upload residency document', text: 'Due Oct 26  Wait: Legal', marker: 'neutral' },
  { id: 'fallback-request-3', title: 'Review TikTok Hub request', text: 'Due Oct 28  Wait: Ops', marker: 'neutral' },
]

const FALLBACK_ALERTS = [
  { id: 'fallback-alert-1', type: 'low_balance', severity: 'high', title: 'Google Ads UK balance is running low', action: 'Top up now' },
  { id: 'fallback-alert-2', type: 'account_setup', severity: 'medium', title: 'Meta Business setup requires residency documents', action: 'Upload docs' },
  { id: 'fallback-alert-3', type: 'approval', severity: 'medium', title: '2 budget approvals pending', action: 'Review' },
]

const FALLBACK_CAPITAL_FLOW = {
  spend: '$82,492',
  topups: '$96,000',
  net: '+$13,508',
  insight: 'Completed account funding is currently covering period spend.',
  series: [
    { label: 'Apr 4', soft: 64, strong: 102 },
    { label: 'Apr 5', soft: 82, strong: 118 },
    { label: 'Apr 6', soft: 74, strong: 96 },
    { label: 'Apr 7', soft: 88, strong: 110 },
    { label: 'Apr 8', soft: 58, strong: 72 },
    { label: 'Apr 9', soft: 96, strong: 128 },
  ],
}

const DEFAULT_MEDIA_PLAN = {
  status: 'Not connected',
  budgetRunway: 'No active plan',
  lastUpdated: 'Planning data unavailable',
  empty: true,
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

export default function OverviewPage() {
  const router = useRouter()
  const { tr } = useI18n()
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState(FALLBACK_METRICS)
  const [pendingSummary, setPendingSummary] = useState({ approvals: 0, funding: 0, documents: 0, total: 0 })
  const [accountsData, setAccountsData] = useState(FALLBACK_ACCOUNTS)
  const [accountTags, setAccountTags] = useState({ active: 24, warn: 4, pending: 2 })
  const [capitalFlow, setCapitalFlow] = useState(FALLBACK_CAPITAL_FLOW)
  const [activity, setActivity] = useState(FALLBACK_ACTIVITY)
  const [requests, setRequests] = useState(FALLBACK_REQUESTS)
  const [alerts, setAlerts] = useState(FALLBACK_ALERTS)
  const [mediaPlan, setMediaPlan] = useState(DEFAULT_MEDIA_PLAN)
  const [statusAlerts, setStatusAlerts] = useState(tr('2 Alerts', '2 уведомления'))
  const [statusRows, setStatusRows] = useState([
    { icon: '$', label: 'USD/KZT 471.2' },
    { icon: '€', label: 'EUR/USD 1.08' },
  ])
  const [fundingAccountId, setFundingAccountId] = useState(null)
  const [accountRequestOpen, setAccountRequestOpen] = useState(false)
  const [selectedAccountTab, setSelectedAccountTab] = useState('')
  const [refreshingAccountId, setRefreshingAccountId] = useState('')

  async function refreshAccountLiveBilling(accountId) {
    const id = String(accountId || '').trim()
    if (!id) {
      await loadOverview()
      return
    }
    const token = getAuthToken()
    if (!token) {
      router.replace('/login')
      return
    }
    try {
      setRefreshingAccountId(id)
      const res = await fetch(`/api/client/accounts/${encodeURIComponent(id)}/refresh-live-billing`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Refresh failed')
      await loadOverview()
    } finally {
      setRefreshingAccountId('')
    }
  }

  function handleOverviewAction(action, accountId) {
    const normalized = String(action || '').toLowerCase()
    if (normalized === 'top up now' && accountId) {
      openFundingModal(accountId)
      return
    }
    if (normalized === 'refresh') {
      refreshAccountLiveBilling(accountId)
      return
    }
    if (normalized === 'review' || normalized === 'open request' || normalized === 'upload docs') {
      router.push('/funds')
      return
    }
    if (normalized === 'open') {
      router.push('/funds')
      return
    }
    router.push('/funds')
  }

  async function loadOverview() {
    const token = getAuthToken()
    if (!token) {
      router.replace('/login')
      return
    }

    try {
      const res = await fetch('/api/client/overview', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error(tr('Failed to load overview', 'Не удалось загрузить overview'))
      const payload = await res.json()
      if (Array.isArray(payload.metrics) && payload.metrics.length) setMetrics(payload.metrics)
      if (payload.pending) setPendingSummary(payload.pending)
      if (Array.isArray(payload.accounts) && payload.accounts.length) setAccountsData(payload.accounts)
      if (payload.accountTags) setAccountTags(payload.accountTags)
      if (payload.capitalFlow) setCapitalFlow(payload.capitalFlow)
      if (Array.isArray(payload.activity) && payload.activity.length) setActivity(payload.activity)
      if (Array.isArray(payload.requests) && payload.requests.length) setRequests(payload.requests)
      if (Array.isArray(payload.alerts) && payload.alerts.length) setAlerts(payload.alerts)
      if (payload.mediaPlan) setMediaPlan(payload.mediaPlan)
      if (payload.statusAlerts) setStatusAlerts(payload.statusAlerts)
      if (Array.isArray(payload.statusRows) && payload.statusRows.length) setStatusRows(payload.statusRows)
    } catch {
      // Keep fallback content if normalized backend is unavailable.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOverview()
  }, [router])

  const pendingHint = useMemo(() => {
    const parts = []
    if (pendingSummary.approvals) parts.push(`${pendingSummary.approvals} ${tr('approvals', 'согласований')}`)
    if (pendingSummary.funding) parts.push(`${pendingSummary.funding} ${tr('funding', 'пополнений')}`)
    if (pendingSummary.documents) parts.push(`${pendingSummary.documents} ${tr('docs', 'документов')}`)
    return parts.join(' · ') || tr('No client actions pending', 'Нет ожидающих действий клиента')
  }, [pendingSummary, tr])

  const displayMetrics = useMemo(
    () =>
      metrics.map((card) =>
        card.label === 'Pending Items'
          ? {
              ...card,
              hint: pendingHint,
            }
          : card
      ),
    [metrics, pendingHint]
  )

  const dedupedAccounts = useMemo(() => {
    const seen = new Set()
    const result = []
    for (const row of accountsData || []) {
      const idKey = row?.accountId != null ? `id:${row.accountId}` : ''
      const fallbackKey = `${String(row?.account || '').toLowerCase().trim()}::${String(row?.platform || '').toLowerCase().trim()}`
      const key = idKey || fallbackKey
      if (!key || seen.has(key)) continue
      seen.add(key)
      result.push(row)
    }
    return result
  }, [accountsData])

  const accountTabs = useMemo(() => {
    const seen = new Set()
    return dedupedAccounts
      .map((row) => {
        const label = String(row?.account || '').trim()
        if (!label) return null
        return { id: label.toLowerCase(), label }
      })
      .filter(Boolean)
      .filter((item) => {
        const key = item.id
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
  }, [dedupedAccounts])

  const visibleAccounts = useMemo(() => {
    if (!selectedAccountTab) return []
    return dedupedAccounts.filter((row) => String(row?.account || '').trim().toLowerCase() === selectedAccountTab)
  }, [dedupedAccounts, selectedAccountTab])

  useEffect(() => {
    if (!accountTabs.length) {
      setSelectedAccountTab('')
      return
    }
    if (!selectedAccountTab || !accountTabs.some((tab) => tab.id === selectedAccountTab)) {
      setSelectedAccountTab(accountTabs[0].id)
    }
  }, [accountTabs, selectedAccountTab])

  function openFundingModal(accountId) {
    if (!accountId) return
    setFundingAccountId(String(accountId))
  }

  function openAccountDashboard(accountId) {
    if (accountId) {
      router.push(`/performance?account_id=${encodeURIComponent(String(accountId))}`)
      return
    }
    router.push('/performance')
  }

  return (
    <ClientShell
      activeNav="overview"
      pageTitle={tr('Overview', 'Обзор')}
      pageSubtitle={tr('Track your balances, account status, approvals and media plan progress.', 'Отслеживайте балансы, статусы аккаунтов, согласования и прогресс медиаплана.')}
      pageActionLabel={tr('Request Account', 'Запросить аккаунт')}
      pageActionOnClick={() => setAccountRequestOpen(true)}
      headerActionLabel={tr('Create Request', 'Создать запрос')}
      headerActionOnClick={() => setAccountRequestOpen(true)}
      entityLabel={tr('Entity Switcher', 'Переключатель юрлица')}
      statusAlerts={loading ? tr('Loading…', 'Загрузка…') : statusAlerts}
      statusRows={statusRows}
    >
      <section className={styles.cardGrid4}>
        {displayMetrics.map((card) => (
          <MetricCard card={card} key={card.label} />
        ))}
      </section>

      <section className={styles.sectionCard} id="accounts-overview">
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>{tr('Ad Accounts Overview', 'Обзор рекламных аккаунтов')}</h3>
            <div className={styles.tagRow}>
              <span className={styles.tag}>{accountTags.active} {tr('Active', 'Активны')}</span>
              <span className={styles.tagDanger}>{accountTags.warn} {tr('Need Attention', 'Требуют внимания')}</span>
              <span className={styles.tagMuted}>{accountTags.pending} {tr('Setup Pending', 'Ожидают настройки')}</span>
            </div>
          </div>
          <div className={styles.headerControls}>
            <button className={styles.headerPrimaryAction} onClick={() => setAccountRequestOpen(true)} type="button">
              {tr('New Account Request', 'Новый запрос на аккаунт')}
            </button>
            <Link className={styles.outlinedAction} href="/funds">
              {tr('View All Accounts', 'Все аккаунты')}
            </Link>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <div className={styles.accountTabsRow}>
            {accountTabs.map((tab) => (
              <button
                className={selectedAccountTab === tab.id ? styles.accountTabActive : styles.accountTab}
                key={tab.id}
                onClick={() => setSelectedAccountTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <table className={styles.table}>
            <colgroup>
              <col style={{ width: '28%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>{tr('Account', 'Аккаунт')}</th>
                <th>{tr('Platform', 'Платформа')}</th>
                <th>{tr('Status', 'Статус')}</th>
                <th>{tr('Balance', 'Баланс')}</th>
                <th>{tr('Spend', 'Расход')}</th>
                <th>{tr('Note', 'Комментарий')}</th>
                <th>{tr('Action', 'Действие')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleAccounts.map((row, index) => (
                <tr key={row.accountId || `${row.account || 'account'}-${row.platform || 'platform'}-${index}`}>
                  <td className={styles.accountCell}>
                    <span className={`${styles.tableStrong} ${styles.accountName}`}>{row.account}</span>
                  </td>
                  <td>
                    <span className={styles.tableSubtle}>{row.platform}</span>
                  </td>
                  <td>
                    <span className={row.status === 'Active' ? styles.statusChip : styles.statusChipMuted}>{row.status}</span>
                  </td>
                  <td>
                    <span className={styles.tableStrong}>{row.balance}</span>
                    <span className={styles.tableSubtle}>{row.balanceSourceLabel || ''}</span>
                  </td>
                  <td>
                    <span className={styles.tableSubtle}>{row.spend}</span>
                  </td>
                  <td>
                    <span
                      className={
                        row.noteTone === 'good'
                          ? styles.noteGood
                          : row.noteTone === 'neutral'
                            ? styles.tableSubtle
                            : styles.noteWarn
                      }
                    >
                      {row.note}
                    </span>
                  </td>
                  <td>
                    <div className={styles.accountActions}>
                      <button
                        className={styles.accountIconButton}
                        disabled={!row.accountId}
                        onClick={() => openFundingModal(row.accountId)}
                        title={tr('Top up account', 'Пополнить аккаунт')}
                        type="button"
                      >
                        ₸
                      </button>
                      <button
                        className={styles.accountIconButton}
                        onClick={() => openAccountDashboard(row.accountId)}
                        title={tr('Open dashboard', 'Открыть дашборд')}
                        type="button"
                      >
                        □
                      </button>
                      <button
                        className={styles.accountIconButton}
                        disabled={!row.accountId || refreshingAccountId === String(row.accountId)}
                        onClick={() => handleOverviewAction('refresh', row.accountId)}
                        title={tr('Refresh budgets', 'Обновить бюджеты')}
                        type="button"
                      >
                        {refreshingAccountId === String(row.accountId) ? '…' : '↻'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.overviewGrid}>
        <article className={`${styles.sectionCard} ${styles.chartCard}`}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>{tr('Spend vs Completed Funding', 'Расход vs Завершенные пополнения')}</h3>
              <p className={styles.chartInsight}>{capitalFlow.insight}</p>
            </div>
            <div className={styles.outlinedAction}>{tr('Last 30 Days', 'Последние 30 дней')}</div>
          </div>

          <div className={styles.chartMetrics}>
            <div className={styles.chartMetric}>
              <span>{tr('Spend', 'Расход')}</span>
              <strong>{capitalFlow.spend}</strong>
            </div>
            <div className={styles.chartMetric}>
              <span>{tr('Top-ups', 'Пополнения')}</span>
              <strong>{capitalFlow.topups}</strong>
            </div>
            <div className={styles.chartMetric}>
              <span>{tr('Net Flow', 'Чистый поток')}</span>
              <strong>{capitalFlow.net}</strong>
            </div>
          </div>

          <div className={styles.bars}>
            {capitalFlow.series.map((bar, index) => (
              <div className={styles.barPair} key={`${bar.date || 'bar'}-${index}`}>
                <div className={styles.barColumns}>
                  <div className={styles.barSoft} style={{ height: `${bar.soft}px` }} />
                  <div className={styles.barStrong} style={{ height: `${bar.strong}px` }} />
                </div>
                <span className={styles.barLabel}>{bar.label || `P${index + 1}`}</span>
              </div>
            ))}
          </div>

          {capitalFlow.topups === '$0' ? (
            <div className={styles.chartEmptyNote}>
              No completed account funding was recorded during this period. Blue bars show spend only.
              
            </div>
          ) : null}

          <div className={styles.chartLegend}>
            <span>
              <span className={styles.legendDotSoft} />
              {tr('Completed Funding', 'Завершенные пополнения')}
            </span>
            <span>
              <span className={styles.legendDot} />
              {tr('Spend', 'Расход')}
            </span>
          </div>
        </article>

        <div className={styles.rightStack}>
          <article className={styles.smallCard}>
            <h3 className={styles.smallTitle}>{tr('Current Media Plan', 'Текущий медиаплан')}</h3>
            <div className={styles.detailList}>
              <div className={styles.detailRow}>
                <span>{tr('Status', 'Статус')}</span>
                <strong>{mediaPlan.status}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>{tr('Budget runway', 'Запас бюджета')}</span>
                <strong>{mediaPlan.budgetRunway}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>{tr('Last updated', 'Последнее обновление')}</span>
                <strong>{mediaPlan.lastUpdated}</strong>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <Link className={styles.outlinedAction} href="/plan">
                {mediaPlan.empty ? tr('Create Plan', 'Создать план') : tr('View Plan', 'Открыть план')}
              </Link>
            </div>
          </article>

          <article className={styles.smallCard}>
            <h3 className={styles.smallTitle}>{tr('Important Alerts', 'Важные уведомления')}</h3>
            <div className={styles.alertList}>
              {alerts.map((item) => (
                <div className={styles.alertItem} key={item.id || item.title}>
                  <strong>{item.title}</strong>
                  {item.action === 'Top up now' && item.accountId ? (
                    <button className={styles.inlineActionButton} onClick={() => openFundingModal(item.accountId)} type="button">
                      {item.action}
                    </button>
                  ) : (
                    <button className={styles.inlineActionButton} onClick={() => handleOverviewAction(item.action, item.accountId)} type="button">
                      {item.action}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>{tr('Recent Activity', 'Недавняя активность')}</h3>
            </div>
          </div>
          <div className={styles.feedList}>
            {activity.map((item, index) => (
              <div className={styles.feedItem} key={item.id || `${item.title || 'activity'}-${item.time || 'time'}-${index}`}>
                <div className={styles.feedTop}>
                  <span
                    className={`${styles.feedMarker} ${
                      item.tone === 'good'
                        ? styles.feedMarkerGood
                        : item.tone === 'info'
                          ? styles.feedMarkerInfo
                          : styles.feedMarkerWarn
                    }`}
                  />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                    <span>{item.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div>
              <h3 className={styles.sectionTitle}>{tr('Pending Requests', 'Ожидающие запросы')}</h3>
            </div>
            <Link className={styles.linkAction} href="#">
              {tr('View All', 'Смотреть все')}
            </Link>
          </div>
          <div className={styles.requestList}>
            {requests.map((item) => (
              <div className={styles.requestItem} key={item.id || `${item.title}-${item.text}`}>
                <div className={styles.requestTop}>
                  <span
                    className={`${styles.requestMarker} ${
                      item.marker === 'good'
                        ? styles.requestMarkerGood
                        : item.marker === 'warn'
                          ? styles.requestMarkerWarn
                          : styles.requestMarkerNeutral
                    }`}
                  />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                  {item.badge ? <span className={`${styles.requestBadge} ${styles.requestBadgeDanger}`}>{item.badge}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <FundingModal
        accountId={fundingAccountId}
        onClose={() => setFundingAccountId(null)}
        onSubmitted={loadOverview}
        open={Boolean(fundingAccountId)}
      />
      <AccountRequestModal
        onClose={() => setAccountRequestOpen(false)}
        onSubmitted={loadOverview}
        open={accountRequestOpen}
      />
    </ClientShell>
  )
}
