'use client'

import { useMemo, useState } from 'react'
import { apiFetch } from '../../lib/api'
import { getAuthToken } from '../../lib/auth'
import AppShell from '../../components/layout/AppShell'

const PLATFORM_ORDER = ['meta', 'google', 'tiktok', 'telegram', 'yandex']

const PLACEMENT_OPTIONS = {
  meta: [
    { key: 'fb_feed', label: 'Facebook Feed' },
    { key: 'fb_video_feeds', label: 'FB Video Feeds' },
    { key: 'fb_instream', label: 'In-Stream' },
    { key: 'fb_reels', label: 'Reels' },
    { key: 'fb_stories', label: 'Stories' },
    { key: 'ig_feed', label: 'Instagram Feed' },
    { key: 'ig_reels', label: 'IG Reels' },
    { key: 'ig_stories', label: 'IG Stories' },
  ],
  google: [
    { key: 'google_search', label: 'Search' },
    { key: 'youtube_15s', label: 'YouTube 15s' },
    { key: 'youtube_30s', label: 'YouTube 30s' },
    { key: 'google_display_cpm', label: 'Display CPM' },
    { key: 'google_display_cpc', label: 'Display CPC' },
    { key: 'google_shopping', label: 'Shopping' },
  ],
  tiktok: [{ key: 'tiktok', label: 'For You' }],
  telegram: [
    { key: 'telegrad_channels', label: 'Channels' },
    { key: 'telegrad_users', label: 'Users' },
    { key: 'telegrad_bots', label: 'Bots' },
    { key: 'telegrad_search', label: 'Search' },
  ],
  yandex: [
    { key: 'yandex_search', label: 'Поиск' },
    { key: 'yandex_display', label: 'РСЯ/Директ' },
  ],
}

const ASSUMPTION_PROFILES = {
  base: {
    meta: { cpm: 2.1, ctr: 0.013, cvr: 0.016 },
    google_search: { cpc: 0.55, cvr: 0.028 },
    telegram: { cpm: 2.5, ctr: 0.012 },
  },
  conservative: {
    meta: { cpm: 2.5, ctr: 0.01, cvr: 0.012 },
    google_search: { cpc: 0.7, cvr: 0.02 },
    telegram: { cpm: 3.0, ctr: 0.009 },
  },
  aggressive: {
    meta: { cpm: 1.8, ctr: 0.016, cvr: 0.02 },
    google_search: { cpc: 0.45, cvr: 0.035 },
    telegram: { cpm: 2.0, ctr: 0.015 },
  },
}

const DEFAULT_SMART_FORM = {
  budget: '2000',
  period_days: '30',
  country: 'kz',
  goal: 'leads',
  business_type: 'services',
}

const DEFAULT_STRATEGY_FORM = {
  client_name: '',
  brand: '',
  product: '',
  budget: '10000',
  currency: 'USD',
  fx_rate: '',
  period_days: '30',
  goal: 'leads',
  date_start: '',
  date_end: '',
  targeting_depth: 'balanced',
  seasonality: '1',
  match_strategy: 'account',
  kpi_type: 'cpl',
  kpi_target: '14',
  market: 'kz',
  cities: '',
  interests: '',
  age_min: '18',
  age_max: '55',
  industry: 'other',
  geo_split: '',
  audience_size: '',
  creative_count: '',
  ltv_per_conversion: '',
  utm_template: '',
  pixels_configured: false,
  split_awareness: '',
  split_consideration: '',
  split_performance: '',
  avg_frequency: '1.6',
  country: 'kz',
  agency_fee_percent: '',
  vat_percent: '',
  assumption_profile: '',
  assumption_benchmarks: '',
  assumption_history: '',
  assumption_method: '',
  assumption_recalc: '',
}

const DEFAULT_OVERRIDES = {
  meta_cpm: '',
  meta_ctr: '',
  meta_cvr: '',
  gsearch_cpc: '',
  gsearch_cvr: '',
  tg_cpm: '',
  tg_ctr: '',
}

function buildDefaultPlacements() {
  return Object.fromEntries(PLATFORM_ORDER.map((p) => [p, (PLACEMENT_OPTIONS[p] || []).map((x) => x.key)]))
}

function toNum(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function maybeNum(v) {
  if (v === '' || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function usd(v, d = 0) {
  return `$${Number(v || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`
}

function num(v, d = 0) {
  return Number(v || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function pct(v, d = 1) {
  return `${(Number(v || 0) * 100).toFixed(d)}%`
}

function platformLabel(key) {
  if (key === 'meta') return 'Meta (FB/IG)'
  if (key === 'google') return 'Google Ads'
  if (key === 'tiktok') return 'TikTok Ads'
  if (key === 'telegram') return 'Telegram Ads'
  if (key === 'yandex') return 'Яндекс Ads'
  if (key === 'google_search') return 'Google Search'
  if (key === 'google_display_cpm') return 'Google Display CPM'
  if (key === 'google_display_cpc') return 'Google Display CPC'
  if (key === 'google_shopping') return 'Google Shopping'
  if (key === 'youtube_15s') return 'YouTube 15s'
  if (key === 'youtube_30s') return 'YouTube 30s'
  if (key === 'telegrad_channels') return 'Telegram Channels'
  if (key === 'telegrad_users') return 'Telegram Users'
  if (key === 'telegrad_bots') return 'Telegram Bots'
  if (key === 'telegrad_search') return 'Telegram Search'
  if (key === 'yandex_search') return 'Яндекс Поиск'
  if (key === 'yandex_display') return 'Яндекс РСЯ'
  return key
}

function flattenPlacements(placements) {
  return PLATFORM_ORDER.flatMap((platform) => placements[platform] || [])
}

function placementsToPlatforms(placements) {
  const set = new Set()
  const metaKeys = new Set((PLACEMENT_OPTIONS.meta || []).map((p) => p.key))
  PLATFORM_ORDER.forEach((platform) => {
    const selected = placements[platform] || []
    selected.forEach((key) => {
      if (platform === 'meta' && metaKeys.has(key)) set.add('meta')
      if (platform === 'google') {
        if (key === 'google_search') set.add('google_search')
        if (key === 'google_display_cpm') set.add('google_display_cpm')
        if (key === 'google_display_cpc') set.add('google_display_cpc')
        if (key === 'google_shopping') set.add('google_shopping')
        if (key === 'youtube_15s') set.add('youtube_15s')
        if (key === 'youtube_30s') set.add('youtube_30s')
      }
      if (platform === 'tiktok' && key === 'tiktok') set.add('tiktok')
      if (platform === 'telegram') {
        if (key === 'telegrad_channels') set.add('telegrad_channels')
        if (key === 'telegrad_users') set.add('telegrad_users')
        if (key === 'telegrad_bots') set.add('telegrad_bots')
        if (key === 'telegrad_search') set.add('telegrad_search')
      }
      if (platform === 'yandex') {
        if (key === 'yandex_search') set.add('yandex_search')
        if (key === 'yandex_display') set.add('yandex_display')
      }
    })
  })
  return Array.from(set)
}

function normalizeMonthPlatforms(raw, monthsCount, activePlatforms) {
  const fallback = Array.from({ length: monthsCount }, () => [...activePlatforms])
  if (!Array.isArray(raw) || !raw.length) return fallback
  const activeSet = new Set(activePlatforms)
  const out = []
  for (let i = 0; i < monthsCount; i += 1) {
    const row = Array.isArray(raw[i]) ? raw[i].filter((x) => activeSet.has(x)) : null
    out.push(row && row.length ? row : [...activePlatforms])
  }
  return out
}

function buildChannelInputs(overrides) {
  const channelInputs = {}
  const metaCpm = maybeNum(overrides.meta_cpm)
  const metaCtr = maybeNum(overrides.meta_ctr)
  const metaCvr = maybeNum(overrides.meta_cvr)
  if (metaCpm != null || metaCtr != null || metaCvr != null) {
    channelInputs.meta = { cpm: metaCpm, ctr: metaCtr, cvr: metaCvr }
  }

  const gCpc = maybeNum(overrides.gsearch_cpc)
  const gCvr = maybeNum(overrides.gsearch_cvr)
  if (gCpc != null || gCvr != null) {
    channelInputs.google_search = { cpc: gCpc, cvr: gCvr }
  }

  const tgCpm = maybeNum(overrides.tg_cpm)
  const tgCtr = maybeNum(overrides.tg_ctr)
  if (tgCpm != null || tgCtr != null) {
    channelInputs.telegram = { cpm: tgCpm, ctr: tgCtr }
  }

  return Object.keys(channelInputs).length ? channelInputs : null
}

function buildAssumptions(form) {
  const raw = {
    benchmarks: form.assumption_benchmarks?.trim() || null,
    history: form.assumption_history?.trim() || null,
    methodology: form.assumption_method?.trim() || null,
    recalc: form.assumption_recalc?.trim() || null,
  }
  const filtered = Object.fromEntries(Object.entries(raw).filter(([, v]) => v))
  return Object.keys(filtered).length ? filtered : null
}

function buildSmartPayload(form, aiSplit, overrides) {
  const goal = form.goal === 'sales' ? 'conversions' : form.goal
  return {
    plan_mode: 'smart',
    business_type: form.business_type || null,
    goal,
    budget: Math.max(1, toNum(form.budget, 2000)),
    currency: 'USD',
    country: form.country,
    market: form.country,
    period_days: Math.max(1, toNum(form.period_days, 30)),
    avg_frequency: 1.6,
    pricing_mode: 'auto',
    channel_inputs: buildChannelInputs(overrides),
    budget_split: aiSplit || null,
  }
}

function buildStrategyPayload(form, aiSplit, overrides, placements, agencyMode, monthPlatforms) {
  const platforms = placementsToPlatforms(placements)
  const splitAwareness = maybeNum(form.split_awareness)
  const splitConsideration = maybeNum(form.split_consideration)
  const splitPerformance = maybeNum(form.split_performance)
  const funnelSplit =
    splitAwareness != null || splitConsideration != null || splitPerformance != null
      ? {
          awareness: splitAwareness,
          consideration: splitConsideration,
          performance: splitPerformance,
        }
      : null

  const cities = form.cities
    ? form.cities
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : []
  const interests = form.interests
    ? form.interests
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : []

  return {
    plan_mode: 'strategy',
    company: form.brand || 'Client',
    client_name: form.client_name || null,
    brand: form.brand || null,
    product: form.product || null,
    business_type: null,
    goal: form.goal,
    budget: toNum(form.budget),
    currency: form.currency || 'USD',
    fx_rate: form.fx_rate ? toNum(form.fx_rate) : null,
    country: form.market || form.country,
    market: form.market || form.country,
    period_days: Math.max(1, toNum(form.period_days, 30)),
    date_start: form.date_start || null,
    date_end: form.date_end || null,
    targeting_depth: form.targeting_depth || null,
    seasonality: form.seasonality ? toNum(form.seasonality, 1) : 1,
    match_strategy: form.match_strategy || 'account',
    kpi_type: form.kpi_type || null,
    kpi_target: form.kpi_target ? toNum(form.kpi_target) : null,
    cities,
    interests,
    age_min: form.age_min ? toNum(form.age_min) : null,
    age_max: form.age_max ? toNum(form.age_max) : null,
    industry: form.industry || null,
    geo_split: form.geo_split || null,
    audience_size: form.audience_size ? toNum(form.audience_size) : null,
    creative_count: form.creative_count ? toNum(form.creative_count) : null,
    ltv_per_conversion: form.ltv_per_conversion ? toNum(form.ltv_per_conversion) : null,
    utm_template: form.utm_template || '',
    pixels_configured: Boolean(form.pixels_configured),
    avg_frequency: Math.max(1, toNum(form.avg_frequency, 1.6)),
    pricing_mode: 'auto',
    agency_fee_percent: form.agency_fee_percent ? toNum(form.agency_fee_percent) : null,
    vat_percent: form.vat_percent ? toNum(form.vat_percent) : null,
    assumption_profile: form.assumption_profile || null,
    assumptions: buildAssumptions(form),
    channel_inputs: buildChannelInputs(overrides),
    platforms,
    placements: flattenPlacements(placements),
    monthly_platforms: agencyMode ? monthPlatforms : null,
    funnel_split: funnelSplit,
    budget_split: aiSplit || null,
  }
}

function readAssistantDraftForUI(draft, fallbackPayload) {
  if (!draft || typeof draft !== 'object') return null
  return {
    source: draft.source || 'fallback',
    profile: draft.assumption_profile || 'base',
    confidence: typeof draft.confidence === 'number' ? draft.confidence : 0.6,
    recommendations: Array.isArray(draft.recommendations) ? draft.recommendations : [],
    rationale: typeof draft.rationale === 'string' ? draft.rationale : '',
    budgetSplit: draft.budget_split && typeof draft.budget_split === 'object' ? draft.budget_split : {},
    periodDays: fallbackPayload.period_days,
    budget: fallbackPayload.budget,
  }
}

function profileToOverrides(profileKey) {
  const profile = ASSUMPTION_PROFILES[profileKey]
  if (!profile) return null
  return {
    meta_cpm: profile.meta?.cpm != null ? String(profile.meta.cpm) : '',
    meta_ctr: profile.meta?.ctr != null ? String(profile.meta.ctr) : '',
    meta_cvr: profile.meta?.cvr != null ? String(profile.meta.cvr) : '',
    gsearch_cpc: profile.google_search?.cpc != null ? String(profile.google_search.cpc) : '',
    gsearch_cvr: profile.google_search?.cvr != null ? String(profile.google_search.cvr) : '',
    tg_cpm: profile.telegram?.cpm != null ? String(profile.telegram.cpm) : '',
    tg_ctr: profile.telegram?.ctr != null ? String(profile.telegram.ctr) : '',
  }
}

function draftChannelsToOverrides(draft) {
  if (!draft || typeof draft !== 'object') return null
  const inputs = draft.channel_inputs || {}
  const meta = inputs.meta || {}
  const g = inputs.google_search || {}
  const tg = inputs.telegram || inputs.telegrad_channels || {}
  return {
    meta_cpm: meta.cpm != null ? String(meta.cpm) : '',
    meta_ctr: meta.ctr != null ? String(meta.ctr) : '',
    meta_cvr: meta.cvr != null ? String(meta.cvr) : '',
    gsearch_cpc: g.cpc != null ? String(g.cpc) : '',
    gsearch_cvr: g.cvr != null ? String(g.cvr) : '',
    tg_cpm: tg.cpm != null ? String(tg.cpm) : '',
    tg_ctr: tg.ctr != null ? String(tg.ctr) : '',
  }
}

export default function PlanPage() {
  const [planMode, setPlanMode] = useState('smart')
  const [smartForm, setSmartForm] = useState(DEFAULT_SMART_FORM)
  const [strategyForm, setStrategyForm] = useState(DEFAULT_STRATEGY_FORM)
  const [overrides, setOverrides] = useState(DEFAULT_OVERRIDES)
  const [placements, setPlacements] = useState(buildDefaultPlacements)
  const [agencyMode, setAgencyMode] = useState(false)
  const [monthPlatformsRaw, setMonthPlatformsRaw] = useState([])

  const [plan, setPlan] = useState(null)
  const [assistant, setAssistant] = useState(null)
  const [pendingEstimate, setPendingEstimate] = useState(false)
  const [pendingAssistant, setPendingAssistant] = useState(false)
  const [pendingExcel, setPendingExcel] = useState(false)
  const [status, setStatus] = useState('Заполните вводные и нажмите «Рассчитать план».')

  const aiSplit = useMemo(() => {
    if (!assistant?.budgetSplit) return null
    return Object.keys(assistant.budgetSplit).length ? assistant.budgetSplit : null
  }, [assistant])

  const strategyPlatforms = useMemo(() => placementsToPlatforms(placements), [placements])
  const monthsCount = useMemo(() => Math.max(1, Math.ceil((toNum(strategyForm.period_days, 30) || 30) / 30)), [strategyForm.period_days])
  const monthPlatforms = useMemo(
    () => normalizeMonthPlatforms(monthPlatformsRaw, monthsCount, strategyPlatforms),
    [monthPlatformsRaw, monthsCount, strategyPlatforms]
  )

  const payload = useMemo(() => {
    return planMode === 'smart'
      ? buildSmartPayload(smartForm, aiSplit, overrides)
      : buildStrategyPayload(strategyForm, aiSplit, overrides, placements, agencyMode, monthPlatforms)
  }, [planMode, smartForm, strategyForm, aiSplit, overrides, placements, agencyMode, monthPlatforms])

  const totals = plan?.totals || null
  const feeRate = planMode === 'strategy' ? (payload.agency_fee_percent || 0) / 100 : 0
  const vatRate = planMode === 'strategy' ? (payload.vat_percent || 0) / 100 : 0
  const totalOverhead = totals ? (totals.budget || 0) * (feeRate + vatRate) : 0
  const totalGross = totals ? (totals.budget || 0) + totalOverhead : 0

  const warnings = useMemo(() => {
    if (!plan?.totals || !Array.isArray(plan?.lines)) return []
    const items = []
    const t = plan.totals
    const totalFreq = t.reach ? t.impressions / t.reach : null
    if (totalFreq && totalFreq > 8) items.push('Частота > 8: возможен перегрев аудитории.')
    if ((t.clicks || 0) > (t.impressions || 0)) items.push('Клики больше показов: проверьте вводные CTR/CPC.')
    if ((t.leads || 0) > (t.clicks || 0)) items.push('Лидов больше кликов: проверьте CVR.')
    if ((t.conversions || 0) > (t.leads || 0)) items.push('Конверсий больше лидов: проверьте post-click/CVR.')

    plan.lines.forEach((line) => {
      const ctr = line.impressions ? line.clicks / line.impressions : 0
      const cvr = line.clicks ? line.leads / line.clicks : 0
      const cpa = line.leads ? line.budget / line.leads : null
      if (ctr > 0.1) items.push(`${line.name}: CTR > 10% — проверьте реалистичность.`)
      if (cvr > 0.4) items.push(`${line.name}: CVR > 40% — проверьте реалистичность.`)
      if (line.reach && line.impressions / line.reach > 8) items.push(`${line.name}: Frequency > 8.`)
      if (cpa && cpa < 0.5) items.push(`${line.name}: CPA < $0.5 — проверьте реалистичность.`)
    })

    return items
  }, [plan])

  const outputRows = useMemo(() => {
    if (!totals || planMode !== 'strategy') return []
    const impressions = totals.impressions || 0
    const reach = totals.reach || 0
    const clicks = totals.clicks || 0
    const leads = totals.leads || 0
    const conversions = totals.conversions || 0
    const cpm = impressions ? (totals.budget / impressions) * 1000 : null
    const cpc = clicks ? totals.budget / clicks : null
    const cpl = leads ? totals.budget / leads : null
    const cpa = conversions ? totals.budget / conversions : null
    const freq = reach ? impressions / reach : null
    const periodDays = Number(payload.period_days || 0)
    const budgetPerDay = periodDays ? totals.budget / periodDays : null
    const budgetPerWeek = periodDays ? totals.budget / Math.max(1, Math.ceil(periodDays / 7)) : null

    return [
      ['Budget (net/client)', usd(totals.budget), 'Гарантия'],
      ['Комиссия/VAT', usd(totalOverhead), 'Гарантия'],
      ['Budget (gross)', usd(totalGross), 'Гарантия'],
      ['CPM', cpm ? usd(cpm, 2) : '—', 'Прогноз'],
      ['CPC', cpc ? usd(cpc, 2) : '—', 'Прогноз'],
      ['CPL', cpl ? usd(cpl, 2) : '—', 'Прогноз'],
      ['CPA', cpa ? usd(cpa, 2) : '—', 'Прогноз'],
      ['Impressions', num(impressions), 'Прогноз'],
      ['Reach', num(reach), 'Прогноз'],
      ['Clicks', num(clicks), 'Прогноз'],
      ['Leads', num(leads), 'Прогноз'],
      ['Purchases', num(conversions), 'Прогноз'],
      ['Frequency', freq ? freq.toFixed(2) : '—', 'Прогноз'],
      ['Pacing / day', budgetPerDay ? usd(budgetPerDay, 2) : '—', 'Прогноз'],
      ['Pacing / week', budgetPerWeek ? usd(budgetPerWeek, 2) : '—', 'Прогноз'],
      ['Assumption profile', strategyForm.assumption_profile || '—', 'Прогноз'],
    ]
  }, [totals, planMode, payload.period_days, totalOverhead, totalGross, strategyForm.assumption_profile])

  const flightData = useMemo(() => {
    if (!plan?.lines?.length || planMode !== 'strategy') return null

    const weeksCount = Math.max(1, Math.ceil((toNum(strategyForm.period_days, 30) || 30) / 7))
    const activePlatforms = strategyPlatforms.length ? strategyPlatforms : plan.lines.map((l) => l.key)
    const monthsForWeights = agencyMode
      ? monthPlatforms
      : Array.from({ length: monthsCount }, () => [...activePlatforms])

    const monthWeights = {}
    activePlatforms.forEach((p) => {
      const raw = Array.from({ length: monthsCount }, (_, idx) => {
        const monthList = monthsForWeights[idx] || []
        return monthList.includes(p) ? 1 : 0
      })
      const total = raw.reduce((a, b) => a + b, 0)
      monthWeights[p] = total ? raw.map((w) => w / total) : raw.map(() => 0)
    })

    const monthRows = plan.lines.map((line) => {
      const weights = monthWeights[line.key] || Array.from({ length: monthsCount }, () => 1 / monthsCount)
      return {
        name: line.name,
        values: weights.map((w) => line.budget * w),
      }
    })

    const weekToMonth = Array.from({ length: weeksCount }, (_, idx) => Math.min(monthsCount - 1, Math.floor((idx * 7) / 30)))
    const weeksInMonth = Array.from({ length: monthsCount }, () => 0)
    weekToMonth.forEach((m) => {
      weeksInMonth[m] += 1
    })

    const weekRows = plan.lines.map((line) => {
      const weights = monthWeights[line.key] || Array.from({ length: monthsCount }, () => 1 / monthsCount)
      const monthBudgets = weights.map((w) => line.budget * w)
      return {
        name: line.name,
        values: weekToMonth.map((m) => monthBudgets[m] / (weeksInMonth[m] || 1)),
      }
    })

    return { weeksCount, monthRows, weekRows }
  }, [plan, planMode, strategyForm.period_days, strategyPlatforms, agencyMode, monthPlatforms, monthsCount])

  async function runEstimate() {
    setPendingEstimate(true)
    setStatus('Считаем медиаплан...')
    try {
      const res = await apiFetch('/plans/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Не удалось рассчитать медиаплан')
      setPlan(data)
      setStatus('Расчет выполнен.')
    } catch (error) {
      setStatus(error?.message || 'Ошибка расчета медиаплана')
    } finally {
      setPendingEstimate(false)
    }
  }

  async function runAssistant() {
    setPendingAssistant(true)
    setStatus('AI ассистент готовит черновик...')

    const token = getAuthToken()
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    try {
      const basePayload = payload
      const res = await apiFetch('/plans/assistant', {
        method: 'POST',
        headers,
        body: JSON.stringify(basePayload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || 'Не удалось получить AI-черновик')

      const draft = readAssistantDraftForUI(data, basePayload)
      setAssistant(draft)

      if (planMode === 'strategy' && data?.assumption_profile) {
        setStrategyForm((prev) => ({
          ...prev,
          assumption_profile: String(data.assumption_profile),
          assumption_benchmarks: data?.assumptions?.benchmarks || prev.assumption_benchmarks,
          assumption_history: data?.assumptions?.history || prev.assumption_history,
          assumption_method: data?.assumptions?.methodology || prev.assumption_method,
          assumption_recalc: data?.assumptions?.recalc || prev.assumption_recalc,
        }))
      }

      const draftOverrides = draftChannelsToOverrides(data)
      if (draftOverrides) setOverrides((prev) => ({ ...prev, ...draftOverrides }))

      setStatus('AI-черновик применен. Пересчитываем итог...')

      const nextPayload = planMode === 'smart'
        ? buildSmartPayload(smartForm, draft?.budgetSplit || null, draftOverrides || overrides)
        : buildStrategyPayload(
            {
              ...strategyForm,
              assumption_profile: data?.assumption_profile || strategyForm.assumption_profile,
              assumption_benchmarks: data?.assumptions?.benchmarks || strategyForm.assumption_benchmarks,
              assumption_history: data?.assumptions?.history || strategyForm.assumption_history,
              assumption_method: data?.assumptions?.methodology || strategyForm.assumption_method,
              assumption_recalc: data?.assumptions?.recalc || strategyForm.assumption_recalc,
            },
            draft?.budgetSplit || null,
            draftOverrides || overrides,
            placements,
            agencyMode,
            monthPlatforms
          )

      const planRes = await apiFetch('/plans/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextPayload),
      })
      const planData = await planRes.json().catch(() => ({}))
      if (!planRes.ok) throw new Error(planData?.detail || 'Черновик получен, но итоговый расчет не удался')
      setPlan(planData)
      setStatus('AI-черновик применен и рассчитан.')
    } catch (error) {
      setStatus(error?.message || 'Ошибка AI ассистента')
    } finally {
      setPendingAssistant(false)
    }
  }

  async function downloadExcel() {
    setPendingExcel(true)
    try {
      const res = await apiFetch('/plans/estimate/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.detail || `Ошибка экспорта Excel: ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mediaplan.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      setStatus('Excel выгружен.')
    } catch (error) {
      setStatus(error?.message || 'Не удалось выгрузить Excel')
    } finally {
      setPendingExcel(false)
    }
  }

  function onSmartChange(key, value) {
    setSmartForm((prev) => ({ ...prev, [key]: value }))
  }

  function onStrategyChange(key, value) {
    setStrategyForm((prev) => ({ ...prev, [key]: value }))
  }

  function onOverrideChange(key, value) {
    setOverrides((prev) => ({ ...prev, [key]: value }))
  }

  function onAssumptionProfileChange(value) {
    onStrategyChange('assumption_profile', value)
    const profileOverrides = profileToOverrides(value)
    if (profileOverrides) setOverrides((prev) => ({ ...prev, ...profileOverrides }))
  }

  function onPlacementToggle(platform, key, checked) {
    setPlacements((prev) => {
      const set = new Set(prev[platform] || [])
      if (checked) set.add(key)
      else set.delete(key)
      return { ...prev, [platform]: Array.from(set) }
    })
  }

  function onMonthToggle(monthIndex, platform, checked) {
    setMonthPlatformsRaw((prev) => {
      const base = normalizeMonthPlatforms(prev, monthsCount, strategyPlatforms).map((x) => [...x])
      const set = new Set(base[monthIndex] || [])
      if (checked) set.add(platform)
      else set.delete(platform)
      base[monthIndex] = Array.from(set)
      return base
    })
  }

  const actions = (
    <div className="panel-actions">
      <button className="btn primary" disabled={pendingEstimate || pendingAssistant || pendingExcel} onClick={runEstimate} type="button">
        {pendingEstimate ? 'Считаем...' : 'Рассчитать план'}
      </button>
      <button className="btn ghost" disabled={pendingEstimate || pendingAssistant || pendingExcel} onClick={runAssistant} type="button">
        {pendingAssistant ? 'Готовим...' : 'AI-черновик'}
      </button>
      <button className="btn ghost" disabled={pendingEstimate || pendingAssistant || pendingExcel} onClick={downloadExcel} type="button">
        {pendingExcel ? 'Экспорт...' : 'Скачать Excel'}
      </button>
    </div>
  )

  return (
    <AppShell eyebrow="Envidicy · Media Planner" title="План, факт и сценарии" subtitle="MVP переноса страницы медиаплана на Next.js без изменения API-логики.">
      <section className="panel" id="strategy-form">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Тип планирования</p>
            <h2>Smart Plan или Strategy Plan</h2>
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Режим</span>
            <select value={planMode} onChange={(e) => setPlanMode(e.target.value)}>
              <option value="smart">Smart Plan (SMB)</option>
              <option value="strategy">Strategy Plan (Agency)</option>
            </select>
          </label>
          <div className="field">
            <span>Статус</span>
            <input value={status} readOnly />
          </div>
        </div>
      </section>

      {planMode === 'smart' ? (
        <section className="panel" id="smart-form">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Smart Plan</p>
              <h2>Минимум вводов, система подбирает каналы</h2>
            </div>
            {actions}
          </div>
          <div className="form-grid">
            <label className="field"><span>Бюджет, USD</span><input value={smartForm.budget} onChange={(e) => onSmartChange('budget', e.target.value)} type="number" min="1" /></label>
            <label className="field"><span>Период, дней</span><input value={smartForm.period_days} onChange={(e) => onSmartChange('period_days', e.target.value)} type="number" min="1" /></label>
            <label className="field"><span>Гео</span><select value={smartForm.country} onChange={(e) => onSmartChange('country', e.target.value)}><option value="kz">Kazakhstan</option><option value="uz">Uzbekistan</option><option value="ru">Russia</option></select></label>
            <label className="field"><span>Цель</span><select value={smartForm.goal} onChange={(e) => onSmartChange('goal', e.target.value)}><option value="leads">Заявки</option><option value="sales">Продажи</option><option value="traffic">Трафик</option></select></label>
            <label className="field"><span>Тип бизнеса</span><select value={smartForm.business_type} onChange={(e) => onSmartChange('business_type', e.target.value)}><option value="services">Услуги</option><option value="ecom">Ecom</option><option value="b2b">B2B</option><option value="local">Локальный бизнес</option><option value="content">Контент/медиа</option></select></label>
          </div>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Strategy Plan</p>
                <h2>Расширенные вводные и агентские параметры</h2>
              </div>
              {actions}
            </div>

            <div className="form-grid">
              <label className="field"><span>Client</span><input value={strategyForm.client_name} onChange={(e) => onStrategyChange('client_name', e.target.value)} type="text" placeholder="ACME Holding" /></label>
              <label className="field"><span>Brand</span><input value={strategyForm.brand} onChange={(e) => onStrategyChange('brand', e.target.value)} type="text" placeholder="ACME Corp" /></label>
              <label className="field"><span>Product</span><input value={strategyForm.product} onChange={(e) => onStrategyChange('product', e.target.value)} type="text" placeholder="ACME App" /></label>
              <label className="field"><span>Бюджет</span><input value={strategyForm.budget} onChange={(e) => onStrategyChange('budget', e.target.value)} type="number" min="1" /></label>
              <label className="field"><span>Период, дней</span><input value={strategyForm.period_days} onChange={(e) => onStrategyChange('period_days', e.target.value)} type="number" min="1" /></label>
              <label className="field"><span>Цель</span><select value={strategyForm.goal} onChange={(e) => onStrategyChange('goal', e.target.value)}><option value="leads">Leads</option><option value="traffic">Traffic</option><option value="conversions">Conversions</option><option value="reach">Reach</option></select></label>
              <label className="field"><span>Market</span><select value={strategyForm.market} onChange={(e) => { onStrategyChange('market', e.target.value); onStrategyChange('country', e.target.value) }}><option value="kz">Kazakhstan</option><option value="uz">Uzbekistan</option><option value="ru">Russia</option><option value="other">Other</option></select></label>
              <label className="field"><span>Валюта</span><select value={strategyForm.currency} onChange={(e) => onStrategyChange('currency', e.target.value)}><option value="USD">USD</option><option value="KZT">KZT</option></select></label>
            </div>

            <details className="field details" style={{ marginTop: 12 }}>
              <summary>KPI и Аудитория</summary>
              <div className="form-grid" style={{ marginTop: 10 }}>
                <label className="field"><span>KPI тип</span><select value={strategyForm.kpi_type} onChange={(e) => onStrategyChange('kpi_type', e.target.value)}><option value="cpl">CPL</option><option value="cpa">CPA</option><option value="cpc">CPC</option><option value="cpm">CPM</option></select></label>
                <label className="field"><span>KPI цель, $</span><input value={strategyForm.kpi_target} onChange={(e) => onStrategyChange('kpi_target', e.target.value)} type="number" step="0.1" /></label>
                <label className="field"><span>Возраст min</span><input value={strategyForm.age_min} onChange={(e) => onStrategyChange('age_min', e.target.value)} type="number" /></label>
                <label className="field"><span>Возраст max</span><input value={strategyForm.age_max} onChange={(e) => onStrategyChange('age_max', e.target.value)} type="number" /></label>
                <label className="field"><span>Индустрия</span><select value={strategyForm.industry} onChange={(e) => onStrategyChange('industry', e.target.value)}><option value="fmcg">FMCG</option><option value="pharma">Pharma</option><option value="finance">Finance</option><option value="travel">Travel</option><option value="ecommerce">E-commerce</option><option value="auto">Auto</option><option value="real_estate">Real estate</option><option value="education">Education</option><option value="other">Other</option></select></label>
                <label className="field"><span>Geo split</span><input value={strategyForm.geo_split} onChange={(e) => onStrategyChange('geo_split', e.target.value)} type="text" placeholder="KZ 60% / UZ 40%" /></label>
                <label className="field"><span>Cities</span><input value={strategyForm.cities} onChange={(e) => onStrategyChange('cities', e.target.value)} type="text" placeholder="Almaty, Astana" /></label>
                <label className="field"><span>Interests</span><input value={strategyForm.interests} onChange={(e) => onStrategyChange('interests', e.target.value)} type="text" placeholder="travel, fitness" /></label>
                <label className="field"><span>Audience size</span><input value={strategyForm.audience_size} onChange={(e) => onStrategyChange('audience_size', e.target.value)} type="number" placeholder="1000000" /></label>
                <label className="field"><span>Creative count</span><input value={strategyForm.creative_count} onChange={(e) => onStrategyChange('creative_count', e.target.value)} type="number" placeholder="6" /></label>
                <label className="field"><span>LTV per conversion</span><input value={strategyForm.ltv_per_conversion} onChange={(e) => onStrategyChange('ltv_per_conversion', e.target.value)} type="number" /></label>
              </div>
            </details>

            <details className="field details" style={{ marginTop: 12 }}>
              <summary>Финансы и Атрибуция</summary>
              <div className="form-grid" style={{ marginTop: 10 }}>
                <label className="field"><span>Дата начала</span><input value={strategyForm.date_start} onChange={(e) => onStrategyChange('date_start', e.target.value)} type="date" /></label>
                <label className="field"><span>Дата конца</span><input value={strategyForm.date_end} onChange={(e) => onStrategyChange('date_end', e.target.value)} type="date" /></label>
                <label className="field"><span>Курс (KZT→USD)</span><input value={strategyForm.fx_rate} onChange={(e) => onStrategyChange('fx_rate', e.target.value)} type="number" step="0.01" placeholder="460" /></label>
                <label className="field"><span>Частота</span><input value={strategyForm.avg_frequency} onChange={(e) => onStrategyChange('avg_frequency', e.target.value)} type="number" min="1" step="0.1" /></label>
                <label className="field"><span>Таргетинг</span><select value={strategyForm.targeting_depth} onChange={(e) => onStrategyChange('targeting_depth', e.target.value)}><option value="balanced">Сбаланс.</option><option value="broad">Широкий</option><option value="focused">Узкий</option></select></label>
                <label className="field"><span>Сезонность</span><input value={strategyForm.seasonality} onChange={(e) => onStrategyChange('seasonality', e.target.value)} type="number" step="0.02" /></label>
                <label className="field"><span>Match стратегия</span><select value={strategyForm.match_strategy} onChange={(e) => onStrategyChange('match_strategy', e.target.value)}><option value="account">ad_account_id</option><option value="campaign">campaign_name</option><option value="platform">platform</option></select></label>
                <label className="field"><span>UTM template</span><input value={strategyForm.utm_template} onChange={(e) => onStrategyChange('utm_template', e.target.value)} type="text" placeholder="utm_source={{platform}}&utm_campaign={{name}}" /></label>
                <label className="field"><span>Комиссия, %</span><input value={strategyForm.agency_fee_percent} onChange={(e) => onStrategyChange('agency_fee_percent', e.target.value)} type="number" min="0" step="0.1" placeholder="10" /></label>
                <label className="field"><span>VAT, %</span><input value={strategyForm.vat_percent} onChange={(e) => onStrategyChange('vat_percent', e.target.value)} type="number" min="0" step="0.1" placeholder="12" /></label>
                <label className="field"><span>Funnel Awareness %</span><input value={strategyForm.split_awareness} onChange={(e) => onStrategyChange('split_awareness', e.target.value)} type="number" step="1" placeholder="40" /></label>
                <label className="field"><span>Funnel Consideration %</span><input value={strategyForm.split_consideration} onChange={(e) => onStrategyChange('split_consideration', e.target.value)} type="number" step="1" placeholder="35" /></label>
                <label className="field"><span>Funnel Performance %</span><input value={strategyForm.split_performance} onChange={(e) => onStrategyChange('split_performance', e.target.value)} type="number" step="1" placeholder="25" /></label>
                <label className="field checkbox"><span>Пиксели настроены</span><input checked={Boolean(strategyForm.pixels_configured)} onChange={(e) => onStrategyChange('pixels_configured', e.target.checked)} type="checkbox" /></label>
              </div>
            </details>

            <details className="field details" style={{ marginTop: 12 }}>
              <summary>Assumptions</summary>
              <div className="form-grid" style={{ marginTop: 10 }}>
                <label className="field"><span>Assumption profile</span><select value={strategyForm.assumption_profile} onChange={(e) => onAssumptionProfileChange(e.target.value)}><option value="">Не выбран</option><option value="base">Base</option><option value="conservative">Conservative</option><option value="aggressive">Aggressive</option></select></label>
                <label className="field"><span>Benchmarks source</span><input value={strategyForm.assumption_benchmarks} onChange={(e) => onStrategyChange('assumption_benchmarks', e.target.value)} type="text" placeholder="Market benchmarks" /></label>
                <label className="field"><span>History source</span><input value={strategyForm.assumption_history} onChange={(e) => onStrategyChange('assumption_history', e.target.value)} type="text" placeholder="Client history / CRM" /></label>
                <label className="field"><span>Methodology</span><input value={strategyForm.assumption_method} onChange={(e) => onStrategyChange('assumption_method', e.target.value)} type="text" placeholder="Методология расчёта" /></label>
                <label className="field"><span>Recalc after 7 days</span><input value={strategyForm.assumption_recalc} onChange={(e) => onStrategyChange('assumption_recalc', e.target.value)} type="text" placeholder="Что пересчитываем после learning phase" /></label>
              </div>
            </details>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Плейсменты</p>
                <h2>Включайте и отключайте инвентарь</h2>
              </div>
              <span className="chip chip-ghost">По умолчанию включены все</span>
            </div>
            <div className="placement-grid">
              {PLATFORM_ORDER.map((platform) => (
                <div key={platform} className="placement-card">
                  <div className="placement-title">{platformLabel(platform)}</div>
                  <div className="placement-options">
                    {(PLACEMENT_OPTIONS[platform] || []).map((pl) => (
                      <label key={pl.key} className="placement-option">
                        <input
                          type="checkbox"
                          checked={(placements[platform] || []).includes(pl.key)}
                          onChange={(e) => onPlacementToggle(platform, pl.key, e.target.checked)}
                        />
                        <span>{pl.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel" id="month-panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Агентский режим</p>
                <h2>Календарь по месяцам</h2>
              </div>
              <label className="field checkbox" style={{ maxWidth: 280 }}>
                <span>Включить сплит по месяцам</span>
                <input type="checkbox" checked={agencyMode} onChange={(e) => setAgencyMode(e.target.checked)} />
              </label>
            </div>
            {agencyMode ? (
              <div className="table-wrapper">
                <table className="table month-table">
                  <thead>
                    <tr>
                      <th>Платформа</th>
                      {Array.from({ length: monthsCount }, (_, i) => (
                        <th key={`mh-${i}`}>M{i + 1}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {strategyPlatforms.map((platform) => (
                      <tr key={platform}>
                        <td>{platformLabel(platform)}</td>
                        {Array.from({ length: monthsCount }, (_, m) => {
                          const checked = (monthPlatforms[m] || []).includes(platform)
                          return (
                            <td key={`${platform}-${m}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => onMonthToggle(m, platform, e.target.checked)}
                                aria-label={`M${m + 1} ${platform}`}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </>
      )}

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Модули каналов</p>
            <h2>Свои вводные для Meta, Google Search, Telegram</h2>
          </div>
          <span className="chip chip-ghost">Overrides</span>
        </div>
        <div className="form-grid">
          <label className="field"><span>Meta CPM</span><input value={overrides.meta_cpm} onChange={(e) => onOverrideChange('meta_cpm', e.target.value)} type="number" step="0.01" placeholder="2.1" /></label>
          <label className="field"><span>Meta CTR</span><input value={overrides.meta_ctr} onChange={(e) => onOverrideChange('meta_ctr', e.target.value)} type="number" step="0.001" placeholder="0.013" /></label>
          <label className="field"><span>Meta CVR</span><input value={overrides.meta_cvr} onChange={(e) => onOverrideChange('meta_cvr', e.target.value)} type="number" step="0.001" placeholder="0.016" /></label>
          <label className="field"><span>Google Search CPC</span><input value={overrides.gsearch_cpc} onChange={(e) => onOverrideChange('gsearch_cpc', e.target.value)} type="number" step="0.01" placeholder="0.55" /></label>
          <label className="field"><span>Google Search CVR</span><input value={overrides.gsearch_cvr} onChange={(e) => onOverrideChange('gsearch_cvr', e.target.value)} type="number" step="0.001" placeholder="0.028" /></label>
          <label className="field"><span>Telegram CPM</span><input value={overrides.tg_cpm} onChange={(e) => onOverrideChange('tg_cpm', e.target.value)} type="number" step="0.01" placeholder="2.5" /></label>
          <label className="field"><span>Telegram CTR</span><input value={overrides.tg_ctr} onChange={(e) => onOverrideChange('tg_ctr', e.target.value)} type="number" step="0.001" placeholder="0.012" /></label>
        </div>
      </section>

      <section className="grid-3" id="kpi-cards">
        <article className="stat"><p className="eyebrow">План</p><h3>Бюджет (net)</h3><p className="stat-value">{totals ? usd(totals.budget, 2) : '—'}</p></article>
        <article className="stat"><p className="eyebrow">План</p><h3>Комиссия/VAT</h3><p className="stat-value">{totals ? usd(totalOverhead, 2) : '—'}</p></article>
        <article className="stat"><p className="eyebrow">План</p><h3>Бюджет (gross)</h3><p className="stat-value">{totals ? usd(totalGross, 2) : '—'}</p></article>
        <article className="stat"><p className="eyebrow">План</p><h3>Охват</h3><p className="stat-value">{totals ? num(totals.reach) : '—'}</p></article>
        <article className="stat"><p className="eyebrow">План</p><h3>Клики</h3><p className="stat-value">{totals ? num(totals.clicks) : '—'}</p></article>
        <article className="stat"><p className="eyebrow">План</p><h3>Лиды</h3><p className="stat-value">{totals ? num(totals.leads) : '—'}</p></article>
        <article className="stat"><p className="eyebrow">План</p><h3>Конверсии</h3><p className="stat-value">{totals ? num(totals.conversions) : '—'}</p></article>
      </section>

      {planMode === 'strategy' ? (
        <section className="panel">
          <div className="panel-head"><div><p className="eyebrow">Выходы</p><h2>Стандартный формат</h2></div></div>
          <div className="table-wrapper">
            <table className="table">
              <thead><tr><th>Метрика</th><th>Значение</th><th>Тип</th></tr></thead>
              <tbody>{outputRows.map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel" id="ai-assistant-panel">
        <div className="panel-head"><div><p className="eyebrow">AI ассистент</p><h2>Рекомендации по медиаплану</h2></div><span className="chip chip-ghost">MVP</span></div>
        {!assistant ? (
          <div id="ai-assistant-output" className="muted">Нажмите «AI-черновик», чтобы получить рекомендации.</div>
        ) : (
          <div id="ai-assistant-output">
            <div className="chips">
              <span className="chip chip-ghost">Источник: {assistant.source}</span>
              <span className="chip chip-ghost">Профиль: {assistant.profile}</span>
              <span className="chip chip-ghost">Confidence: {Math.round((assistant.confidence || 0) * 100)}%</span>
              <span className="chip chip-ghost">Бюджет: {usd(assistant.budget, 2)}</span>
              <span className="chip chip-ghost">Период: {assistant.periodDays} дн.</span>
            </div>
            {assistant.rationale ? <p style={{ marginTop: 10 }}>{assistant.rationale}</p> : null}
            {assistant.recommendations.length ? <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>{assistant.recommendations.map((item, idx) => <li key={`${item}-${idx}`}>{item}</li>)}</ul> : null}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Расчеты</p>
            <h2>Медиасплит и расчётные метрики</h2>
          </div>
          <div className="warnings" id="warnings">
            {!warnings.length ? <span className="chip chip-good">Валидации пройдены</span> : warnings.map((w, i) => <span className="chip chip-warn" key={`${w}-${i}`}>{w}</span>)}
          </div>
        </div>

        {!plan?.lines?.length ? (
          <p className="muted">Пока нет данных. Выполните расчет.</p>
        ) : (
          <div className="table-wrapper">
            <table className="table" id="plan-table">
              <thead>
                <tr>
                  <th>Платформа</th>
                  <th>Зачем канал</th>
                  {planMode === 'strategy' ? <th>Доля</th> : null}
                  <th>Бюджет (net)</th>
                  <th>Комиссия/VAT</th>
                  <th>Пополнение (gross)</th>
                  <th>Охват</th>
                  <th>Показы</th>
                  <th>Клики</th>
                  <th>Лиды</th>
                  <th>Конв.</th>
                  {planMode === 'strategy' ? <th>CPM</th> : null}
                  {planMode === 'strategy' ? <th>CPC</th> : null}
                  {planMode === 'strategy' ? <th>CVR</th> : null}
                </tr>
              </thead>
              <tbody>
                {plan.lines.map((line) => {
                  const overhead = (line.budget || 0) * (feeRate + vatRate)
                  const gross = (line.budget || 0) + overhead
                  return (
                    <tr key={line.key + line.name}>
                      <td>{line.name}</td>
                      <td>{line.rationale || '—'}</td>
                      {planMode === 'strategy' ? <td>{pct(line.share)}</td> : null}
                      <td>{usd(line.budget, 2)}</td>
                      <td>{usd(overhead, 2)}</td>
                      <td>{usd(gross, 2)}</td>
                      <td>{num(line.reach)}</td>
                      <td>{num(line.impressions)}</td>
                      <td>{num(line.clicks)}</td>
                      <td>{num(line.leads)}</td>
                      <td>{num(line.conversions)}</td>
                      {planMode === 'strategy' ? <td>{line.cpm != null ? usd(line.cpm, 2) : '—'}</td> : null}
                      {planMode === 'strategy' ? <td>{line.cpc != null ? usd(line.cpc, 2) : '—'}</td> : null}
                      {planMode === 'strategy' ? <td>{line.cvr != null ? `${(Number(line.cvr) * 100).toFixed(2)}%` : '—'}</td> : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {planMode === 'strategy' && flightData ? (
        <section className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Бюджет по периодам</p>
              <h2>Месяцы и недели</h2>
            </div>
            <span className="chip chip-ghost">Авто-сплит по period_days</span>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Платформа</th>
                  {Array.from({ length: monthsCount }, (_, i) => <th key={`m-head-${i}`}>M{i + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {flightData.monthRows.map((row) => (
                  <tr key={`m-row-${row.name}`}>
                    <td>{row.name}</td>
                    {row.values.map((v, i) => <td key={`m-${row.name}-${i}`}>{usd(v, 2)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="collapse" style={{ marginTop: 12 }}>
            <summary>Показать поквартально/недельно ({flightData.weeksCount} нед.)</summary>
            <div className="table-wrapper" style={{ marginTop: 8 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Платформа</th>
                    {Array.from({ length: flightData.weeksCount }, (_, i) => <th key={`w-head-${i}`}>W{i + 1}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {flightData.weekRows.map((row) => (
                    <tr key={`w-row-${row.name}`}>
                      <td>{row.name}</td>
                      {row.values.map((v, i) => <td key={`w-${row.name}-${i}`}>{usd(v, 2)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <p className="muted" style={{ marginTop: 10 }}>Итого к оплате (gross): {usd(totalGross, 2)} за {payload.period_days} дней</p>
        </section>
      ) : null}
    </AppShell>
  )
}
