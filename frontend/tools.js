renderHeader({
  eyebrow: 'Envidicy · Tools',
  title: 'Инструменты',
  subtitle: 'UTM генератор и будущий сокращатель ссылок.',
  buttons: [],
})

const tabs = document.querySelectorAll('.tab-button')
const panels = document.querySelectorAll('.tab-panel')

const single = {
  url: document.getElementById('utm-url'),
  source: document.getElementById('utm-source'),
  medium: document.getElementById('utm-medium'),
  campaign: document.getElementById('utm-campaign'),
  content: document.getElementById('utm-content'),
  term: document.getElementById('utm-term'),
  result: document.getElementById('utm-result'),
  generate: document.getElementById('utm-generate'),
  copy: document.getElementById('utm-copy'),
  reset: document.getElementById('utm-reset'),
  presets: document.getElementById('utm-presets'),
}

const bulk = {
  urls: document.getElementById('utm-bulk-urls'),
  source: document.getElementById('utm-bulk-source'),
  medium: document.getElementById('utm-bulk-medium'),
  campaign: document.getElementById('utm-bulk-campaign'),
  content: document.getElementById('utm-bulk-content'),
  term: document.getElementById('utm-bulk-term'),
  result: document.getElementById('utm-bulk-result'),
  generate: document.getElementById('utm-bulk-generate'),
  copy: document.getElementById('utm-bulk-copy'),
  export: document.getElementById('utm-bulk-export'),
  presets: document.getElementById('utm-bulk-presets'),
}

const presets = {
  meta: { source: 'meta', medium: 'cpc' },
  google: { source: 'google', medium: 'cpc' },
  tiktok: { source: 'tiktok', medium: 'cpc' },
  yandex: { source: 'yandex', medium: 'cpc' },
  telegram: { source: 'telegram', medium: 'cpm' },
  monochrome: { source: 'monochrome', medium: 'cpm' },
}

let singlePreset = null
let bulkPreset = null

const googleParams = [
  { key: '{adgroupid}', desc: 'Идентификатор группы объявлений' },
  { key: '{adposition}', desc: 'Позиция объявления на странице' },
  { key: '{campaignid}', desc: 'Идентификатор кампании' },
  { key: '{creative}', desc: 'Уникальный идентификатор объявления' },
  { key: '{device}', desc: 'Тип устройства' },
  { key: '{feeditemid}', desc: 'Идентификатор расширения' },
  { key: '{keyword}', desc: 'Ключевое слово' },
  { key: '{loc_interest_ms}', desc: 'Локация из запроса' },
  { key: '{loc_physical_ms}', desc: 'Физическая локация клика' },
  { key: '{lpurl}', desc: 'Конечный URL' },
  { key: '{matchtype}', desc: 'Тип соответствия ключевого слова' },
  { key: '{merchant_id}', desc: 'ID Merchant Center' },
  { key: '{placement}', desc: 'Сайт/место размещения' },
  { key: '{product_channel}', desc: 'Канал продаж товара' },
  { key: '{product_country}', desc: 'Страна продажи товара' },
  { key: '{product_id}', desc: 'ID товара' },
  { key: '{product_language}', desc: 'Язык товара' },
  { key: '{product_partition_id}', desc: 'ID группы товаров' },
  { key: '{store_code}', desc: 'Код магазина' },
  { key: '{targetid}', desc: 'ID цели/аудитории' },
]

const yandexParams = [
  { key: '{ad_id}', desc: 'Идентификатор объявления' },
  { key: '{banner_id}', desc: 'Идентификатор объявления (баннер)' },
  { key: '{addphrases}', desc: 'Доп. релевантные фразы: yes/no' },
  { key: '{addphrasestext}', desc: 'Текст доп. фразы или none' },
  { key: '{campaign_type}', desc: 'Тип кампании' },
  { key: '{campaign_id}', desc: 'Идентификатор кампании' },
  { key: '{creative_id}', desc: 'Идентификатор креатива' },
  { key: '{device_type}', desc: 'Тип устройства' },
  { key: '{gbid}', desc: 'Идентификатор группы' },
  { key: '{keyword}', desc: 'Ключевая фраза' },
  { key: '{phrase_id}', desc: 'Идентификатор ключевой фразы' },
  { key: '{retargeting_id}', desc: 'Идентификатор ретаргетинга' },
  { key: '{coef_goal_context_id}', desc: 'ID корректировки ставок' },
  { key: '{interest_id}', desc: 'ID интереса' },
  { key: '{adtarget_name}', desc: 'Условие нацеливания' },
  { key: '{adtarget_id}', desc: 'ID условия нацеливания' },
  { key: '{position}', desc: 'Позиция объявления' },
  { key: '{position_type}', desc: 'Тип блока' },
  { key: '{source}', desc: 'Площадка показа' },
  { key: '{source_type}', desc: 'Тип площадки' },
  { key: '{region_name}', desc: 'Регион показа' },
  { key: '{region_id}', desc: 'ID региона' },
]

let lastFocused = null

function activateTab(name) {
  tabs.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name)
  })
  panels.forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.tabPanel === name)
  })
}

tabs.forEach((btn) => {
  btn.addEventListener('click', () => activateTab(btn.dataset.tab))
})

document.addEventListener('focusin', (event) => {
  const el = event.target
  if (!el) return
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    lastFocused = el
  }
})

function applyPreset(target, key) {
  const preset = presets[key]
  if (!preset) return
  if (target === single) singlePreset = key
  if (target === bulk) bulkPreset = key
  if (target.source) target.source.value = preset.source
  if (target.medium) target.medium.value = preset.medium
  if (target.campaign && !target.campaign.value) {
    target.campaign.value = '{platform}_{date_ymd}'
  }
  if (target.content && !target.content.value) {
    target.content.value = '{platform}_{rand4}'
  }
}

function replaceMacros(value, context) {
  if (!value) return value
  const now = new Date()
  const dateYmd = now.toISOString().slice(0, 10)
  const dateYm = now.toISOString().slice(0, 7)
  const time = now.toTimeString().slice(0, 5).replace(':', '')
  const rand4 = Math.random().toString(36).slice(2, 6)
  const rand6 = Math.random().toString(36).slice(2, 8)
  return value
    .replaceAll('{platform}', context.platform || '')
    .replaceAll('{source}', context.source || '')
    .replaceAll('{medium}', context.medium || '')
    .replaceAll('{date}', dateYmd)
    .replaceAll('{date_ymd}', dateYmd)
    .replaceAll('{date_ym}', dateYm)
    .replaceAll('{time}', time)
    .replaceAll('{rand4}', rand4)
    .replaceAll('{rand6}', rand6)
}

function buildUrl(base, params) {
  const clean = base.split('#')[0]
  const url = new URL(clean)
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value)
  })
  return url.toString()
}

function collectParams(group) {
  const context = {
    platform: group === single ? singlePreset : bulkPreset,
    source: group.source?.value.trim(),
    medium: group.medium?.value.trim(),
  }
  return {
    utm_source: replaceMacros(group.source?.value.trim(), context),
    utm_medium: replaceMacros(group.medium?.value.trim(), context),
    utm_campaign: replaceMacros(group.campaign?.value.trim(), context),
    utm_content: replaceMacros(group.content?.value.trim(), context),
    utm_term: replaceMacros(group.term?.value.trim(), context),
  }
}

function buildSingle() {
  const base = (single.url?.value || '').trim()
  if (!base) {
    alert('Введите базовую ссылку.')
    return
  }
  const params = collectParams(single)
  const finalUrl = buildUrl(base, params)
  if (single.result) single.result.value = finalUrl
}

function copySingle() {
  const val = single.result?.value || ''
  if (!val) {
    alert('Сначала сгенерируйте ссылку.')
    return
  }
  navigator.clipboard.writeText(val).then(
    () => alert('Ссылка скопирована.'),
    () => alert('Не удалось скопировать.')
  )
}

function resetSingle() {
  ;['url', 'source', 'medium', 'campaign', 'content', 'term', 'result'].forEach((k) => {
    if (single[k]) single[k].value = ''
  })
}

function buildBulk() {
  const raw = (bulk.urls?.value || '').trim()
  if (!raw) {
    alert('Добавьте хотя бы одну ссылку.')
    return
  }
  const params = collectParams(bulk)
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  const results = []
  lines.forEach((line) => {
    try {
      results.push(buildUrl(line, params))
    } catch (e) {
      results.push(`${line}  # invalid_url`)
    }
  })
  if (bulk.result) bulk.result.value = results.join('\n')
}

function copyBulk() {
  const val = bulk.result?.value || ''
  if (!val) {
    alert('Сначала сгенерируйте ссылки.')
    return
  }
  navigator.clipboard.writeText(val).then(
    () => alert('Ссылки скопированы.'),
    () => alert('Не удалось скопировать.')
  )
}

function exportBulk() {
  const raw = bulk.result?.value || ''
  if (!raw) {
    alert('Сначала сгенерируйте ссылки.')
    return
  }
  const rows = raw.split('\n').map((line) => {
    const base = line.split('?')[0]
    return `"${base.replace(/\"/g, '""')}","${line.replace(/\"/g, '""')}"`
  })
  const csv = ['base_url,utm_url', ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'utm_links.csv'
  link.click()
  URL.revokeObjectURL(link.href)
}

function renderParamList(containerId, items) {
  const container = document.getElementById(containerId)
  if (!container) return
  const options = items
    .map((p) => `<option value="${p.key}">${p.key} — ${p.desc}</option>`)
    .join('')
  container.innerHTML = `
    ${items
      .map(
        (p) => `<span class="param-tag" data-insert="${p.key}">${p.key}<small>${p.desc}</small></span>`
      )
      .join('')}
    <select class="param-select" data-select>
      <option value="">Выберите параметр</option>
      ${options}
    </select>
  `
  container.addEventListener('click', (event) => {
    const tag = event.target.closest('.param-tag')
    if (!tag) return
    insertToken(tag.dataset.insert)
  })
  const select = container.querySelector('select[data-select]')
  if (select) {
    select.addEventListener('change', (event) => {
      const val = event.target.value
      if (val) insertToken(val)
      event.target.value = ''
    })
  }
}

if (single.generate) single.generate.addEventListener('click', buildSingle)
if (single.copy) single.copy.addEventListener('click', copySingle)
if (single.reset) single.reset.addEventListener('click', resetSingle)
if (bulk.generate) bulk.generate.addEventListener('click', buildBulk)
if (bulk.copy) bulk.copy.addEventListener('click', copyBulk)
if (bulk.export) bulk.export.addEventListener('click', exportBulk)

if (single.presets) {
  single.presets.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-preset]')
    if (!btn) return
    applyPreset(single, btn.dataset.preset)
  })
}

if (bulk.presets) {
  bulk.presets.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-preset]')
    if (!btn) return
    applyPreset(bulk, btn.dataset.preset)
  })
}

renderParamList('google-params-single', googleParams)
renderParamList('google-params-bulk', googleParams)
renderParamList('yandex-params-single', yandexParams)
renderParamList('yandex-params-bulk', yandexParams)

function insertToken(token) {
  if (!lastFocused) {
    alert('Сначала выберите поле для вставки.')
    return
  }
  const value = lastFocused.value || ''
  lastFocused.value = value ? `${value}${token}` : token
  lastFocused.focus()
}
