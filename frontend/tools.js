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

function applyPreset(target, key) {
  const preset = presets[key]
  if (!preset) return
  if (target.source) target.source.value = preset.source
  if (target.medium) target.medium.value = preset.medium
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
  return {
    utm_source: group.source?.value.trim(),
    utm_medium: group.medium?.value.trim(),
    utm_campaign: group.campaign?.value.trim(),
    utm_content: group.content?.value.trim(),
    utm_term: group.term?.value.trim(),
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
