renderHeader({
  eyebrow: 'Envidicy · Tools',
  title: 'Инструменты',
  subtitle: 'UTM генератор и будущий сокращатель ссылок.',
  buttons: [],
})

const fields = {
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
}

function buildUtm() {
  const base = (fields.url?.value || '').trim()
  if (!base) {
    alert('Введите базовую ссылку.')
    return
  }
  const params = new URLSearchParams()
  const add = (key, value) => {
    if (value) params.set(key, value)
  }
  add('utm_source', fields.source?.value.trim())
  add('utm_medium', fields.medium?.value.trim())
  add('utm_campaign', fields.campaign?.value.trim())
  add('utm_content', fields.content?.value.trim())
  add('utm_term', fields.term?.value.trim())
  const [cleanBase] = base.split('#')
  const url = new URL(cleanBase)
  params.forEach((value, key) => url.searchParams.set(key, value))
  const finalUrl = url.toString()
  if (fields.result) fields.result.value = finalUrl
}

function copyResult() {
  const val = fields.result?.value || ''
  if (!val) {
    alert('Сначала сгенерируйте ссылку.')
    return
  }
  navigator.clipboard.writeText(val).then(
    () => alert('Ссылка скопирована.'),
    () => alert('Не удалось скопировать.')
  )
}

function resetForm() {
  Object.values(fields).forEach((el) => {
    if (el && 'value' in el) el.value = ''
  })
}

if (fields.generate) fields.generate.addEventListener('click', buildUtm)
if (fields.copy) fields.copy.addEventListener('click', copyResult)
if (fields.reset) fields.reset.addEventListener('click', resetForm)
