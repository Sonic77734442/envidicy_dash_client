'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import ClientShell from './ClientShell'
import styles from './client.module.css'
import { getAuthToken } from '../../lib/auth'

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

const FALLBACK_METRICS = [
  { label: 'Spend', value: '$82,492', hint: '+8.4%', tone: 'good' },
  { label: 'Impressions', value: '12.4M', hint: '-2.1%', tone: 'warn' },
  { label: 'Clicks', value: '342k', hint: '+12.4%', tone: 'good' },
  { label: 'CTR', value: '2.75%', hint: '+0.4%', tone: 'good' },
]

const FALLBACK_PULSE = {
  insight: 'Google spend rose 18% while CTR declined 6%. TikTok delivered the highest click volume in the current period.',
  series: [
    { label: 'Oct 1', spend: 2800, impressions: 82000, clicks: 2400, ctr: 2.1 },
    { label: 'Oct 4', spend: 4100, impressions: 98000, clicks: 3200, ctr: 2.6 },
    { label: 'Oct 7', spend: 3700, impressions: 103000, clicks: 3500, ctr: 2.4 },
    { label: 'Oct 10', spend: 5200, impressions: 121000, clicks: 3900, ctr: 2.8 },
    { label: 'Oct 13', spend: 6100, impressions: 132000, clicks: 4200, ctr: 3.1 },
    { label: 'Oct 16', spend: 4900, impressions: 127000, clicks: 4050, ctr: 2.9 },
    { label: 'Oct 19', spend: 6800, impressions: 149000, clicks: 4600, ctr: 3.2 },
    { label: 'Oct 22', spend: 5400, impressions: 139000, clicks: 4300, ctr: 3.0 },
    { label: 'Oct 25', spend: 4100, impressions: 120000, clicks: 3600, ctr: 2.7 },
    { label: 'Oct 29', spend: 3100, impressions: 96000, clicks: 2800, ctr: 2.3 },
  ],
}

const FALLBACK_ROWS = [
  {
    id: 'google-1',
    platform: 'Google Ads',
    account: 'Google Ads UK',
    spend: '$42,810',
    impressions: '5.2M',
    clicks: '124k',
    ctr: '2.38%',
    cpc: '$0.34',
    cpm: '$8.23',
    trend: [12, 16, 17, 18, 24, 28],
  },
  {
    id: 'meta-1',
    platform: 'Meta Business',
    account: 'Meta Business',
    spend: '$28,150',
    impressions: '4.8M',
    clicks: '158k',
    ctr: '3.29%',
    cpc: '$0.18',
    cpm: '$5.86',
    trend: [10, 12, 14, 13, 17, 18],
  },
]

const FALLBACK_MOVERS = [
  { title: 'Meta Retargeting', subtitle: 'CTR growth', value: '+24.5%', hint: 'vs last window', tone: 'good' },
  { title: 'TikTok Prospecting', subtitle: 'Spend jump', value: '+$4.2k', hint: 'vs last window', tone: 'good' },
]

const FALLBACK_ATTENTION = [
  { title: 'Inefficient Spend', text: 'Spend up 40%, clicks down 12% in Google Search.', action: 'Review' },
  { title: 'Zero Delivery', text: '4 ad sets in Meta Business have zero impressions today.', action: 'Review' },
]

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

function OperationalPulse({ pulse }) {
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
          <h3 className={styles.sectionTitle}>Operational Pulse</h3>
        </div>
        <div className={styles.segmentTabs}>
          {[
            { key: 'spend', label: 'Spend' },
            { key: 'impressions', label: 'Impressions' },
            { key: 'clicks', label: 'Clicks' },
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

export default function PerformancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(FALLBACK_FILTERS)
  const [selectedPreset, setSelectedPreset] = useState(30)
  const [selectedPlatform, setSelectedPlatform] = useState('all')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [metrics, setMetrics] = useState(FALLBACK_METRICS)
  const [pulse, setPulse] = useState(FALLBACK_PULSE)
  const [rows, setRows] = useState(FALLBACK_ROWS)
  const [topMovers, setTopMovers] = useState(FALLBACK_MOVERS)
  const [attentionAreas, setAttentionAreas] = useState(FALLBACK_ATTENTION)
  const [statusRows, setStatusRows] = useState([
    { icon: '$', label: 'USD/KZT 471.2' },
    { icon: '△', label: 'Live dashboard sync' },
  ])

  async function loadPerformance(next = {}) {
    const token = getAuthToken()
    if (!token) {
      router.replace('/login')
      return
    }

    const preset = next.preset ?? selectedPreset
    const platform = next.platform ?? selectedPlatform
    const accountId = next.accountId ?? selectedAccountId

    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('preset', String(preset))
      if (platform) params.set('platform', platform)
      if (accountId) params.set('account_id', accountId)

      const res = await fetch(`/api/client/performance?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })

      if (res.status === 401) {
        router.replace('/login')
        return
      }
      if (!res.ok) throw new Error('Failed to load performance')
      const payload = await res.json()
      if (payload.filters) {
        setFilters(payload.filters)
        setSelectedPreset(Number(payload.filters.selectedPreset || preset))
        setSelectedPlatform(payload.filters.selectedPlatform || platform)
        setSelectedAccountId(payload.filters.selectedAccountId || accountId)
      }
      if (Array.isArray(payload.metrics) && payload.metrics.length) setMetrics(payload.metrics)
      if (payload.pulse) setPulse(payload.pulse)
      if (Array.isArray(payload.platformRows) && payload.platformRows.length) setRows(payload.platformRows)
      else setRows([])
      if (Array.isArray(payload.topMovers) && payload.topMovers.length) setTopMovers(payload.topMovers)
      else setTopMovers([])
      if (Array.isArray(payload.attentionAreas) && payload.attentionAreas.length) setAttentionAreas(payload.attentionAreas)
      else setAttentionAreas([])
    } catch {
      // Keep fallback content.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPerformance()
  }, [router])

  const accountOptions = useMemo(() => filters.accounts || FALLBACK_FILTERS.accounts, [filters.accounts])

  return (
    <ClientShell
      activeNav="performance"
      pageTitle="Performance Dashboard"
      pageSubtitle="Track delivery, spend and platform performance across your advertising accounts."
      headerActionLabel=""
      statusAlerts={loading ? 'Syncing…' : 'Live'}
      statusRows={statusRows}
    >
      <section className={styles.performanceToolbar}>
        <div className={styles.performanceFilters}>
          <select
            className={styles.performanceSelect}
            value={selectedPreset}
            onChange={(event) => {
              const value = Number(event.target.value)
              setSelectedPreset(value)
              loadPerformance({ preset: value })
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
              loadPerformance({ platform: value, accountId: '' })
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
              loadPerformance({ accountId: value })
            }}
          >
            {accountOptions.map((item) => (
              <option key={item.value || 'all'} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <button className={`${styles.performanceGhostButton} ${styles.performancePresetButton}`} type="button">
            Preset: Performance
          </button>
        </div>
        <div className={styles.performanceActions}>
          <button className={styles.performanceGhostButton} type="button">
            Export
          </button>
          <button className={styles.performanceIconButton} type="button" onClick={() => loadPerformance()} aria-label="Refresh">
            ↻
          </button>
        </div>
      </section>

      <section className={styles.cardGrid4}>
        {metrics.map((card) => (
          <MetricCard key={card.label} card={card} />
        ))}
      </section>

      <OperationalPulse pulse={pulse} />

      <section className={`${styles.sectionCard} ${styles.performanceTableCard}`}>
        <div className={styles.sectionHeader}>
          <div>
            <h3 className={styles.sectionTitle}>Platform Performance</h3>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Platform / Account</th>
                <th>Spend</th>
                <th>Impressions</th>
                <th>Clicks</th>
                <th>CTR</th>
                <th>CPC</th>
                <th>CPM</th>
                <th>Trend</th>
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
                  <td colSpan={8} className={styles.performanceEmptyCell}>No performance rows for the selected filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.performanceBottomGrid}>
        <article className={styles.smallCard}>
          <h3 className={styles.smallTitle}>Top Movers</h3>
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
              <p className={styles.performanceMuted}>No standout movement detected for the current filter.</p>
            )}
          </div>
        </article>

        <article className={styles.smallCard}>
          <h3 className={styles.smallTitle}>Attention Areas</h3>
          <div className={styles.performanceSignalList}>
            {attentionAreas.length ? (
              attentionAreas.map((item) => (
                <div key={`${item.title}-${item.text}`} className={styles.performanceAlertItem}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                  <button type="button" className={styles.inlineActionButton}>
                    {item.action}
                  </button>
                </div>
              ))
            ) : (
              <p className={styles.performanceMuted}>No immediate issues detected in the selected window.</p>
            )}
          </div>
        </article>
      </section>
    </ClientShell>
  )
}
