'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import ClientShell from './ClientShell'
import styles from './client.module.css'
import { getAuthToken } from '../../lib/auth'
import { useI18n } from '../../lib/i18n/client'

const FALLBACK_FILTERS = {
  selectedPreset: 30,
  selectedPlatform: 'all',
  selectedAccountId: '',
  presets: [
    { value: 7, label: 'Last 7 Days' },
    { value: 30, label: 'Last 30 Days' },
    { value: 90, label: 'Last 90 Days' },
  ],
  platforms: [
    { value: 'all', label: 'All Platforms' },
    { value: 'google', label: 'Google Ads' },
    { value: 'meta', label: 'Meta' },
    { value: 'tiktok', label: 'TikTok Ads' },
  ],
  accounts: [{ value: '', label: 'All Accounts' }],
}

function MetricCard({ card }) {
  const hintClass =
    card.tone === 'good'
      ? `${styles.metricHint} ${styles.metricHintGood}`
      : card.tone === 'warn'
        ? `${styles.metricHint} ${styles.metricHintWarn}`
        : styles.metricHint

  return (
    <article className={`${styles.metricCard} ${styles.performanceMetricCard}`}>
      <p className={styles.metricLabel}>{card.label}</p>
      <p className={styles.metricValue}>{card.value}</p>
      <div className={hintClass}>{card.hint}</div>
    </article>
  )
}

function SparkBars({ values = [] }) {
  const max = Math.max(...values, 1)
  return (
    <div className={styles.sparkBars}>
      {values.map((value, index) => (
        <span
          key={`${index}-${value}`}
          className={styles.sparkBar}
          style={{ height: `${Math.max(20, Math.round((Number(value || 0) / max) * 100))}%` }}
        />
      ))}
    </div>
  )
}

function OperationalPulse({ pulse, tr }) {
  const [metric, setMetric] = useState('spend')
  const series = Array.isArray(pulse?.series) ? pulse.series : []
  const maxMetric = Math.max(...series.map((item) => Number(item?.[metric] || 0)), 1)
  const maxCtr = Math.max(...series.map((item) => Number(item?.ctr || 0)), 1)
  const points = series
    .map((item, index) => {
      const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 100
      const y = 100 - (Number(item?.ctr || 0) / maxCtr) * 100
      return `${x},${Math.max(0, Math.min(100, y))}`
    })
    .join(' ')

  return (
    <article className={`${styles.sectionCard} ${styles.performancePulseCard}`}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>{tr('Operational Pulse', 'Операционный пульс')}</h3>
        </div>
        <div className={styles.segmentTabs}>
          {[
            { key: 'spend', label: tr('Spend', 'Расход') },
            { key: 'impressions', label: tr('Impressions', 'Показы') },
            { key: 'clicks', label: tr('Clicks', 'Клики') },
            { key: 'ctr', label: 'CTR' },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={metric === item.key ? styles.segmentTabActive : styles.segmentTab}
              onClick={() => setMetric(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.performancePulseInner}>
        <div className={styles.pulseChart}>
          <div className={styles.pulseBars} style={{ gridTemplateColumns: `repeat(${Math.max(series.length, 1)}, minmax(0, 1fr))` }}>
            {series.map((item) => (
              <div key={item.label} className={styles.pulseBarItem}>
                <div className={styles.pulseBarTrack}>
                  <div
                    className={styles.pulseBar}
                    style={{ height: `${Math.max(14, Math.round((Number(item?.[metric] || 0) / maxMetric) * 100))}%` }}
                  />
                </div>
                <span className={styles.pulseLabel}>{item.label}</span>
              </div>
            ))}
          </div>
          <svg className={styles.pulseLine} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={points} />
          </svg>
        </div>
        <div className={styles.performanceInsight}>{pulse?.insight}</div>
      </div>
    </article>
  )
}

function csvCell(value) {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export default function PerformancePage({ initialAccountId = '' }) {
  const router = useRouter()
  const { tr } = useI18n()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState(FALLBACK_FILTERS)
  const [selectedPreset, setSelectedPreset] = useState(30)
  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [allAccounts, setAllAccounts] = useState([])
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')
  const [customRangeActive, setCustomRangeActive] = useState(false)
  const [metrics, setMetrics] = useState([])
  const [pulse, setPulse] = useState({ insight: '', series: [] })
  const [rows, setRows] = useState([])
  const [topMovers, setTopMovers] = useState([])
  const [attentionAreas, setAttentionAreas] = useState([])
  const [statusRows, setStatusRows] = useState([
    { icon: '$', label: 'USD/KZT 471.2' },
    { icon: '△', label: 'Live dashboard sync' },
  ])
  const [loadError, setLoadError] = useState('')
  const loadSeqRef = useRef(0)

  function toIsoDate(date) {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function accountIdFromUrl() {
    if (typeof window === 'undefined') return ''
    return String(new URLSearchParams(window.location.search).get('account_id') || '')
  }

  function buildSyncRange({ days, dateFrom, dateTo, useCustom }) {
    if (useCustom && dateFrom && dateTo) {
      return {
        date_from: dateFrom,
        date_to: dateTo,
      }
    }
    const to = new Date()
    to.setHours(0, 0, 0, 0)
    const from = new Date(to)
    from.setDate(from.getDate() - (Math.max(1, Number(days || 30)) - 1))
    return {
      date_from: toIsoDate(from),
      date_to: toIsoDate(to),
    }
  }

  async function loadPerformance(next = {}) {
    const seq = loadSeqRef.current + 1
    loadSeqRef.current = seq
    const token = getAuthToken()
    if (!token) {
      router.replace('/login')
      return
    }

    const accountIdFromQuery = initialAccountId || accountIdFromUrl()
    const preset = next.preset ?? selectedPreset
    const platform = next.platform ?? selectedPlatform
    const accountId =
      next.accountId ?? (selectedAccountId ? selectedAccountId : accountIdFromQuery)
    const dateFrom = Object.prototype.hasOwnProperty.call(next, 'dateFrom') ? next.dateFrom : customDateFrom
    const dateTo = Object.prototype.hasOwnProperty.call(next, 'dateTo') ? next.dateTo : customDateTo
    const useCustom = Object.prototype.hasOwnProperty.call(next, 'useCustom') ? next.useCustom : customRangeActive

    try {
      setLoading(true)
      setLoadError('')
      const params = new URLSearchParams()
      params.set('preset', String(preset))
      if (platform) params.set('platform', platform)
      if (accountId) params.set('account_id', accountId)
      if (useCustom && dateFrom && dateTo) {
        params.set('date_from', dateFrom)
        params.set('date_to', dateTo)
      }

      const res = await fetch(`/api/client/performance?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })

      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error(tr('Failed to load performance', 'Не удалось загрузить перфоманс'))
      const payload = await res.json()
      if (seq !== loadSeqRef.current) return
      if (payload.filters) {
        setFilters(payload.filters)
        setSelectedPreset(Number(payload.filters.selectedPreset || preset))
        setSelectedPlatform(payload.filters.selectedPlatform || platform)
        setSelectedAccountId(payload.filters.selectedAccountId || accountId)
        if (Array.isArray(payload.filters.accountsAll)) {
          setAllAccounts(payload.filters.accountsAll)
        }
        setCustomRangeActive(Boolean(payload.filters.customRange))
        if (payload.filters.customRange) {
          setCustomDateFrom(payload.filters.selectedDateFrom || dateFrom || '')
          setCustomDateTo(payload.filters.selectedDateTo || dateTo || '')
        } else {
          setCustomDateFrom('')
          setCustomDateTo('')
        }
      }
      setMetrics(Array.isArray(payload.metrics) ? payload.metrics : [])
      setPulse(payload.pulse || { insight: '', series: [] })
      setRows(Array.isArray(payload.platformRows) ? payload.platformRows : [])
      setTopMovers(Array.isArray(payload.topMovers) ? payload.topMovers : [])
      setAttentionAreas(Array.isArray(payload.attentionAreas) ? payload.attentionAreas : [])
    } catch {
      if (seq !== loadSeqRef.current) return
      setLoadError(tr('Failed to load performance data. Please refresh or contact support.', 'Не удалось загрузить данные перфоманса. Обновите страницу или обратитесь в поддержку.'))
    } finally {
      if (seq !== loadSeqRef.current) return
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPerformance({ accountId: initialAccountId || accountIdFromUrl() })
  }, [router, initialAccountId])

  async function refreshPerformanceStats() {
    if (refreshing) return
    const token = getAuthToken()
    if (!token) {
      router.replace('/login')
      return
    }

    try {
      setRefreshing(true)
      const range = buildSyncRange({
        days: selectedPreset,
        dateFrom: customDateFrom,
        dateTo: customDateTo,
        useCustom: customRangeActive,
      })
      const res = await fetch('/api/client/account-finance/sync', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...range,
          account_id: selectedAccountId && Number.isFinite(Number(selectedAccountId)) ? Number(selectedAccountId) : undefined,
          refresh_live_billing: 1,
        }),
      })
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok && res.status !== 401) {
        const payload = await res.json().catch(() => ({}))
        setLoadError(payload?.detail || tr('Failed to sync performance statistics.', 'Не удалось синхронизировать статистику перфоманса.'))
        return
      }
      await loadPerformance({
        useCustom: customRangeActive,
      })
    } finally {
      setRefreshing(false)
    }
  }

  function applyCustomRange() {
    if (!customDateFrom || !customDateTo) {
      setLoadError(tr('Select both dates to apply a custom range.', 'Выберите обе даты, чтобы применить произвольный диапазон.'))
      return
    }
    if (customDateFrom > customDateTo) {
      setLoadError(tr('Start date must be earlier than end date.', 'Дата начала должна быть раньше даты окончания.'))
      return
    }
    loadPerformance({
      dateFrom: customDateFrom,
      dateTo: customDateTo,
      useCustom: true,
    })
  }

  function clearCustomRange() {
    setCustomDateFrom('')
    setCustomDateTo('')
    setCustomRangeActive(false)
    loadPerformance({ useCustom: false, dateFrom: '', dateTo: '' })
  }

  function exportPerformanceRows() {
    if (!rows.length) return
    const header = ['Platform', 'Account', 'Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'CPM']
    const lines = [
      header,
      ...rows.map((row) => [
        row.platform,
        row.account,
        row.spend,
        row.impressions,
        row.clicks,
        row.ctr,
        row.cpc,
        row.cpm,
      ]),
    ]
    const csv = `\uFEFF${lines.map((line) => line.map(csvCell).join(',')).join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `performance-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }

  const accountOptions = useMemo(() => {
    if (Array.isArray(allAccounts) && allAccounts.length) {
      const scoped = allAccounts.filter((item) =>
        selectedPlatform === 'all' ? true : String(item?.platform || '').toLowerCase() === selectedPlatform
      )
      return [{ value: '', label: 'All Accounts' }, ...scoped.map((item) => ({ value: item.value, label: item.label }))]
    }
    return filters.accounts || FALLBACK_FILTERS.accounts
  }, [allAccounts, selectedPlatform, filters.accounts])

  return (
    <ClientShell
      activeNav="performance"
      pageTitle={tr('Performance Dashboard', 'Перфоманс дашборд')}
      pageSubtitle={tr('Track delivery, spend and platform performance across your advertising accounts.', 'Отслеживайте доставку, расход и эффективность платформ по вашим рекламным аккаунтам.')}
      headerActionLabel=""
      statusAlerts={loading ? tr('Syncing…', 'Синхронизация…') : tr('Live', 'Live')}
      statusRows={statusRows}
    >
      {loadError ? <div className={styles.pageErrorBanner}>{loadError}</div> : null}
      <section className={styles.performanceToolbar}>
        <div className={styles.performanceFilters}>
          <select
            className={styles.performanceSelect}
            value={selectedPreset}
            onChange={(event) => {
              const value = Number(event.target.value)
              setSelectedPreset(value)
              setCustomRangeActive(false)
              loadPerformance({ preset: value, useCustom: false, dateFrom: '', dateTo: '' })
            }}
          >
            {(filters.presets || []).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className={styles.performanceSelect}
            value={selectedPlatform}
            onChange={(event) => {
              const value = event.target.value
              setSelectedPlatform(value)
              setSelectedAccountId('')
              loadPerformance({ platform: value, accountId: '', useCustom: customRangeActive })
            }}
          >
            {(filters.platforms || []).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            className={styles.performanceSelect}
            value={selectedAccountId}
            onChange={(event) => {
              const value = event.target.value
              setSelectedAccountId(value)
              loadPerformance({ accountId: value, useCustom: customRangeActive })
            }}
          >
            {accountOptions.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button className={`${styles.performanceGhostButton} ${styles.performancePresetButton}`} type="button">
            {tr('Preset: Performance', 'Пресет: Перфоманс')}
          </button>
          <div className={styles.dateRangeControls}>
            <input
              className={styles.dateInput}
              type="date"
              value={customDateFrom}
              onChange={(event) => setCustomDateFrom(event.target.value)}
              max={customDateTo || undefined}
              aria-label={tr('Date from', 'Дата с')}
              title={tr('Date from', 'Дата с')}
            />
            <input
              className={styles.dateInput}
              type="date"
              value={customDateTo}
              onChange={(event) => setCustomDateTo(event.target.value)}
              min={customDateFrom || undefined}
              aria-label={tr('Date to', 'Дата по')}
              title={tr('Date to', 'Дата по')}
            />
            <button className={styles.dateApplyButton} type="button" onClick={applyCustomRange}>
              {tr('Apply', 'Применить')}
            </button>
            <button className={styles.dateResetButton} type="button" onClick={clearCustomRange}>
              {tr('Reset', 'Сброс')}
            </button>
          </div>
        </div>
        <div className={styles.performanceActions}>
          <button className={styles.performanceGhostButton} type="button" onClick={exportPerformanceRows} disabled={!rows.length}>
            {tr('Export', 'Экспорт')}
          </button>
          <button
            className={styles.performanceIconButton}
            type="button"
            onClick={refreshPerformanceStats}
            aria-label="Refresh"
            disabled={loading || refreshing}
            title={refreshing ? tr('Refreshing statistics…', 'Обновляем статистику…') : tr('Refresh statistics', 'Обновить статистику')}
          >
            {refreshing ? '…' : '↻'}
          </button>
        </div>
      </section>

      <section className={styles.cardGrid4}>
        {metrics.map((card) => (
          <MetricCard key={card.label} card={card} />
        ))}
      </section>

      <OperationalPulse pulse={pulse} tr={tr} />

      <section className={`${styles.sectionCard} ${styles.performanceTableCard}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>{tr('Platform Performance', 'Эффективность платформ')}</h3>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{tr('Platform / Account', 'Платформа / Аккаунт')}</th>
                <th>{tr('Spend', 'Расход')}</th>
                <th>{tr('Impressions', 'Показы')}</th>
                <th>{tr('Clicks', 'Клики')}</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>CPM</th>
                <th>{tr('Trend', 'Тренд')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.accountCell}>
                      <span className={`${styles.tableStrong} ${styles.accountName}`}>{row.account}</span>
                      <span className={styles.tableSubtle}>{row.platform}</span>
                    </td>
                    <td><span className={styles.tableStrong}>{row.spend}</span></td>
                    <td>{row.impressions}</td>
                    <td>{row.clicks}</td>
                    <td>{row.ctr}</td>
                    <td>{row.cpc}</td>
                    <td>{row.cpm}</td>
                    <td><SparkBars values={row.trend} /></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className={styles.performanceEmptyCell}>{tr('No performance rows for the selected filter.', 'Нет строк перфоманса для выбранного фильтра.')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.performanceBottomGrid}>
        <article className={styles.smallCard}>
          <h3 className={styles.smallTitle}>{tr('Top Movers', 'Топ драйверы')}</h3>
          <div className={styles.performanceSignalList}>
            {topMovers.length ? (
              topMovers.map((item) => (
                <div key={`${item.title}-${item.subtitle}`} className={styles.performanceSignalItem}>
                  <div>
                    <p className={styles.performanceSignalLabel}>{item.subtitle}</p>
                    <strong>{item.title}</strong>
                    <span>{item.hint}</span>
                  </div>
                  <div className={item.tone === 'good' ? styles.performanceSignalValueGood : styles.performanceSignalValueWarn}>
                    {item.value}
                  </div>
                </div>
              ))
            ) : (
              <p className={styles.performanceMuted}>{tr('No standout movement detected for the current filter.', 'Для текущего фильтра заметных отклонений не найдено.')}</p>
            )}
          </div>
        </article>

        <article className={styles.smallCard}>
          <h3 className={styles.smallTitle}>{tr('Attention Areas', 'Зоны внимания')}</h3>
          <div className={styles.performanceSignalList}>
            {attentionAreas.length ? (
              attentionAreas.map((item) => (
                <div key={`${item.title}-${item.text}`} className={styles.performanceAlertItem}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                  <button type="button" className={styles.inlineActionButton} onClick={() => router.push('/funds')}>
                    {item.action}
                  </button>
                </div>
              ))
            ) : (
              <p className={styles.performanceMuted}>{tr('No immediate issues detected in the selected window.', 'В выбранном периоде срочных проблем не обнаружено.')}</p>
            )}
          </div>
        </article>
      </section>
    </ClientShell>
  )
}
