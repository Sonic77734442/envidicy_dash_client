const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

const platformOrder = ['meta', 'google', 'tiktok', 'telegram', 'yandex', 'monochrome']

const assumptionProfiles = {
  base: {
    meta: { cpm: 2.1, ctr: 0.013, cvr: 0.016 },
    google_search: { cpc: 0.55, cvr: 0.028 },
    telegram: { cpm: 2.5, ctr: 0.012 },
  },
  conservative: {
    meta: { cpm: 2.5, ctr: 0.010, cvr: 0.012 },
    google_search: { cpc: 0.7, cvr: 0.02 },
    telegram: { cpm: 3.0, ctr: 0.009 },
  },
  aggressive: {
    meta: { cpm: 1.8, ctr: 0.016, cvr: 0.02 },
    google_search: { cpc: 0.45, cvr: 0.035 },
    telegram: { cpm: 2.0, ctr: 0.015 },
  },
}

renderHeader({
  eyebrow: 'Envidicy · Media Plan HQ',
  title: 'План, факт и сценарии',
  subtitle: 'Соберите медиасплит, KPI, сценарии бюджета и weekly plan/fact в одном месте.',
  buttons: [
    { label: 'Пересчитать план', id: 'btn-estimate', kind: 'primary' },
    { label: 'Скачать Excel', id: 'btn-excel', kind: 'ghost' },
    { label: 'Дашборд', href: '/dashboard', kind: 'ghost' },
    { label: 'Пополнить аккаунты', href: '/topup', kind: 'ghost' },
    { label: 'Финансы', href: '/funds', kind: 'ghost' },
    { label: 'Вход', href: '/login', kind: 'ghost' },
  ],
})

const state = {
  plan: null,
  weekly: [],
  unmatched: [],
  agencyMode: false,
  activePlatform: null,
  planMode: 'smart',
  aiDraft: null,
  aiDraftApply: false,
  placements: {
    meta: new Set(['fb_feed', 'fb_video_feeds', 'fb_instream', 'fb_reels', 'fb_stories', 'ig_feed', 'ig_reels', 'ig_stories']),
    google: new Set(['google_search', 'google_display_cpm', 'google_display_cpc', 'google_shopping', 'youtube_15s', 'youtube_30s']),
    tiktok: new Set(['tiktok']),
    telegram: new Set(['telegrad_channels', 'telegrad_users', 'telegrad_bots', 'telegrad_search']),
    yandex: new Set(['yandex_search', 'yandex_display']),
    monochrome: new Set(),
  },
  monthPlatforms: [],
}

const usd = (v, d = 0) => `$${(v ?? 0).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d })}`
const num = (v, d = 0) => (v ?? 0).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (v) => `${(v * 100).toFixed(1)}%`

function authHeaders() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function fetchPlan() {
  const payload = readPayload()
  const res = await fetch(`${apiBase}/plans/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to fetch plan')
  const data = await res.json()
  state.plan = data
  renderPlan()
  renderAiAssistant()
}

function chooseAiProfile(payload) {
  const goal = String(payload.goal || '').toLowerCase()
  const budget = Number(payload.budget || 0)
  if (goal === 'reach') return 'conservative'
  if (goal === 'traffic') return budget >= 5000 ? 'base' : 'aggressive'
  if (goal === 'conversions' || goal === 'sales') return budget >= 4000 ? 'base' : 'aggressive'
  return 'base'
}

function applyAiDefaults(payload, profileKey) {
  const setVal = (id, val) => {
    const el = document.getElementById(id)
    if (!el || val == null) return
    el.value = val
  }
  const setIfEmpty = (id, val) => {
    const el = document.getElementById(id)
    if (!el || el.value) return
    el.value = val
  }

  setVal('assumption-profile', profileKey)
  applyAssumptionProfile(profileKey)

  const goal = String(payload.goal || '').toLowerCase()
  if (goal === 'reach') {
    setVal('split-awareness', 55)
    setVal('split-consideration', 30)
    setVal('split-performance', 15)
  } else if (goal === 'traffic') {
    setVal('split-awareness', 35)
    setVal('split-consideration', 40)
    setVal('split-performance', 25)
  } else if (goal === 'conversions' || goal === 'sales') {
    setVal('split-awareness', 20)
    setVal('split-consideration', 30)
    setVal('split-performance', 50)
  } else {
    setVal('split-awareness', 25)
    setVal('split-consideration', 35)
    setVal('split-performance', 40)
  }

  setIfEmpty('assumption-benchmarks', 'Historical Envidicy benchmarks')
  setIfEmpty('assumption-history', 'Client campaign history')
  setIfEmpty('assumption-method', 'Weighted mix by objective and benchmark efficiency')
  setIfEmpty('assumption-recalc', 'Recalculate after 7 days using first factual spend and CTR/CPC')
}

async function runAiDraft() {
  const payload = readPayload()
  state.aiDraftApply = true
  try {
    const res = await fetch(`${apiBase}/plans/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('assistant request failed')
    const draft = await res.json()
    applyAiAssistantDraft(draft, payload)
  } catch (e) {
    const profileKey = chooseAiProfile(payload)
    applyAiDefaults(payload, profileKey)
    state.aiDraft = {
      source: 'fallback',
      profile: profileKey,
      createdAt: new Date().toISOString(),
      objective: payload.goal || 'leads',
      periodDays: payload.period_days || 30,
      budget: payload.budget || 0,
      recommendations: ['LLM недоступен: применен локальный fallback-профиль.'],
      confidence: 0.6,
    }
  }
  await fetchPlan()
}

function applyAiAssistantDraft(draft, payload) {
  const setVal = (id, val) => {
    const el = document.getElementById(id)
    if (!el || val == null) return
    el.value = val
  }
  const applyChannelInputs = (inputs) => {
    if (!inputs || typeof inputs !== 'object') return
    const meta = inputs.meta || {}
    setVal('meta-cpm', meta.cpm)
    setVal('meta-ctr', meta.ctr)
    setVal('meta-cvr', meta.cvr)
    const g = inputs.google_search || {}
    setVal('gsearch-cpc', g.cpc)
    setVal('gsearch-cvr', g.cvr)
    const tg = inputs.telegrad_channels || inputs.telegram || {}
    setVal('tg-cpm', tg.cpm)
    setVal('tg-ctr', tg.ctr)
  }
  const profile = draft?.assumption_profile || chooseAiProfile(payload)
  setVal('assumption-profile', profile)
  applyAssumptionProfile(profile)
  const split = draft?.funnel_split || {}
  setVal('split-awareness', split.awareness)
  setVal('split-consideration', split.consideration)
  setVal('split-performance', split.performance)

  const assumptions = draft?.assumptions || {}
  setVal('assumption-benchmarks', assumptions.benchmarks)
  setVal('assumption-history', assumptions.history)
  setVal('assumption-method', assumptions.methodology)
  setVal('assumption-recalc', assumptions.recalc)
  applyChannelInputs(draft?.channel_inputs)

  state.aiDraft = {
    source: draft?.source || 'fallback',
    profile,
    createdAt: new Date().toISOString(),
    objective: payload.goal || 'leads',
    periodDays: payload.period_days || 30,
    budget: payload.budget || 0,
    recommendations: Array.isArray(draft?.recommendations) ? draft.recommendations : [],
    rationale: typeof draft?.rationale === 'string' ? draft.rationale : '',
    confidence: typeof draft?.confidence === 'number' ? draft.confidence : 0.6,
    budgetSplit: draft?.budget_split || {},
    channelInputs: draft?.channel_inputs || {},
    factsUsed: Boolean(draft?.facts_used),
    factsPeriod: draft?.facts_period || null,
    factsTotals: draft?.facts_totals || {},
    globalFactsUsed: Boolean(draft?.global_facts_used),
    globalFactsPeriod: draft?.global_facts_period || null,
    globalFactsTotals: draft?.global_facts_totals || {},
    globalFactsDebug: draft?.global_facts_debug || {},
  }
}

function renderAiAssistant() {
  const box = document.getElementById('ai-assistant-output')
  if (!box) return
  if (!state.plan) {
    box.classList.add('muted')
    box.innerHTML = 'Нажмите «AI-черновик», чтобы получить рекомендации.'
    return
  }
  const draft = state.aiDraft || {}
  const topLines = [...(state.plan.lines || [])]
    .sort((a, b) => Number(b.budget || 0) - Number(a.budget || 0))
    .slice(0, 3)
  const chips = topLines
    .map((line) => {
      const share = Number(line.share || 0) * 100
      return `<span class="chip chip-ghost">${line.name}: ${share.toFixed(1)}%</span>`
    })
    .join('')

  const totals = state.plan.totals || {}
  const cpl = totals.leads ? totals.budget / totals.leads : null
  const cpa = totals.conversions ? totals.budget / totals.conversions : null
  const recommendations = Array.isArray(draft.recommendations) ? draft.recommendations : []
  const rationale = typeof draft.rationale === 'string' ? draft.rationale : ''
  const recRows = recommendations.length
    ? recommendations.map((r) => `<li>${r}</li>`).join('')
    : '<li>Добавьте фактические данные и запустите AI-черновик снова.</li>'
  const factsUsed = Boolean(draft.factsUsed)
  const factsTotals = draft.factsTotals && typeof draft.factsTotals === 'object' ? draft.factsTotals : {}
  const globalFactsUsed = Boolean(draft.globalFactsUsed)
  const globalFactsTotals =
    draft.globalFactsTotals && typeof draft.globalFactsTotals === 'object' ? draft.globalFactsTotals : {}
  const globalFactsDebug =
    draft.globalFactsDebug && typeof draft.globalFactsDebug === 'object' ? draft.globalFactsDebug : {}
  const factsRows = Object.entries(factsTotals)
    .map(([platform, row]) => {
      const spend = row && typeof row === 'object' ? Number(row.spend || 0) : 0
      const impressions = row && typeof row === 'object' ? Number(row.impressions || 0) : 0
      const clicks = row && typeof row === 'object' ? Number(row.clicks || 0) : 0
      return `<tr><td>${platform}</td><td>${usd(spend, 2)}</td><td>${num(impressions)}</td><td>${num(clicks)}</td></tr>`
    })
    .join('')
  const globalFactsRows = Object.entries(globalFactsTotals)
    .map(([platform, row]) => {
      const spend = row && typeof row === 'object' ? Number(row.spend || 0) : 0
      const impressions = row && typeof row === 'object' ? Number(row.impressions || 0) : 0
      const clicks = row && typeof row === 'object' ? Number(row.clicks || 0) : 0
      return `<tr><td>${platform}</td><td>${usd(spend, 2)}</td><td>${num(impressions)}</td><td>${num(clicks)}</td></tr>`
    })
    .join('')
  const globalDebugRows = Object.entries(globalFactsDebug)
    .map(([platform, row]) => {
      if (!row || typeof row !== 'object') return ''
      const accountsTotal = Number(row.accounts_total || 0)
      const usedIds = Number(row.used_ids || 0)
      const missingId = Number(row.missing_id || 0)
      const apiOk = Number(row.api_ok || 0)
      const apiFailed = Number(row.api_failed || 0)
      const lastError = row.last_error ? String(row.last_error) : '—'
      return `<tr><td>${platform}</td><td>${accountsTotal}</td><td>${usedIds}</td><td>${missingId}</td><td>${apiOk}</td><td>${apiFailed}</td><td>${lastError}</td></tr>`
    })
    .filter(Boolean)
    .join('')
  box.classList.remove('muted')
  box.innerHTML = `
    <div class="chips small">
      <span class="chip chip-ghost">Источник: ${draft.source || 'manual'}</span>
      <span class="chip chip-ghost">Профиль: ${draft.profile || 'manual'}</span>
      <span class="chip chip-ghost">Цель: ${draft.objective || 'n/a'}</span>
      <span class="chip chip-ghost">Период: ${draft.periodDays || state.plan.period_days || 30} дн.</span>
      <span class="chip chip-ghost">Бюджет: ${usd(draft.budget || state.plan.budget_usd || 0, 2)}</span>
      <span class="chip chip-ghost">Confidence: ${Math.round((draft.confidence || 0) * 100)}%</span>
      <span class="chip ${factsUsed ? 'chip-good' : 'chip-ghost'}">Факт из аккаунтов: ${factsUsed ? 'учтен' : 'не учтен'}</span>
      ${draft.factsPeriod ? `<span class="chip chip-ghost">Период факта: ${draft.factsPeriod}</span>` : ''}
      <span class="chip ${globalFactsUsed ? 'chip-good' : 'chip-ghost'}">Global pool: ${globalFactsUsed ? 'учтен' : 'не учтен'}</span>
      ${draft.globalFactsPeriod ? `<span class="chip chip-ghost">Период global: ${draft.globalFactsPeriod}</span>` : ''}
    </div>
    <div class="chips small" style="margin-top:8px;">${chips || '<span class="chip chip-ghost">Нет рекомендаций по сплиту</span>'}</div>
    ${rationale ? `<div style="margin-top:8px;"><strong>Rationale:</strong> ${rationale}</div>` : ''}
    <div style="margin-top:8px;">
      <ul style="margin:0;padding-left:18px;">${recRows}</ul>
    </div>
    ${
      factsRows
        ? `<div class="table-wrapper" style="margin-top:10px;">
      <table class="table">
        <thead>
          <tr>
            <th>Платформа</th>
            <th>Spend (факт)</th>
            <th>Impressions</th>
            <th>Clicks</th>
          </tr>
        </thead>
        <tbody>${factsRows}</tbody>
      </table>
    </div>`
        : ''
    }
    ${
      globalFactsRows
        ? `<div class="table-wrapper" style="margin-top:10px;">
      <table class="table">
        <thead>
          <tr>
            <th>Global pool</th>
            <th>Spend (факт)</th>
            <th>Impressions</th>
            <th>Clicks</th>
          </tr>
        </thead>
        <tbody>${globalFactsRows}</tbody>
      </table>
    </div>`
        : ''
    }
    ${
      globalDebugRows
        ? `<div class="table-wrapper" style="margin-top:10px;">
      <table class="table">
        <thead>
          <tr>
            <th>Global debug</th>
            <th>Accounts</th>
            <th>Used IDs</th>
            <th>Missing ID</th>
            <th>API OK</th>
            <th>API Failed</th>
            <th>Last error</th>
          </tr>
        </thead>
        <tbody>${globalDebugRows}</tbody>
      </table>
    </div>`
        : ''
    }
    <div class="table-wrapper" style="margin-top:10px;">
      <table class="table">
        <thead>
          <tr>
            <th>Метрика</th>
            <th>Значение</th>
            <th>Комментарий</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Прогноз CPL</td><td>${cpl ? usd(cpl, 2) : '—'}</td><td>Оценка по текущему сплиту и вводным</td></tr>
          <tr><td>Прогноз CPA</td><td>${cpa ? usd(cpa, 2) : '—'}</td><td>Оценка по текущему сплиту и вводным</td></tr>
          <tr><td>Следующий шаг</td><td>Загрузить факт через 7 дней</td><td>Пересчитать план по реальным CTR/CPC/CVR</td></tr>
        </tbody>
      </table>
    </div>
  `
}

function readPayload() {
  const mode = getPlanMode()
  const funnelSplit = {
    awareness: document.getElementById('split-awareness')?.value
      ? Number(document.getElementById('split-awareness').value)
      : null,
    consideration: document.getElementById('split-consideration')?.value
      ? Number(document.getElementById('split-consideration').value)
      : null,
    performance: document.getElementById('split-performance')?.value
      ? Number(document.getElementById('split-performance').value)
      : null,
  }
  const hasSplit = Object.values(funnelSplit).some((v) => typeof v === 'number' && !Number.isNaN(v))
  const channelInputs = {}
  const metaCpm = document.getElementById('meta-cpm')?.value ? Number(document.getElementById('meta-cpm').value) : null
  const metaCtr = document.getElementById('meta-ctr')?.value ? Number(document.getElementById('meta-ctr').value) : null
  const metaCvr = document.getElementById('meta-cvr')?.value ? Number(document.getElementById('meta-cvr').value) : null
  if (metaCpm || metaCtr || metaCvr) {
    channelInputs.meta = { cpm: metaCpm, ctr: metaCtr, cvr: metaCvr }
  }
  const gCpc = document.getElementById('gsearch-cpc')?.value ? Number(document.getElementById('gsearch-cpc').value) : null
  const gCvr = document.getElementById('gsearch-cvr')?.value ? Number(document.getElementById('gsearch-cvr').value) : null
  if (gCpc || gCvr) {
    channelInputs.google_search = { cpc: gCpc, cvr: gCvr }
  }
  const tgCpm = document.getElementById('tg-cpm')?.value ? Number(document.getElementById('tg-cpm').value) : null
  const tgCtr = document.getElementById('tg-ctr')?.value ? Number(document.getElementById('tg-ctr').value) : null
  if (tgCpm || tgCtr) {
    channelInputs.telegram = { cpm: tgCpm, ctr: tgCtr }
  }
  const hasChannelInputs = Object.keys(channelInputs).length > 0
  const rawAssumptions = {
    benchmarks: document.getElementById('assumption-benchmarks')?.value?.trim() || null,
    history: document.getElementById('assumption-history')?.value?.trim() || null,
    methodology: document.getElementById('assumption-method')?.value?.trim() || null,
    recalc: document.getElementById('assumption-recalc')?.value?.trim() || null,
  }
  const assumptions = Object.fromEntries(Object.entries(rawAssumptions).filter(([, v]) => v))
  const hasAssumptions = Object.keys(assumptions).length > 0
  const aiBudgetSplit =
    state.aiDraftApply && state.aiDraft?.budgetSplit && Object.keys(state.aiDraft.budgetSplit).length
      ? state.aiDraft.budgetSplit
      : null
  if (mode === 'smart') {
    const smartGoal = document.getElementById('smart-goal')?.value || 'leads'
    const mappedGoal = smartGoal === 'sales' ? 'conversions' : smartGoal
    const periodDays = Number(document.getElementById('smart-period')?.value) || 30
    const startDate = new Date()
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + periodDays - 1)
    return {
      plan_mode: 'smart',
      business_type: document.getElementById('smart-business')?.value || null,
      goal: mappedGoal,
      budget: Number(document.getElementById('smart-budget')?.value) || 0,
      currency: 'USD',
      market: document.getElementById('smart-market')?.value || 'kz',
      country: document.getElementById('smart-market')?.value || 'kz',
      period_days: periodDays,
      date_start: startDate.toISOString().slice(0, 10),
      date_end: endDate.toISOString().slice(0, 10),
      avg_frequency: 1.6,
      pricing_mode: 'auto',
      budget_split: aiBudgetSplit,
    }
  }

  return {
    plan_mode: 'strategy',
    company: document.getElementById('brand')?.value || 'Client',
    client_name: document.getElementById('client-name')?.value || null,
    brand: document.getElementById('brand')?.value || null,
    product: document.getElementById('product')?.value || null,
    budget: Number(document.getElementById('budget').value) || 0,
    goal: document.getElementById('goal').value,
    avg_frequency: Number(document.getElementById('freq').value) || 1.6,
    period_days: Number(document.getElementById('period').value) || 30,
    date_start: document.getElementById('date-start').value || null,
    date_end: document.getElementById('date-end').value || null,
    targeting_depth: document.getElementById('depth').value,
    seasonality: Number(document.getElementById('seasonality').value) || 1.0,
    pricing_mode: document.getElementById('pricing').value,
    platforms: derivePlatforms(),
    placements: serializePlacements(),
    kpi_type: document.getElementById('kpi-type').value,
    kpi_target: Number(document.getElementById('kpi-target').value) || null,
    match_strategy: document.getElementById('match').value,
    currency: document.getElementById('currency').value,
    fx_rate: document.getElementById('fx').value ? Number(document.getElementById('fx').value) : null,
    market: document.getElementById('market')?.value || null,
    country: document.getElementById('market')?.value || 'kz',
    cities: document.getElementById('cities').value
      ? document.getElementById('cities').value.split(',').map((c) => c.trim())
      : [],
    interests: document.getElementById('interests').value
      ? document.getElementById('interests').value.split(',').map((c) => c.trim())
      : [],
    age_min: document.getElementById('age-min').value ? Number(document.getElementById('age-min').value) : null,
    age_max: document.getElementById('age-max').value ? Number(document.getElementById('age-max').value) : null,
    industry: document.getElementById('industry').value,
    geo_split: document.getElementById('geo-split')?.value?.trim() || null,
    audience_size: document.getElementById('audience-size')?.value
      ? Number(document.getElementById('audience-size').value)
      : null,
    creative_count: document.getElementById('creative-count')?.value
      ? Number(document.getElementById('creative-count').value)
      : null,
    author: document.getElementById('author')?.value || '',
    ltv_per_conversion: document.getElementById('ltv')?.value ? Number(document.getElementById('ltv').value) : null,
    utm_template: document.getElementById('utm')?.value || '',
    pixels_configured: Boolean(document.getElementById('pixels')?.checked),
    agency_fee_percent: document.getElementById('fee')?.value ? Number(document.getElementById('fee').value) : null,
    vat_percent: document.getElementById('vat')?.value ? Number(document.getElementById('vat').value) : null,
    monthly_platforms: state.agencyMode ? serializeMonths() : null,
    funnel_split: hasSplit ? funnelSplit : null,
    channel_inputs: hasChannelInputs ? channelInputs : null,
    assumption_profile: document.getElementById('assumption-profile')?.value || null,
    assumptions: hasAssumptions ? assumptions : null,
    budget_split: aiBudgetSplit,
  }
}

function renderPlan() {
  if (!state.plan) return
  const payload = readPayload()
  const fee = payload.agency_fee_percent ? payload.agency_fee_percent / 100 : 0
  const vat = payload.vat_percent ? payload.vat_percent / 100 : 0
  const tableBody = document.querySelector('#plan-table tbody')
  tableBody.innerHTML = ''
  state.plan.lines.forEach((l) => {
    const overhead = l.budget * (fee + vat)
    const gross = l.budget + overhead
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td>${l.name}</td>
      <td class="smart-only">${l.rationale || '—'}</td>
      <td class="strategy-only">${pct(l.share)}</td>
      <td>${usd(l.budget)}</td>
      <td>${usd(overhead)}</td>
      <td>${usd(gross)}</td>
      <td>${num(l.reach)}</td>
      <td>${num(l.impressions)}</td>
      <td>${num(l.clicks)}</td>
      <td>${num(l.leads)}</td>
      <td>${num(l.conversions)}</td>
      <td class="strategy-only">${usd(l.cpm, 2)}</td>
      <td class="strategy-only">${usd(l.cpc, 2)}</td>
      <td class="strategy-only">${(l.cvr * 100).toFixed(2)}%</td>
    `
    tableBody.appendChild(tr)
  })

  const cards = document.getElementById('kpi-cards')
  cards.innerHTML = ''
  const totals = state.plan.totals
  const totalOverhead = totals.budget * (fee + vat)
  const totalGross = totals.budget + totalOverhead
  const items = [
    { title: 'Бюджет (net)', value: usd(totals.budget), subtitle: 'План' },
    { title: 'Комиссия/VAT', value: usd(totalOverhead), subtitle: 'План' },
    { title: 'Бюджет (gross)', value: usd(totalGross), subtitle: 'План' },
    { title: 'Охват', value: num(totals.reach), subtitle: 'План' },
    { title: 'Клики', value: num(totals.clicks), subtitle: 'План' },
    { title: 'Лиды', value: num(totals.leads), subtitle: 'План' },
    { title: 'Конверсии', value: num(totals.conversions), subtitle: 'План' },
  ]
  items.forEach((c) => {
    const div = document.createElement('div')
    div.className = 'stat'
    div.innerHTML = `<p class="eyebrow">${c.subtitle}</p><h3>${c.title}</h3><p class="stat-value">${c.value}</p>`
    cards.appendChild(div)
  })
  const outputBody = document.getElementById('output-summary')
  if (outputBody) {
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
    const flight =
      payload.date_start && payload.date_end ? `${payload.date_start} → ${payload.date_end}` : `${periodDays} дней`
    const mode = getPlanMode()
    const rows =
      mode === 'smart'
        ? [
            ['Budget (net/client)', usd(totals.budget), 'Гарантия'],
            ['Комиссия/VAT', usd(totalOverhead), 'Гарантия'],
            ['Budget (gross)', usd(totalGross), 'Гарантия'],
            ['Clicks', num(clicks), 'Прогноз'],
            ['Leads', num(leads), 'Прогноз'],
            ['CPL', cpl ? usd(cpl, 2) : '—', 'Прогноз'],
            ['CPA', cpa ? usd(cpa, 2) : '—', 'Прогноз'],
          ]
        : [
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
            ['Flight', flight, 'Прогноз'],
            ['Pacing / day', budgetPerDay ? usd(budgetPerDay, 2) : '—', 'Прогноз'],
            ['Pacing / week', budgetPerWeek ? usd(budgetPerWeek, 2) : '—', 'Прогноз'],
            ['Assumption profile', payload.assumption_profile || '—', 'Прогноз'],
          ]
    outputBody.innerHTML = rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')
  }
  renderWarnings()
  renderFlight(payload)
}

function renderWarnings() {
  const container = document.getElementById('warnings')
  if (!container || !state.plan) return
  const warnings = []
  const totals = state.plan.totals
  const totalFreq = totals.reach ? totals.impressions / totals.reach : null
  if (totalFreq && totalFreq > 8) warnings.push('Частота > 8: возможен перегрев аудитории.')
  if (totals.clicks > totals.impressions) warnings.push('Клики больше показов: проверьте вводные CTR/CPC.')
  if (totals.leads > totals.clicks) warnings.push('Лидов больше кликов: проверьте CVR.')
  if (totals.conversions > totals.leads) warnings.push('Конверсий больше лидов: проверьте post-click/CVR.')
  state.plan.lines.forEach((line) => {
    const ctr = line.impressions ? line.clicks / line.impressions : 0
    const cvr = line.clicks ? line.leads / line.clicks : 0
    const cpa = line.leads ? line.budget / line.leads : null
    if (ctr > 0.1) warnings.push(`${line.name}: CTR > 10% — проверьте реалистичность.`)
    if (cvr > 0.4) warnings.push(`${line.name}: CVR > 40% — проверьте реалистичность.`)
    if (line.reach && line.impressions / line.reach > 8) warnings.push(`${line.name}: Frequency > 8.`)
    if (cpa && cpa < 0.5) warnings.push(`${line.name}: CPA < $0.5 — проверьте реалистичность.`)
  })
  if (!warnings.length) {
    container.innerHTML = '<span class="chip chip-ghost">Валидации пройдены</span>'
    return
  }
  container.innerHTML = warnings.map((w) => `<span class="chip chip-warn">${w}</span>`).join('')
}

async function downloadExcel() {
  const payload = readPayload()
  const res = await fetch(`${apiBase}/plans/estimate/excel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err?.detail ? ` (${err.detail})` : ''
    } catch (e) {
      // ignore
    }
    alert(`Ошибка экспорта Excel: ${res.status}${detail}`)
    return
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mediaplan.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

async function uploadFact() {
  const fileInput = document.getElementById('fact-file')
  if (!fileInput.files?.length) return
  const file = fileInput.files[0]
  const payload = readPayload()
  const form = new FormData()
  form.append('file', file)
  form.append('plan_payload', new Blob([JSON.stringify(payload)], { type: 'application/json' }))
  // backend expects plan payload separately; for simplicity we call fact/weekly/excel
  const res = await fetch(`${apiBase}/fact/weekly/excel`, {
    method: 'POST',
    body: form,
  })
  if (res.ok) {
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plan_vs_fact.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }
}

function bind() {
  document.querySelectorAll('#btn-estimate').forEach((btn) =>
    btn.addEventListener('click', () => {
      state.aiDraftApply = false
      fetchPlan()
    })
  )
  document.querySelectorAll('#btn-ai-draft').forEach((btn) => btn.addEventListener('click', runAiDraft))
  document.querySelectorAll('#btn-excel').forEach((btn) => btn.addEventListener('click', downloadExcel))
  const modeSelect = document.getElementById('plan-mode')
  if (modeSelect) {
    modeSelect.addEventListener('change', (e) => {
      state.planMode = e.target.value
      applyPlanModeUI()
    })
  }
  const placementContainer = document.getElementById('placement-container')
  placementContainer.addEventListener('change', onPlacementToggle)
  const monthGrid = document.getElementById('month-grid')
  monthGrid.addEventListener('change', onMonthToggle)
  const toggleAgency = document.getElementById('toggle-agency')
  toggleAgency.addEventListener('change', onToggleAgency)
  const periodInput = document.getElementById('period')
  const startInput = document.getElementById('date-start')
  periodInput.addEventListener('change', onPeriodChange)
  startInput.addEventListener('change', onPeriodChange)
  const profileSelect = document.getElementById('assumption-profile')
  if (profileSelect) profileSelect.addEventListener('change', onAssumptionProfileChange)
  document.querySelectorAll('.form-grid input, .form-grid select').forEach((el) => {
    el.addEventListener('change', () => {
      const payload = readPayload()
      renderChips(payload)
      renderMonths()
      renderFlight(payload)
    })
  })
}

function onAssumptionProfileChange(e) {
  const profileKey = e.target.value
  applyAssumptionProfile(profileKey)
}

function applyAssumptionProfile(profileKey) {
  const profile = assumptionProfiles[profileKey]
  if (!profile) return
  const meta = profile.meta || {}
  const gsearch = profile.google_search || {}
  const tg = profile.telegram || {}
  const setVal = (id, val) => {
    const el = document.getElementById(id)
    if (el && val != null) el.value = val
  }
  setVal('meta-cpm', meta.cpm)
  setVal('meta-ctr', meta.ctr)
  setVal('meta-cvr', meta.cvr)
  setVal('gsearch-cpc', gsearch.cpc)
  setVal('gsearch-cvr', gsearch.cvr)
  setVal('tg-cpm', tg.cpm)
  setVal('tg-ctr', tg.ctr)
}

function init() {
  bind()
  state.planMode = getPlanMode()
  applyPlanModeUI()
  ensureMonthDefaults()
  renderPlan()
  renderPlacements()
  renderMonths()
  applyAgencyVisibility()
  const toggleAgency = document.getElementById('toggle-agency')
  if (toggleAgency) toggleAgency.checked = state.agencyMode
  renderChips(readPayload())
  renderAiAssistant()
}

function getPlanMode() {
  const modeEl = document.getElementById('plan-mode')
  return modeEl?.value || state.planMode || 'smart'
}

function applyPlanModeUI() {
  const mode = getPlanMode()
  document.body.classList.toggle('mode-smart', mode === 'smart')
  document.body.classList.toggle('mode-strategy', mode === 'strategy')
  const appRoot = document.querySelector('.app')
  if (appRoot) {
    appRoot.classList.toggle('mode-smart', mode === 'smart')
    appRoot.classList.toggle('mode-strategy', mode === 'strategy')
  }
}

function derivePlatforms() {
  return placementsToPlatforms()
}

function getMonthsCount() {
  const days = Number(document.getElementById('period').value) || 30
  return Math.max(1, Math.ceil(days / 30))
}

const placementOptions = {
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
  monochrome: [],
}

function renderPlacements() {
  const container = document.getElementById('placement-container')
  container.innerHTML = ''
  platformOrder.forEach((platform) => {
    const card = document.createElement('div')
    const disabled = state.activePlatform && state.activePlatform !== platform
    card.className = `placement-card ${disabled ? 'disabled' : ''}`
    card.innerHTML = `<div class="placement-title">${platformLabel(platform)}</div>`
    const list = document.createElement('div')
    list.className = 'placement-options'
    placementOptions[platform].forEach((pl) => {
      const label = document.createElement('label')
      label.className = 'placement-option'
      label.innerHTML = `<input type="checkbox" value="${pl.key}" ${state.placements?.[platform]?.has(pl.key) ? 'checked' : ''} ${
        disabled ? 'disabled' : ''
      }/> <span>${pl.label}</span>`
      list.appendChild(label)
    })
    card.appendChild(list)
    container.appendChild(card)
  })
}

function onPlacementToggle(e) {
  const target = e.target
  if (target instanceof HTMLInputElement && target.type === 'checkbox') {
    const val = target.value
    const platform = platformOrder.find((p) => placementOptions[p].some((x) => x.key === val))
    if (!platform) return
    if (state.activePlatform && state.activePlatform !== platform) {
      return
    }
    if (!state.placements[platform]) {
      state.placements[platform] = new Set()
    }
    if (target.checked) state.placements[platform].add(val)
    else state.placements[platform].delete(val)
    renderMonths()
    renderFlight(readPayload())
  }
}

function serializePlacements() {
  const all = []
  if (state.activePlatform) {
    state.placements[state.activePlatform]?.forEach((pl) => all.push(pl))
  } else {
    platformOrder.forEach((p) => {
      state.placements[p]?.forEach((pl) => all.push(pl))
    })
  }
  return all
}

function serializeMonths() {
  ensureMonthDefaults()
  return state.monthPlatforms.map((set) => Array.from(set))
}

function placementsToPlatforms() {
  const set = new Set()
  const metaKeys = new Set(placementOptions.meta.map((p) => p.key))
  platformOrder.forEach((platform) => {
    const selected = state.placements[platform] || new Set()
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

function renderChips(payload) {
  const chips = document.getElementById('meta-chips')
  if (!chips) return
  chips.innerHTML = `
    <span class="chip">Currency: ${payload.currency}</span>
    <span class="chip chip-ghost">Goal: ${payload.goal}</span>
    <span class="chip chip-ghost">Period: ${payload.period_days} days</span>
    <span class="chip chip-ghost">Match: ${payload.match_strategy}</span>
  `
}

function ensureMonthDefaults() {
  const months = getMonthsCount()
  if (!Array.isArray(state.monthPlatforms) || state.monthPlatforms.length === 0) {
    const active = derivePlatforms()
    state.monthPlatforms = Array.from({ length: months }, () => new Set(active))
    return
  }
  if (state.monthPlatforms.length < months) {
    const active = derivePlatforms()
    for (let i = state.monthPlatforms.length; i < months; i += 1) {
      state.monthPlatforms.push(new Set(active))
    }
  } else if (state.monthPlatforms.length > months) {
    state.monthPlatforms = state.monthPlatforms.slice(0, months)
  }
}

function renderMonths() {
  const container = document.getElementById('month-grid')
  if (!container || !state.agencyMode) return
  ensureMonthDefaults()
  const months = getMonthsCount()
  const activePlatforms = Array.from(new Set(placementsToPlatforms()))
  const header = ['<th>Платформа</th>']
  for (let i = 0; i < months; i += 1) header.push(`<th>M${i + 1}</th>`)
  const rows = activePlatforms
    .map((p) => {
      const cells = []
      for (let m = 0; m < months; m += 1) {
        const checked = state.monthPlatforms[m]?.has(p) ? 'checked' : ''
        cells.push(
          `<td><input type="checkbox" data-month="${m}" data-platform="${p}" ${checked} aria-label="M${m + 1} ${p}"/></td>`
        )
      }
      return `<tr><td>${platformLabel(p)}</td>${cells.join('')}</tr>`
    })
    .join('')
  container.innerHTML = `<div class="table-wrapper"><table class="month-table"><thead><tr>${header.join(
    ''
  )}</tr></thead><tbody>${rows}</tbody></table></div>`
}

function onMonthToggle(e) {
  const target = e.target
  if (!(target instanceof HTMLInputElement)) return
  const month = Number(target.dataset.month)
  const platform = target.dataset.platform
  if (Number.isNaN(month) || !platform) return
  ensureMonthDefaults()
  if (!state.monthPlatforms[month]) state.monthPlatforms[month] = new Set()
  if (target.checked) state.monthPlatforms[month].add(platform)
  else state.monthPlatforms[month].delete(platform)
  renderFlight(readPayload())
}

function onPeriodChange() {
  const period = Number(document.getElementById('period').value) || 0
  const startVal = document.getElementById('date-start').value
  if (period > 0 && startVal) {
    const start = new Date(startVal)
    const end = new Date(start)
    end.setDate(start.getDate() + period - 1)
    document.getElementById('date-end').value = end.toISOString().slice(0, 10)
  }
  ensureMonthDefaults()
  renderMonths()
  renderFlight(readPayload())
}

function onToggleAgency(e) {
  state.agencyMode = e.target.checked
  applyAgencyVisibility()
  renderMonths()
  renderFlight(readPayload())
}

function applyAgencyVisibility() {
  const wrap = document.getElementById('month-grid-wrap')
  const panel = document.getElementById('month-panel')
  if (wrap) wrap.classList.toggle('hidden', !state.agencyMode)
  if (panel) panel.classList.toggle('hidden', false)
}

function renderFlight(payload) {
  const container = document.getElementById('flight-container')
  if (!container || !state.plan) return
  const weeksCount = Math.max(1, Math.ceil(payload.period_days / 7))
  const monthsCount = Math.max(1, Math.ceil(payload.period_days / 30))
  const fee = payload.agency_fee_percent ? payload.agency_fee_percent / 100 : 0
  const vat = payload.vat_percent ? payload.vat_percent / 100 : 0

  const monthWeights = {}
  const months = state.agencyMode ? serializeMonths() : Array.from({ length: monthsCount }, () => placementsToPlatforms())
  const activePlatforms = placementsToPlatforms()
  activePlatforms.forEach((p) => {
    monthWeights[p] = Array.from({ length: monthsCount }, (_, idx) => {
      if (!months[idx]) return 1
      return months[idx].includes(p) ? 1 : 0
    })
    const total = monthWeights[p].reduce((a, b) => a + b, 0)
    if (total === 0) monthWeights[p] = monthWeights[p].map(() => 0)
    else monthWeights[p] = monthWeights[p].map((w) => w / total)
  })

  const weeklyHeader = Array.from({ length: weeksCount }, (_, i) => `<th>W${i + 1}</th>`).join('')
  const monthlyHeader = Array.from({ length: monthsCount }, (_, i) => `<th>M${i + 1}</th>`).join('')

  const weeklyRows = state.plan.lines
    .map((l) => {
      const weights = monthWeights[l.key] || Array(monthsCount).fill(1 / monthsCount)
      const monthBudgets = weights.map((w) => l.budget * w)
      const weekToMonth = Array.from({ length: weeksCount }, (_, idx) =>
        Math.min(monthsCount - 1, Math.floor((idx * 7) / 30))
      )
      const weeksInMonth = Array.from({ length: monthsCount }, () => 0)
      weekToMonth.forEach((m) => (weeksInMonth[m] += 1))
      const cells = weekToMonth
        .map((m) => {
          const div = weeksInMonth[m] || 1
          return `<td>${usd(monthBudgets[m] / div, 2)}</td>`
        })
        .join('')
      return `<tr><td>${l.name}</td>${cells}</tr>`
    })
    .join('')

  const monthlyRows = state.plan.lines
    .map((l) => {
      const weights = monthWeights[l.key] || Array(monthsCount).fill(1 / monthsCount)
      const cells = weights.map((w) => `<td>${usd(l.budget * w, 2)}</td>`).join('')
      return `<tr><td>${l.name}</td>${cells}</tr>`
    })
    .join('')

  const totalGross = state.plan.lines.reduce((acc, l) => acc + l.budget * (1 + fee + vat), 0)

  container.innerHTML = `
    <div class="table-wrapper">
      <table class="table">
        <thead><tr><th>Платформа</th>${monthlyHeader}</tr></thead>
        <tbody>${monthlyRows}</tbody>
      </table>
    </div>
    <details class="collapse">
      <summary>Показать поквартально/недельно (${weeksCount} нед.)</summary>
      <div class="table-wrapper">
        <table class="table">
          <thead><tr><th>Платформа</th>${weeklyHeader}</tr></thead>
          <tbody>${weeklyRows}</tbody>
        </table>
      </div>
    </details>
    <p class="muted">Итого к оплате (gross): ${usd(totalGross, 2)} за ${payload.period_days} дней</p>
  `
}

function platformLabel(key) {
  if (key === 'meta') return 'Meta (FB/IG)'
  if (key === 'google') return 'Google Ads'
  if (key === 'tiktok') return 'TikTok Ads'
  if (key === 'telegram') return 'Telegram Ads'
  if (key === 'yandex') return 'Яндекс Ads'
  if (key === 'monochrome') return 'Monochrome'
  if (key === 'yandex_search') return 'Яндекс Поиск'
  if (key === 'yandex_display') return 'Яндекс РСЯ'
  return key
}

init()
