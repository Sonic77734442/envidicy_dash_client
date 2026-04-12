import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './client.module.css'
import { clearAuth, getAuthToken } from '../../lib/auth'
import { apiFetch } from '../../lib/api'
import { useI18n } from '../../lib/i18n/client'
import GenerateInvoiceModal from './GenerateInvoiceModal'

const NAV_ITEMS = [
  { key: 'overview', href: '/dashboard', label: 'Overview', labelRu: 'Обзор', icon: 'O' },
  { key: 'performance', href: '/performance', label: 'Performance', labelRu: 'Перфоманс', icon: 'P' },
  { key: 'finance', href: '/funds', label: 'Finance', labelRu: 'Финансы', icon: 'F' },
]

export default function ClientShell({
  activeNav,
  pageTitle,
  pageSubtitle,
  pageActionLabel,
  pageActionHref = '#',
  pageActionOnClick,
  headerActionLabel = 'Create Request',
  headerActionHref = '#',
  headerActionOnClick,
  searchPlaceholder = '',
  entityLabel = 'Entity Switcher',
  statusAlerts = '2 Alerts',
  statusRows = [],
  children,
}) {
  const router = useRouter()
  const { locale, setLocale, tr } = useI18n()
  const [profileOpen, setProfileOpen] = useState(false)
  const [entityOpen, setEntityOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [entities, setEntities] = useState([])
  const [selectedEntityId, setSelectedEntityId] = useState('')
  const [rateRows, setRateRows] = useState([
    { code: 'USD', bank: null, marked: null },
    { code: 'EUR', bank: null, marked: null },
  ])
  const [notifications, setNotifications] = useState([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const profileRef = useRef(null)
  const entityRef = useRef(null)
  const notificationsRef = useRef(null)

  useEffect(() => {
    function onPointerDown(event) {
      if (!profileRef.current?.contains(event.target)) {
        setProfileOpen(false)
      }
      if (!entityRef.current?.contains(event.target)) {
        setEntityOpen(false)
      }
      if (!notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  useEffect(() => {
    const token = getAuthToken()
    if (!token) return
    let cancelled = false
    async function loadSidebarData() {
      try {
        const [entityRes, ratesRes, notificationsRes] = await Promise.all([
          apiFetch('/legal-entities', { headers: { Authorization: `Bearer ${token}` } }),
          apiFetch('/rates/bcc'),
          apiFetch('/notifications', { headers: { Authorization: `Bearer ${token}` } }),
        ])
        if (cancelled) return

        const entitiesPayload = entityRes.ok ? await entityRes.json().catch(() => []) : []
        const entityRows = Array.isArray(entitiesPayload) ? entitiesPayload : []
        setEntities(entityRows)
        const storedEntityId = typeof window !== 'undefined' ? window.localStorage.getItem('preferred_legal_entity_id') : ''
        if (storedEntityId && entityRows.some((row) => String(row.id) === String(storedEntityId))) {
          setSelectedEntityId(String(storedEntityId))
        } else if (entityRows[0]) {
          setSelectedEntityId(String(entityRows[0].id))
          if (typeof window !== 'undefined') window.localStorage.setItem('preferred_legal_entity_id', String(entityRows[0].id))
        }

        const ratesPayload = ratesRes.ok ? await ratesRes.json().catch(() => null) : null
        const rates = ratesPayload?.rates || {}
        const markupPercent = Number(ratesPayload?.markup_percent)
        setRateRows([
          {
            code: 'USD',
            bank: Number(rates?.USD?.sell) > 0 ? Number(rates.USD.sell) : null,
            marked:
              Number(rates?.USD?.sell_marked) > 0
                ? Number(rates.USD.sell_marked)
                : Number(rates?.USD?.sell) > 0
                  ? Number(rates.USD.sell) * (1 + (Number.isFinite(markupPercent) ? markupPercent : 5) / 100)
                  : null,
          },
          {
            code: 'EUR',
            bank: Number(rates?.EUR?.sell) > 0 ? Number(rates.EUR.sell) : null,
            marked:
              Number(rates?.EUR?.sell_marked) > 0
                ? Number(rates.EUR.sell_marked)
                : Number(rates?.EUR?.sell) > 0
                  ? Number(rates.EUR.sell) * (1 + (Number.isFinite(markupPercent) ? markupPercent : 5) / 100)
                  : null,
          },
        ])

        const notificationsPayload = notificationsRes.ok ? await notificationsRes.json().catch(() => ({})) : {}
        setNotifications(Array.isArray(notificationsPayload?.items) ? notificationsPayload.items : [])
        setUnreadNotifications(Number(notificationsPayload?.unread || 0))
      } catch {
        // ignore sidebar data errors
      }
    }
    loadSidebarData()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedEntity = entities.find((row) => String(row.id) === String(selectedEntityId))

  function formatRate(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) return '—'
    return `₸${numeric.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  function formatNotification(item) {
    if (!item) return ''
    if (item.type === 'topup') {
      return tr(
        `Top-up completed · ${item.amount || 0} ${item.currency || 'KZT'}`,
        `Пополнение завершено · ${item.amount || 0} ${item.currency || 'KZT'}`
      )
    }
    if (item.type === 'account_request') {
      return tr(`Account approved · ${item.platform || ''} ${item.name || ''}`, `Аккаунт одобрен · ${item.platform || ''} ${item.name || ''}`)
    }
    return item.title || tr('New notification', 'Новое уведомление')
  }

  async function markNotificationsRead() {
    const token = getAuthToken()
    if (!token || !unreadNotifications) return
    try {
      await apiFetch('/notifications/read', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      setUnreadNotifications(0)
    } catch {
      // ignore read errors
    }
  }

  function logout() {
    clearAuth()
    router.push('/login')
  }

  return (
    <div className={styles.shell}>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <h1 className={styles.brandTitle}>Architectural Ledger</h1>
            <p className={styles.brandSubtitle}>Elite Financial Ops</p>
          </div>

          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`${styles.navLink} ${activeNav === item.key ? styles.navLinkActive : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span>{tr(item.label, item.labelRu)}</span>
              </Link>
            ))}
          </nav>

          <section className={styles.ratesRail}>
            <p className={styles.statusLabel}>{tr('Top-up rates', 'Курс пополнения')}</p>
            <div className={styles.ratesList}>
              {(rateRows || []).map((row) => (
                <div className={styles.rateLine} key={`client-rate-${row.code}`}>
                  <span className={styles.rateCode}>{row.code}</span>
                  <span className={styles.rateValue}>
                    {row.code === 'USD' ? '1$ = ' : row.code === 'EUR' ? '1€ = ' : ''}
                    {formatRate(row.marked || row.bank)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className={styles.statusRail}>
            <p className={styles.statusLabel}>{tr('Status Rail', 'Статус панель')}</p>
            <div className={styles.alertCard}>
              <span className={styles.alertDot} />
              <span>{statusAlerts}</span>
            </div>
            <div className={styles.statusRows}>
              {statusRows.map((row) => (
                <div className={styles.statusRow} key={row.label}>
                  <span className={styles.statusBullet}>{row.icon}</span>
                  <span>{row.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className={styles.main}>
          <header className={styles.topbar}>
            <div className={styles.topbarLeft}>
              {searchPlaceholder ? (
                <label className={styles.searchWrap}>
                  <span className={styles.searchIcon}>⌕</span>
                  <input className={styles.searchInput} placeholder={searchPlaceholder} readOnly value="" />
                </label>
              ) : null}
            </div>

            <div className={styles.topbarRight}>
              <div className={styles.localeSwitch}>
                <button
                  className={locale === 'en' ? styles.localeButtonActive : styles.localeButton}
                  onClick={() => setLocale('en')}
                  type="button"
                >
                  EN
                </button>
                <button
                  className={locale === 'ru' ? styles.localeButtonActive : styles.localeButton}
                  onClick={() => setLocale('ru')}
                  type="button"
                >
                  RU
                </button>
              </div>
              <div className={styles.entityWrap} ref={entityRef}>
                <button
                  className={styles.entityPill}
                  onClick={() => {
                    setEntityOpen((prev) => !prev)
                    setProfileOpen(false)
                    setNotificationsOpen(false)
                  }}
                  type="button"
                >
                  <span>{selectedEntity?.name || entityLabel}</span>
                  <span>▾</span>
                </button>
                {entityOpen ? (
                  <div className={styles.entityMenu}>
                    {(entities || []).length ? (
                      (entities || []).map((row) => (
                        <button
                          className={styles.entityMenuItem}
                          key={row.id}
                          onClick={() => {
                            const next = String(row.id)
                            setSelectedEntityId(next)
                            if (typeof window !== 'undefined') window.localStorage.setItem('preferred_legal_entity_id', next)
                            setEntityOpen(false)
                          }}
                          type="button"
                        >
                          {row.name}
                        </button>
                      ))
                    ) : (
                      <div className={styles.notificationItemEmpty}>{tr('No legal entities yet.', 'Контрагенты пока не добавлены.')}</div>
                    )}
                  </div>
                ) : null}
              </div>
              <button className={styles.topbarInvoiceAction} onClick={() => setInvoiceOpen(true)} type="button">
                {tr('Generate Invoice', 'Сгенерировать счет')}
              </button>
              {headerActionLabel ? (
                headerActionOnClick ? (
                  <button className={styles.topbarActionButton} onClick={headerActionOnClick} type="button">
                    {headerActionLabel}
                  </button>
                ) : (
                  <Link className={styles.topbarAction} href={headerActionHref}>
                    {headerActionLabel}
                  </Link>
                )
              ) : null}
              <div className={styles.iconRow}>
                <div className={styles.notificationsWrap} ref={notificationsRef}>
                  <button
                    className={styles.iconButton}
                    onClick={() => {
                      const next = !notificationsOpen
                      setNotificationsOpen(next)
                      setProfileOpen(false)
                      setEntityOpen(false)
                      if (next) markNotificationsRead()
                    }}
                    type="button"
                  >
                    🔔
                    {unreadNotifications > 0 ? <span className={styles.iconBadge}>{unreadNotifications > 9 ? '9+' : unreadNotifications}</span> : null}
                  </button>
                  {notificationsOpen ? (
                    <div className={styles.notificationsMenu}>
                      <p className={styles.notificationsTitle}>{tr('Notifications', 'Уведомления')}</p>
                      {notifications.length ? (
                        notifications.slice(0, 8).map((item, index) => (
                          <div className={styles.notificationItem} key={`${item.type || 'n'}-${item.id || index}`}>
                            <p>{formatNotification(item)}</p>
                            <span>{String(item.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                          </div>
                        ))
                      ) : (
                        <div className={styles.notificationItemEmpty}>{tr('No new notifications.', 'Пока нет новых уведомлений.')}</div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className={styles.profileMenuWrap} ref={profileRef}>
                  <button
                    aria-expanded={profileOpen}
                    aria-haspopup="menu"
                    className={styles.avatarButton}
                    onClick={() => setProfileOpen((prev) => !prev)}
                    type="button"
                  >
                    <span className={styles.avatar}>AL</span>
                  </button>
                  {profileOpen ? (
                    <div className={styles.profileMenu} role="menu">
                      <Link className={styles.profileMenuItem} href="/settings" onClick={() => setProfileOpen(false)} role="menuitem">
                        {tr('Settings', 'Настройки')}
                      </Link>
                      <button className={styles.profileMenuItemButton} onClick={logout} role="menuitem" type="button">
                        {tr('Log out', 'Выход')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </header>

          <main className={styles.content}>
            <div className={styles.pageHeader}>
              <div>
                <h2 className={styles.pageTitle}>{pageTitle}</h2>
                <p className={styles.pageSubtitle}>{pageSubtitle}</p>
              </div>
              {pageActionLabel ? (
                pageActionOnClick ? (
                  <button className={styles.secondaryActionButton} onClick={pageActionOnClick} type="button">
                    {pageActionLabel}
                  </button>
                ) : (
                  <Link className={styles.secondaryAction} href={pageActionHref}>
                    {pageActionLabel}
                  </Link>
                )
              ) : null}
            </div>
            {children}
          </main>
        </div>
      </div>
      <GenerateInvoiceModal
        onClose={() => setInvoiceOpen(false)}
        onCreated={() => {
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('invoice-generated'))
          router.push('/funds#invoices')
        }}
        open={invoiceOpen}
        preferredEntityId={selectedEntityId ? Number(selectedEntityId) : null}
        tr={tr}
      />
    </div>
  )
}
