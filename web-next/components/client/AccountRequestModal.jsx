'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './client.module.css'
import { getAuthToken } from '../../lib/auth'
import { useI18n } from '../../lib/i18n/client'

const PLATFORM_CARDS = [
  { key: 'meta', label: 'Meta', summary: 'Global reach & hyper-targeted precision.' },
  { key: 'google', label: 'Google', summary: 'Intent-based audience capture.' },
  { key: 'tiktok', label: 'TikTok', summary: 'High engagement via short-form creative.' },
  { key: 'telegram', label: 'Telegram', summary: 'Privacy-focused direct community ads.' },
  { key: 'yandex', label: 'Yandex', summary: 'Domain search and display in CIS.' },
]

const STEP_ITEMS = [
  { key: 'platform', label: 'Platform' },
  { key: 'business', label: 'Business' },
  { key: 'setup', label: 'Platform Setup' },
  { key: 'review', label: 'Review' },
]

const GOOGLE_CURRENCY_OPTIONS = ['USD', 'EUR']
const META_CURRENCY_OPTIONS = ['USD', 'EUR']

function stepIndex(step) {
  return Math.max(0, STEP_ITEMS.findIndex((item) => item.key === step))
}

function initialState() {
  return {
    platform: 'tiktok',
    name: '',
    legalEntityId: '',
    currency: 'USD',
    website: '',
    app: '',
    bmId: '',
    metaGeo: '',
    facebookPage: '',
    instagramPage: '',
    finalAdvertiser: 'yes',
    finalName: '',
    finalCountry: '',
    finalTaxId: '',
    finalAddress: '',
    finalOwnership: '',
    accessEmail: '',
    accessRole: 'standard',
    access: [],
    mccEmail: '',
    tiktokIdInput: '',
    tiktokIds: [],
    timezone: 'Asia/Almaty',
    geo: '',
  }
}

function defaultCurrencyForPlatform(platform) {
  const key = String(platform || '').toLowerCase()
  if (key === 'yandex') return 'KZT'
  if (key === 'telegram') return 'EUR'
  return 'USD'
}

function platformGuide(platform) {
  const key = String(platform || '').toLowerCase()
  if (key === 'google') {
    return {
      title: 'Google Ads and MCC',
      text: 'Legacy Google onboarding required an existing Google Ads account and MCC access before the request could be completed.',
      linkLabel: 'Instruction: Google Ads and MCC setup',
      link: '#',
    }
  }
  if (key === 'meta') {
    return {
      title: 'Business Manager',
      text: 'Legacy Meta onboarding required Business Manager details, GEO and connected pages before the request could be submitted.',
      linkLabel: 'Instruction: create Business Manager',
      link: '#',
    }
  }
  return {
    title: 'TikTok Business Center',
    text: 'Legacy TikTok onboarding required an existing TikTok Business Center before submitting the account request.',
    linkLabel: 'Instruction: create TikTok Business Center',
    link: 'https://ads.tiktok.com/help/article/create-tiktok-business-center?lang=ru',
  }
}

export default function AccountRequestModal({ open, onClose, onSubmitted }) {
  const { tr } = useI18n()
  const [step, setStep] = useState('platform')
  const [submitting, setSubmitting] = useState(false)
  const [entitiesLoading, setEntitiesLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [state, setState] = useState(initialState)
  const [entityOptions, setEntityOptions] = useState([])

  const isTiktok = state.platform === 'tiktok'
  const isGoogle = state.platform === 'google'
  const isMeta = state.platform === 'meta'
  const currentStep = stepIndex(step) + 1
  const progress = `${String(currentStep).padStart(2, '0')} / ${String(STEP_ITEMS.length).padStart(2, '0')}`

  const entityById = useMemo(() => {
    const map = new Map()
    for (const row of entityOptions) {
      const id = String(row?.id || '').trim()
      if (!id) continue
      map.set(id, row)
    }
    return map
  }, [entityOptions])

  const selectedEntity = entityById.get(String(state.legalEntityId || '').trim()) || null

  const canAdvanceBusiness =
    Boolean(state.name.trim()) && Boolean(String(state.legalEntityId || '').trim()) && Boolean(state.website.trim()) && Boolean(state.currency.trim())
  const canAdvanceSetup =
    isTiktok
      ? state.tiktokIds.length > 0 && Boolean(state.timezone.trim()) && Boolean(state.geo.trim())
      : isGoogle
        ? Boolean(state.mccEmail.trim()) && state.access.length > 0
        : isMeta
          ? Boolean(state.bmId.trim()) &&
            Boolean(state.metaGeo.trim()) &&
            Boolean(state.facebookPage.trim()) &&
            Boolean(state.instagramPage.trim()) &&
            (state.finalAdvertiser === 'yes' ||
              (Boolean(state.finalName.trim()) &&
                Boolean(state.finalCountry.trim()) &&
                Boolean(state.finalTaxId.trim()) &&
                Boolean(state.finalAddress.trim()) &&
                Boolean(state.finalOwnership.trim())))
          : false

  const reviewRows = useMemo(
    () => [
      { label: 'Legal Name', value: selectedEntity?.name || '—' },
      {
        label: isTiktok ? 'Primary Region' : isGoogle ? 'MCC Email' : 'Business Manager ID',
        value: isTiktok ? state.geo || '—' : isGoogle ? state.mccEmail || '—' : state.bmId || '—',
      },
      { label: 'Currency', value: state.currency || '—' },
      { label: 'Website', value: state.website || '—' },
    ],
    [isGoogle, isTiktok, selectedEntity?.name, state]
  )

  function translatePlatformSummary(item) {
    if (item?.key === 'meta') {
      return tr('Global reach & hyper-targeted precision.', 'Глобальный охват и точный таргетинг.')
    }
    if (item?.key === 'google') {
      return tr('Intent-based audience capture.', 'Охват аудитории по поисковому намерению.')
    }
    if (item?.key === 'tiktok') {
      return tr('High engagement via short-form creative.', 'Высокая вовлеченность через короткие креативы.')
    }
    if (item?.key === 'telegram') {
      return tr('Privacy-focused direct community ads.', 'Прямые объявления для комьюнити с акцентом на приватность.')
    }
    if (item?.key === 'yandex') {
      return tr('Domain search and display in CIS.', 'Поиск и медийное размещение в СНГ.')
    }
    return item?.summary || ''
  }

  function translateReviewFieldLabel(label) {
    const value = String(label || '')
    if (value === 'Legal Name') return tr('Legal Name', 'Юридическое лицо')
    if (value === 'Primary Region') return tr('Primary Region', 'Основной регион')
    if (value === 'MCC Email') return tr('MCC Email', 'MCC Email')
    if (value === 'Business Manager ID') return tr('Business Manager ID', 'Business Manager ID')
    if (value === 'Currency') return tr('Currency', 'Валюта')
    if (value === 'Website') return tr('Website', 'Сайт')
    return value
  }

  useEffect(() => {
    if (!open) return
    const token = getAuthToken()
    if (!token) return
    let cancelled = false

    async function loadEntities() {
      setEntitiesLoading(true)
      try {
        const res = await fetch('/api/client/legal-entities', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const data = await res.json().catch(() => [])
        if (!res.ok) throw new Error(data?.detail || tr('Failed to load legal entities', 'Не удалось загрузить юридические лица'))
        if (cancelled) return
        const rows = Array.isArray(data) ? data : []
        const nextOptions = rows
          .map((row) => ({
            id: row?.id,
            name: String(row?.name || '').trim(),
          }))
          .filter((row) => row.name && row.id != null)
        setEntityOptions(nextOptions)
        setState((current) => {
          const selectedId = String(current.legalEntityId || '').trim()
          const hasSelected = selectedId && nextOptions.some((row) => String(row.id) === selectedId)
          if (hasSelected) return current
          return { ...current, legalEntityId: nextOptions[0] ? String(nextOptions[0].id) : '' }
        })
      } catch (error) {
        if (!cancelled) setStatus(error?.message || tr('Failed to load legal entities', 'Не удалось загрузить юридические лица'))
      } finally {
        if (!cancelled) setEntitiesLoading(false)
      }
    }

    loadEntities()
    return () => {
      cancelled = true
    }
  }, [open, tr])

  function resetAndClose() {
    setStep('platform')
    setSubmitting(false)
    setStatus('')
    setState(initialState())
    onClose()
  }

  function addTiktokId() {
    const value = state.tiktokIdInput.trim()
    if (!value) {
      setStatus(tr('Enter a TikTok Business ID.', 'Введите TikTok Business ID.'))
      return
    }
    if (state.tiktokIds.length >= 10) {
      setStatus(tr('You can add up to 10 Business IDs.', 'Можно добавить не более 10 Business ID.'))
      return
    }
    if (state.tiktokIds.includes(value)) {
      setStatus(tr('This Business ID is already added.', 'Этот Business ID уже добавлен.'))
      return
    }
    setState((current) => ({ ...current, tiktokIds: [...current.tiktokIds, value], tiktokIdInput: '' }))
    setStatus('')
  }

  function addAccess() {
    const email = state.accessEmail.trim()
    if (!email) {
      setStatus(tr('Enter an access email.', 'Введите email для доступа.'))
      return
    }
    if (state.access.some((item) => item.email === email)) {
      setStatus(tr('This access email is already added.', 'Этот email уже добавлен.'))
      return
    }
    setState((current) => ({
      ...current,
      access: [...current.access, { email, role: current.accessRole }],
      accessEmail: '',
    }))
    setStatus('')
  }

  async function submitRequest() {
    const token = getAuthToken()
    if (!token) return

    setSubmitting(true)
    setStatus('')
    try {
      const payload = {
        platform: state.platform,
        name: state.name.trim(),
        external_id: null,
        currency: state.currency,
        website: state.website.trim(),
        app: state.app.trim() || null,
        access: isGoogle ? state.access : [],
        mcc_email: isGoogle ? state.mccEmail.trim() || null : null,
        business_manager_id: isMeta ? state.bmId.trim() || null : null,
        geo: isMeta ? state.metaGeo.trim() || null : null,
        facebook_page: isMeta ? state.facebookPage.trim() || null : null,
        instagram_page: isMeta ? state.instagramPage.trim() || null : null,
        final_advertiser: isMeta ? state.finalAdvertiser : 'yes',
        final_name: isMeta ? state.finalName.trim() || null : null,
        final_country: isMeta ? state.finalCountry.trim() || null : null,
        final_tax_id: isMeta ? state.finalTaxId.trim() || null : null,
        final_address: isMeta ? state.finalAddress.trim() || null : null,
        final_ownership: isMeta ? state.finalOwnership.trim() || null : null,
        yandex_email: null,
        telegram_channel: null,
        tiktok_business_ids: isTiktok ? state.tiktokIds : [],
        tiktok_timezone: isTiktok ? state.timezone : null,
        tiktok_geo: isTiktok ? state.geo : null,
        legal_entity_id: state.legalEntityId ? Number(state.legalEntityId) : null,
        legal_entity_name: selectedEntity?.name || null,
      }

      const res = await fetch('/api/client/account-request', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.detail || tr('Failed to create account request', 'Не удалось создать запрос на аккаунт'))
      if (onSubmitted) await onSubmitted(data)
      resetAndClose()
    } catch (error) {
      setStatus(error?.message || tr('Failed to create account request', 'Не удалось создать запрос на аккаунт'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className={styles.requestModalOverlay} onClick={(event) => event.target === event.currentTarget && resetAndClose()}>
      <section className={styles.requestModal} role="dialog" aria-modal="true" aria-labelledby="request-account-title">
        <aside className={styles.requestRail}>
          <div>
            <h3 className={styles.requestRailTitle}>{tr('Onboarding', 'Онбординг')}</h3>
            <p className={styles.requestRailStep}>{tr(`Step ${currentStep} of ${STEP_ITEMS.length}`, `Шаг ${currentStep} из ${STEP_ITEMS.length}`)}</p>
          </div>
          <div className={styles.requestRailNav}>
            {STEP_ITEMS.map((item, index) => (
              <div
                className={index === stepIndex(step) ? `${styles.requestRailItem} ${styles.requestRailItemActive}` : styles.requestRailItem}
                key={item.key}
              >
                <span>
                  {item.key === 'platform'
                    ? tr('Platform', 'Платформа')
                    : item.key === 'business'
                      ? tr('Business', 'Бизнес')
                      : item.key === 'setup'
                        ? tr('Platform Setup', 'Настройка платформы')
                        : tr('Review', 'Проверка')}
                </span>
              </div>
            ))}
          </div>
          <div className={styles.requestSupportCard}>
            <strong>{tr('Need help with setup?', 'Нужна помощь с настройкой?')}</strong>
            <span>{tr('Schedule a consultation with AdOps.', 'Запланируйте консультацию с AdOps.')}</span>
          </div>
        </aside>

        <div className={styles.requestCanvas}>
          <div className={styles.requestCanvasHead}>
            <div>
              <p className={styles.requestStepEyebrow}>{tr(`Step ${String(currentStep).padStart(2, '0')} of ${String(STEP_ITEMS.length).padStart(2, '0')}`, `Шаг ${String(currentStep).padStart(2, '0')} из ${String(STEP_ITEMS.length).padStart(2, '0')}`)}</p>
              <h3 className={styles.requestCanvasTitle} id="request-account-title">
                {step === 'platform'
                  ? tr('Select Platform', 'Выберите платформу')
                  : step === 'business'
                    ? isGoogle
                      ? tr('Google Ads', 'Google Ads')
                      : isMeta
                        ? tr('Meta Ads', 'Meta Ads')
                      : tr('TikTok Ads', 'TikTok Ads')
                    : step === 'setup'
                      ? isGoogle
                        ? tr('MCC & Access Setup', 'Настройка MCC и доступов')
                        : isMeta
                          ? tr('Meta Business Setup', 'Настройка Meta Business')
                        : tr('Business Setup', 'Настройка бизнеса')
                      : tr('Review & Submit', 'Проверка и отправка')}
              </h3>
              <p className={styles.requestCanvasSubtitle}>
                {step === 'platform'
                  ? tr('Choose the ecosystem where you want to scale your operations.', 'Выберите экосистему, в которой хотите масштабировать работу.')
                  : step === 'business'
                    ? isGoogle
                      ? tr('Configure your Google Ads account identity and financial foundations.', 'Настройте идентификаторы Google Ads и финансовую базу аккаунта.')
                      : isMeta
                        ? tr('Configure your Meta account identity and financial foundations.', 'Настройте идентификаторы Meta и финансовую базу аккаунта.')
                      : tr('Configure your TikTok Ads business identity and financial foundations.', 'Настройте идентификаторы TikTok Ads и финансовую базу аккаунта.')
                    : step === 'setup'
                      ? isGoogle
                        ? tr('Provide MCC access and the emails that should receive Google Ads access.', 'Укажите доступ MCC и email, которые должны получить доступ к Google Ads.')
                        : isMeta
                          ? tr('Provide Business Manager details, GEO, connected pages and final advertiser information.', 'Укажите данные Business Manager, GEO, подключенные страницы и данные финального рекламодателя.')
                        : tr('Connect TikTok business IDs, timezone and primary geo targeting.', 'Подключите TikTok Business ID, timezone и основной GEO таргетинг.')
                      : isGoogle
                        ? tr('Verify your Google Ads account details before submitting for review.', 'Проверьте данные Google Ads перед отправкой на проверку.')
                        : isMeta
                          ? tr('Verify your Meta account details before submitting for review.', 'Проверьте данные Meta перед отправкой на проверку.')
                        : tr('Verify your TikTok account details before submitting for review.', 'Проверьте данные TikTok перед отправкой на проверку.')}
              </p>
            </div>
            <div className={styles.requestCanvasActions}>
              <span className={styles.requestProgressText}>{progress}</span>
              <button className={styles.requestClose} onClick={resetAndClose} type="button" aria-label={tr('Close', 'Закрыть')}>
                ×
              </button>
            </div>
          </div>

          {step === 'platform' ? (
            <div className={styles.requestPlatformGrid}>
              {PLATFORM_CARDS.map((item) => (
                <button
                  className={item.key === state.platform ? `${styles.requestPlatformCard} ${styles.requestPlatformCardActive}` : styles.requestPlatformCard}
                  key={item.key}
                  onClick={() => {
                    setState((current) => ({
                      ...current,
                      platform: item.key,
                      currency: defaultCurrencyForPlatform(item.key),
                    }))
                    setStatus(['tiktok', 'google', 'meta'].includes(item.key) ? '' : tr('TikTok, Google and Meta are the first flows implemented in the redesign. Other platforms follow next.', 'TikTok, Google и Meta — первые потоки в редизайне. Остальные платформы будут добавлены далее.'))
                  }}
                  type="button"
                >
                  <strong>{item.label}</strong>
                  <span>{translatePlatformSummary(item)}</span>
                  {!['tiktok', 'google', 'meta'].includes(item.key) ? <em>{tr('Next', 'Далее')}</em> : null}
                </button>
              ))}
            </div>
          ) : null}

          {step === 'business' ? (
            <div className={styles.requestFormGrid}>
              <article className={styles.requestGuideCard}>
                <strong>
                  {tr(
                    platformGuide(state.platform).title,
                    platformGuide(state.platform).title === 'Business Manager'
                      ? 'Business Manager'
                      : platformGuide(state.platform).title === 'TikTok Business Center'
                        ? 'TikTok Business Center'
                        : 'Google Ads и MCC'
                  )}
                </strong>
                <span>
                  {platformGuide(state.platform).title === 'Business Manager'
                    ? tr(
                        'Legacy Meta onboarding required Business Manager details, GEO and connected pages before the request could be submitted.',
                        'Для Meta укажите данные Business Manager, GEO и подключенные страницы перед отправкой запроса.'
                      )
                    : platformGuide(state.platform).title === 'TikTok Business Center'
                      ? tr(
                          'Legacy TikTok onboarding required an existing TikTok Business Center before submitting the account request.',
                          'Для TikTok сначала нужен действующий TikTok Business Center, затем можно отправлять запрос на аккаунт.'
                        )
                      : tr(
                          'Legacy Google onboarding required an existing Google Ads account and MCC access before the request could be completed.',
                          'Для Google сначала нужен действующий Google Ads аккаунт и доступ MCC.'
                        )}
                </span>
                <a
                  href={platformGuide(state.platform).link}
                  rel="noreferrer"
                  target={platformGuide(state.platform).link.startsWith('http') ? '_blank' : undefined}
                >
                  {platformGuide(state.platform).title === 'Business Manager'
                    ? tr('Instruction: create Business Manager', 'Инструкция: создать Business Manager')
                    : platformGuide(state.platform).title === 'TikTok Business Center'
                      ? tr('Instruction: create TikTok Business Center', 'Инструкция: создать TikTok Business Center')
                      : tr('Instruction: Google Ads and MCC setup', 'Инструкция: настройка Google Ads и MCC')}
                </a>
              </article>
              <label className={styles.requestField}>
                <span>{tr('Account Name', 'Название аккаунта')}</span>
                <input
                  onChange={(event) => setState((current) => ({ ...current, name: event.target.value }))}
                  placeholder={isGoogle ? tr('e.g. Architect_Search_Global', 'например: Architect_Search_Global') : isMeta ? tr('e.g. Architect_Meta_Global', 'например: Architect_Meta_Global') : tr('e.g. Architect_Global_Performance', 'например: Architect_Global_Performance')}
                  type="text"
                  value={state.name}
                />
              </label>
              <label className={styles.requestField}>
                <span>{tr('Website URL', 'URL сайта')}</span>
                <input
                  onChange={(event) => setState((current) => ({ ...current, website: event.target.value }))}
                  placeholder={tr('https://architect.ledger/brand', 'https://architect.ledger/brand')}
                  type="url"
                  value={state.website}
                />
              </label>
              <label className={styles.requestField}>
                <span>{tr('Legal Entity', 'Юридическое лицо')}</span>
                <select value={state.legalEntityId} onChange={(event) => setState((current) => ({ ...current, legalEntityId: event.target.value }))}>
                  <option value="">{tr('Select Registered Entity', 'Выберите зарегистрированное юрлицо')}</option>
                  {entityOptions.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              {entitiesLoading ? <span className={styles.tableSubtle}>{tr('Loading legal entities…', 'Загрузка юридических лиц…')}</span> : null}
              <label className={styles.requestField}>
                <span>{tr('App URL', 'URL приложения')}</span>
                <input
                  onChange={(event) => setState((current) => ({ ...current, app: event.target.value }))}
                  placeholder={tr('App Store or Play Store Link', 'Ссылка App Store или Play Store')}
                  type="url"
                  value={state.app}
                />
              </label>
              <label className={styles.requestField}>
                <span>{tr('Account Currency', 'Валюта аккаунта')}</span>
                {isGoogle || isMeta ? (
                  <select value={state.currency} onChange={(event) => setState((current) => ({ ...current, currency: event.target.value }))}>
                    {(isGoogle ? GOOGLE_CURRENCY_OPTIONS : META_CURRENCY_OPTIONS).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input disabled readOnly type="text" value={tr('USD - United States Dollar', 'USD - Доллар США')} />
                )}
              </label>
              <article className={styles.requestInfoCard}>
                <strong>{tr('Architect Verified', 'Проверено Architect')}</strong>
                <span>{tr('Configuration settings will be synchronized with your master financial ledger for consistent reporting across all platforms.', 'Настройки будут синхронизированы с основным финансовым реестром для консистентной отчетности по всем платформам.')}</span>
              </article>
            </div>
          ) : null}

          {step === 'setup' ? (
            <div className={styles.requestSetupStack}>
              {isTiktok ? (
                <>
                  <label className={styles.requestField}>
                    <span>{tr('TikTok Business IDs', 'TikTok Business ID')}</span>
                    <div className={styles.requestInlineField}>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, tiktokIdInput: event.target.value }))}
                        placeholder={tr('Enter Business Center ID', 'Введите Business Center ID')}
                        type="text"
                        value={state.tiktokIdInput}
                      />
                      <button className={styles.requestGhostButton} onClick={addTiktokId} type="button">
                        {tr('Add', 'Добавить')}
                      </button>
                    </div>
                  </label>
                  <div className={styles.requestChipRow}>
                    {state.tiktokIds.map((item, index) => (
                      <div className={styles.requestChip} key={`${item}-${index}`}>
                        <span>ID: {item}</span>
                        <button
                          onClick={() =>
                            setState((current) => ({
                              ...current,
                              tiktokIds: current.tiktokIds.filter((_, chipIndex) => chipIndex !== index),
                            }))
                          }
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className={styles.requestFormGridTwo}>
                    <label className={styles.requestField}>
                      <span>{tr('Timezone', 'Часовой пояс')}</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, timezone: event.target.value }))}
                        placeholder={tr('Asia/Almaty', 'Asia/Almaty')}
                        type="text"
                        value={state.timezone}
                      />
                    </label>
                    <label className={styles.requestField}>
                      <span>{tr('Primary Geo Target', 'Основной GEO таргет')}</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, geo: event.target.value }))}
                        placeholder={tr('Kazakhstan, Uzbekistan', 'Казахстан, Узбекистан')}
                        type="text"
                        value={state.geo}
                      />
                    </label>
                  </div>
                </>
              ) : null}

              {isGoogle ? (
                <>
                  <label className={styles.requestField}>
                    <span>{tr('MCC Access Email', 'MCC email для доступа')}</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, mccEmail: event.target.value }))}
                      placeholder={tr('user@company.com', 'user@company.com')}
                        type="email"
                        value={state.mccEmail}
                      />
                  </label>
                  <label className={styles.requestField}>
                    <span>{tr('Access Emails', 'Email доступа')}</span>
                    <div className={styles.requestInlineField}>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, accessEmail: event.target.value }))}
                        placeholder={tr('user@company.com', 'user@company.com')}
                        type="email"
                        value={state.accessEmail}
                      />
                      <button className={styles.requestGhostButton} onClick={addAccess} type="button">
                        {tr('Add', 'Добавить')}
                      </button>
                    </div>
                  </label>
                  <div className={styles.requestChipRow}>
                    {state.access.map((item, index) => (
                      <div className={styles.requestChip} key={`${item.email}-${index}`}>
                        <span>{item.email}</span>
                        <button
                          onClick={() =>
                            setState((current) => ({
                              ...current,
                              access: current.access.filter((_, chipIndex) => chipIndex !== index),
                            }))
                          }
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}

              {isMeta ? (
                <>
                  <div className={styles.requestFormGridTwo}>
                    <label className={styles.requestField}>
                      <span>{tr('Business Manager ID', 'Business Manager ID')}</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, bmId: event.target.value }))}
                        placeholder={tr('e.g. 123456789012345', 'например: 123456789012345')}
                        type="text"
                        value={state.bmId}
                      />
                    </label>
                    <label className={styles.requestField}>
                      <span>{tr('GEO', 'GEO')}</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, metaGeo: event.target.value }))}
                        placeholder={tr('Kazakhstan', 'Казахстан')}
                        type="text"
                        value={state.metaGeo}
                      />
                    </label>
                  </div>
                  <div className={styles.requestFormGridTwo}>
                    <label className={styles.requestField}>
                      <span>{tr('Facebook Page', 'Страница Facebook')}</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, facebookPage: event.target.value }))}
                        placeholder={tr('https://facebook.com/your-page', 'https://facebook.com/your-page')}
                        type="url"
                        value={state.facebookPage}
                      />
                    </label>
                    <label className={styles.requestField}>
                      <span>{tr('Instagram Page', 'Страница Instagram')}</span>
                      <input
                        onChange={(event) => setState((current) => ({ ...current, instagramPage: event.target.value }))}
                        placeholder={tr('https://instagram.com/your-page', 'https://instagram.com/your-page')}
                        type="url"
                        value={state.instagramPage}
                      />
                    </label>
                  </div>
                  <label className={styles.requestField}>
                    <span>{tr('Are you the final advertiser?', 'Вы финальный рекламодатель?')}</span>
                    <select value={state.finalAdvertiser} onChange={(event) => setState((current) => ({ ...current, finalAdvertiser: event.target.value }))}>
                      <option value="yes">{tr('Yes', 'Да')}</option>
                      <option value="no">{tr('No', 'Нет')}</option>
                    </select>
                  </label>
                  {state.finalAdvertiser === 'no' ? (
                    <div className={styles.requestFormGridTwo}>
                      <label className={styles.requestField}>
                        <span>{tr('Final Advertiser Name', 'Название финального рекламодателя')}</span>
                        <input
                          onChange={(event) => setState((current) => ({ ...current, finalName: event.target.value }))}
                          type="text"
                          value={state.finalName}
                        />
                      </label>
                      <label className={styles.requestField}>
                        <span>{tr('Country', 'Страна')}</span>
                        <input
                          onChange={(event) => setState((current) => ({ ...current, finalCountry: event.target.value }))}
                          type="text"
                          value={state.finalCountry}
                        />
                      </label>
                      <label className={styles.requestField}>
                        <span>{tr('Tax ID', 'Налоговый ID')}</span>
                        <input
                          onChange={(event) => setState((current) => ({ ...current, finalTaxId: event.target.value }))}
                          type="text"
                          value={state.finalTaxId}
                        />
                      </label>
                      <label className={styles.requestField}>
                        <span>{tr('Address', 'Адрес')}</span>
                        <input
                          onChange={(event) => setState((current) => ({ ...current, finalAddress: event.target.value }))}
                          type="text"
                          value={state.finalAddress}
                        />
                      </label>
                      <label className={styles.requestField}>
                        <span>{tr('Ownership Share', 'Доля владения')}</span>
                        <input
                          onChange={(event) => setState((current) => ({ ...current, finalOwnership: event.target.value }))}
                          placeholder={tr('100%', '100%')}
                          type="text"
                          value={state.finalOwnership}
                        />
                      </label>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {step === 'review' ? (
            <div className={styles.requestReviewStack}>
              <section className={styles.requestReviewSection}>
                <p className={styles.requestReviewLabel}>{tr('Basic Account Summary', 'Базовая сводка аккаунта')}</p>
                <div className={styles.requestReviewGrid}>
                  {reviewRows.map((item) => (
                    <div className={styles.requestReviewCard} key={item.label}>
                      <span>{translateReviewFieldLabel(item.label)}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </section>
              <section className={styles.requestReviewSection}>
                <p className={styles.requestReviewLabel}>{isGoogle ? tr('Google Access Setup', 'Настройка Google доступа') : isMeta ? tr('Meta Business Setup', 'Настройка Meta Business') : tr('TikTok Business Setup', 'Настройка TikTok Business')}</p>
                <div className={styles.requestBusinessList}>
                  {isTiktok
                    ? state.tiktokIds.map((item, index) => (
                        <div className={styles.requestBusinessItem} key={`${item}-${index}`}>
                          <strong>{tr('TikTok BC', 'TikTok BC')} #{index + 1}</strong>
                          <span>{item}</span>
                        </div>
                      ))
                    : isGoogle
                      ? state.access.map((item, index) => (
                        <div className={styles.requestBusinessItem} key={`${item.email}-${index}`}>
                          <strong>{tr('Access Email', 'Email доступа')} #{index + 1}</strong>
                          <span>{item.email}</span>
                        </div>
                        ))
                      : [
                          <div className={styles.requestBusinessItem} key="meta-bm">
                            <strong>{tr('Business Manager ID', 'Business Manager ID')}</strong>
                            <span>{state.bmId}</span>
                          </div>,
                          <div className={styles.requestBusinessItem} key="meta-pages">
                            <strong>{tr('Connected Pages', 'Подключенные страницы')}</strong>
                            <span>{state.facebookPage}</span>
                          </div>,
                          <div className={styles.requestBusinessItem} key="meta-instagram">
                            <strong>{tr('Instagram Page', 'Instagram страница')}</strong>
                            <span>{state.instagramPage}</span>
                          </div>,
                        ]}
                </div>
                <div className={styles.requestReviewMeta}>
                  {isTiktok ? (
                    <>
                      <span>{tr('Timezone', 'Часовой пояс')}: {state.timezone}</span>
                      <span>{tr('Primary GEO', 'Основной GEO')}: {state.geo}</span>
                    </>
                  ) : isGoogle ? (
                    <span>{tr('MCC Email', 'MCC Email')}: {state.mccEmail}</span>
                  ) : (
                    <>
                      <span>{tr('GEO', 'GEO')}: {state.metaGeo}</span>
                      <span>{tr('Final Advertiser', 'Финальный рекламодатель')}: {state.finalAdvertiser === 'yes' ? tr('Yes', 'Да') : tr('No', 'Нет')}</span>
                    </>
                  )}
                </div>
              </section>
              <div className={styles.requestPolicyNote}>
                {tr('By submitting this request, you confirm the onboarding details are correct. Account verification may take 2-4 business days.', 'Отправляя запрос, вы подтверждаете корректность данных. Проверка аккаунта может занять 2–4 рабочих дня.')}
              </div>
            </div>
          ) : null}

          {status ? <div className={styles.requestStatus}>{status}</div> : null}

          <div className={styles.requestFooter}>
            <button
              className={styles.requestBack}
              onClick={() => {
                setStatus('')
                setStep(STEP_ITEMS[Math.max(0, stepIndex(step) - 1)].key)
              }}
              type="button"
              disabled={step === 'platform' || submitting}
            >
              {tr('Back', 'Назад')}
            </button>

            <div className={styles.requestFooterRight}>
              {step !== 'review' ? (
                <button
                  className={styles.requestPrimary}
                  onClick={() => {
                    setStatus('')
                    if (step === 'platform') {
                      if (!['tiktok', 'google', 'meta'].includes(state.platform)) {
                        setStatus(tr('TikTok, Google and Meta are the first flows implemented in the redesign. Select one of them to continue.', 'TikTok, Google и Meta — первые потоки в редизайне. Выберите одну из них для продолжения.'))
                        return
                      }
                      setStep('business')
                      return
                    }
                    if (step === 'business') {
                      if (!canAdvanceBusiness) {
                        setStatus(tr('Complete the required business fields before continuing.', 'Заполните обязательные поля бизнеса перед продолжением.'))
                        return
                      }
                      setStep('setup')
                      return
                    }
                    if (step === 'setup') {
                      if (!canAdvanceSetup) {
                        setStatus(
                          isGoogle
                            ? tr('Add MCC email and at least one access email before continuing.', 'Добавьте MCC email и минимум один email доступа перед продолжением.')
                            : isMeta
                              ? tr('Complete Business Manager, GEO, pages and final advertiser details before continuing.', 'Заполните Business Manager, GEO, страницы и данные финального рекламодателя перед продолжением.')
                            : tr('Add at least one TikTok Business ID, timezone and primary GEO.', 'Добавьте минимум один TikTok Business ID, часовой пояс и основной GEO.')
                        )
                        return
                      }
                      setStep('review')
                    }
                  }}
                  type="button"
                >
                  {tr('Save & Continue', 'Сохранить и продолжить')}
                </button>
              ) : (
                <button className={styles.requestPrimary} disabled={submitting} onClick={submitRequest} type="button">
                  {submitting ? tr('Requesting…', 'Отправка…') : tr('Request Account', 'Запросить аккаунт')}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
