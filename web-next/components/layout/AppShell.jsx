'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch } from '../../lib/api'
import {
  clearAuth,
  clearImpersonation,
  getAuthToken,
  getImpersonationLabel,
  getImpersonationReturnUrl,
  isImpersonating,
} from '../../lib/auth'
import { useI18n } from '../../lib/i18n/client'

function money(v, locale, d = 2) {
  return Number(v || 0).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function getMarkedRate(entry) {
  const marked = Number(entry?.sell_marked)
  if (Number.isFinite(marked)) return marked
  const sell = Number(entry?.sell)
  if (Number.isFinite(sell)) return sell
  return null
}

function formatRate(value, locale) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return '—'
  return `${money(numeric, locale, 2)} ₸`
}

export default function AppShell({ eyebrow, title, subtitle, area = 'client', children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { locale, setLocale, t } = useI18n()

  const [profile, setProfile] = useState({ email: '', name: '' })
  const [walletText, setWalletText] = useState(`${t('shell.balanceLabel')}: —`)
  const [rateRows, setRateRows] = useState([
    { code: 'USD', bank: null, marked: null },
    { code: 'EUR', bank: null, marked: null },
  ])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [impersonationActive, setImpersonationActive] = useState(false)
  const [impersonationLabel, setImpersonationLabel] = useState('')
  const profileMenuRef = useRef(null)
  const notificationsRef = useRef(null)
  const supportRef = useRef(null)

  const isAdmin = useMemo(() => {
    const email = String(profile.email || '').toLowerCase()
    return email === 'romant997@gmail.com' || email === 'kolyadov.denis@gmail.com'
  }, [profile.email])

  const navItems = useMemo(() => {
    if (area === 'admin') {
      return [
        { key: 'admin-requests', label: t('shell.nav.adminRequests'), href: '/admin/requests' },
        { key: 'admin-clients', label: t('shell.nav.adminClients'), href: '/admin/clients' },
        { key: 'admin-accounts', label: t('shell.nav.adminAccounts'), href: '/admin/accounts' },
        { key: 'admin-topups', label: t('shell.nav.adminTopups'), href: '/admin/topups' },
        { key: 'admin-wallet', label: t('shell.nav.adminWallet'), href: '/admin/wallet' },
        { key: 'admin-users', label: t('shell.nav.adminUsers'), href: '/admin/users' },
        { key: 'admin-agencies', label: t('shell.nav.adminAgencies'), href: '/admin/agencies' },
        { key: 'admin-company', label: t('shell.nav.adminCompany'), href: '/admin/company' },
        { key: 'admin-entities', label: t('shell.nav.adminEntities'), href: '/admin/legal-entities' },
      ]
    }
    return [
      { key: 'client-topup-accounts', label: t('shell.nav.topupAccounts'), href: '/funds' },
      { key: 'client-finance', label: t('shell.nav.finance'), href: '/funds' },
      { key: 'client-dashboard', label: t('shell.nav.dashboard'), href: '/dashboard' },
      { key: 'client-tools', label: t('shell.nav.tools'), href: '/tools' },
      { key: 'client-settings', label: t('shell.nav.settings'), href: '/settings' },
    ]
  }, [area, t])

  useEffect(() => {
    setImpersonationActive(isImpersonating())
    setImpersonationLabel(getImpersonationLabel())
  }, [pathname])

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await apiFetch('/profile', { headers: authHeaders() })
        if (!res.ok) return
        const data = await res.json()
        setProfile({
          email: data.email || '',
          name: data.name || data.company || t('shell.profile'),
        })
      } catch {
        // ignore
      }
    }

    async function loadWalletAndRates() {
      if (area !== 'client') return
      try {
        const [walletRes, ratesRes] = await Promise.all([
          apiFetch('/wallet', { headers: authHeaders() }),
          apiFetch('/rates/bcc'),
        ])
        const wallet = walletRes.ok ? await walletRes.json() : null
        const ratesData = ratesRes.ok ? await ratesRes.json() : null
        const balanceKzt = Number(wallet?.balance || 0)
        const rates = ratesData?.rates || {}
        setRateRows([
          { code: 'USD', bank: Number(rates?.USD?.sell) || null, marked: getMarkedRate(rates?.USD) || null },
          { code: 'EUR', bank: Number(rates?.EUR?.sell) || null, marked: getMarkedRate(rates?.EUR) || null },
        ])
        setWalletText(`${t('shell.balanceLabel')}: ₸${money(balanceKzt, locale, 0)}`)
      } catch {
        // ignore
      }
    }

    loadProfile()
    loadWalletAndRates()
  }, [area, locale, t])

  useEffect(() => {
    function onDocClick(event) {
      const target = event.target
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileMenuOpen(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false)
      }
      if (supportRef.current && !supportRef.current.contains(target)) {
        setSupportOpen(false)
      }
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
        setNotificationsOpen(false)
        setSupportOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  async function switchLocale(nextLocale) {
    setLocale(nextLocale)
    const token = getAuthToken()
    if (!token) return
    try {
      await apiFetch('/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language: nextLocale }),
      })
    } catch {
      // ignore sync errors
    }
  }

  function logout() {
    if (isImpersonating()) {
      const returnUrl = getImpersonationReturnUrl()
      clearImpersonation()
      router.push(returnUrl)
      return
    }
    clearAuth()
    router.push('/login')
  }

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-brand">Envidicy</div>
        <div className="nav">
          {navItems.map((item) => (
            <a key={item.key} className={`nav-link ${pathname === item.href ? 'active' : ''}`} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
        {area === 'client' ? (
          <div className="sidebar-rates-panel">
            <div className="sidebar-rates-title">{t('shell.ratesTitle')}</div>
            {rateRows.map((row) => (
              <div className="sidebar-rate-row" key={`sidebar-${row.code}`}>
                <span className="sidebar-rate-code">{row.code}</span>
                <span className="sidebar-rate-value">
                  {row.code === 'USD' ? '1$ = ' : row.code === 'EUR' ? '1€ = ' : ''}
                  {formatRate(row.marked || row.bank, locale)}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="nav-footer">
          {isAdmin && area === 'client' ? (
            <a className="nav-link" href="/admin/requests">
              {t('shell.adminPanel')}
            </a>
          ) : null}
          <button className="nav-link nav-exit" onClick={logout} type="button">
            {t('shell.logout')}
          </button>
        </div>
      </nav>

      <div className={`nav-drawer ${drawerOpen ? 'show' : ''}`} onClick={(e) => e.target === e.currentTarget && setDrawerOpen(false)}>
        <div className="nav-drawer-panel">
          <div className="nav-drawer-head">
            <span>Envidicy</span>
            <button className="btn ghost small" type="button" onClick={() => setDrawerOpen(false)}>
              {t('shell.close')}
            </button>
          </div>
          <div className="nav-drawer-links">
            {navItems.map((item) => (
              <a key={item.key} className={`nav-link ${pathname === item.href ? 'active' : ''}`} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
          {area === 'client' ? (
            <div className="sidebar-rates-panel">
              <div className="sidebar-rates-title">{t('shell.ratesTitle')}</div>
              {rateRows.map((row) => (
                <div className="sidebar-rate-row" key={`drawer-${row.code}`}>
                  <span className="sidebar-rate-code">{row.code}</span>
                  <span className="sidebar-rate-value">
                    {row.code === 'USD' ? '1$ = ' : row.code === 'EUR' ? '1€ = ' : ''}
                    {formatRate(row.marked || row.bank, locale)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="nav-drawer-footer">
            <button className="nav-link nav-exit" onClick={logout} type="button">
              {t('shell.logout')}
            </button>
          </div>
        </div>
      </div>

      <div className="app with-sidebar plan-app">
        <div className="bg-blur" />
        {impersonationActive ? (
          <div className="impersonation-banner">
            <span>{t('shell.impersonatingClient')}: {impersonationLabel || profile.email || ''}</span>
            <button className="btn ghost small" onClick={logout} type="button">
              {t('shell.returnToAdmin')}
            </button>
          </div>
        ) : null}
        <header className="topbar">
          <div className="topbar-right">
            <button className="nav-toggle" type="button" onClick={() => setDrawerOpen(true)} aria-label="Menu">
              ☰
            </button>
            <span className="topbar-context">{eyebrow || 'Envidicy'}</span>
            <div className="topbar-locale" aria-label={t('locale.switchAria')}>
              <button
                type="button"
                className={`topbar-locale-btn ${locale === 'en' ? 'active' : ''}`}
                onClick={() => switchLocale('en')}
              >
                {t('locale.en')}
              </button>
              <button
                type="button"
                className={`topbar-locale-btn ${locale === 'ru' ? 'active' : ''}`}
                onClick={() => switchLocale('ru')}
              >
                {t('locale.ru')}
              </button>
            </div>
            {area === 'client' ? (
              <>
                <div className="balance-pill">{walletText}</div>
                <a className="topbar-topup-btn" href="/funds?action=topup-balance">
                  {t('shell.topUpBalance')}
                </a>
              </>
            ) : null}
            <div className="topbar-icon-wrap" ref={notificationsRef}>
              <button
                className="topbar-icon-btn"
                type="button"
                aria-label={t('shell.notifications')}
                title={t('shell.notifications')}
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((v) => !v)
                  setSupportOpen(false)
                  setProfileMenuOpen(false)
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M12 22a2.5 2.5 0 0 0 2.3-1.5h-4.6A2.5 2.5 0 0 0 12 22ZM18 16v-5a6 6 0 1 0-12 0v5L4 18v1h16v-1l-2-2Z" fill="currentColor" />
                </svg>
              </button>
              <span className="topbar-icon-badge" aria-hidden="true" />
              {notificationsOpen ? (
                <div className="topbar-popover" role="dialog" aria-label={t('shell.notifications')}>
                  <div className="topbar-popover-title">{t('shell.notifications')}</div>
                  <div className="topbar-popover-item">{t('shell.noNotifications')}</div>
                </div>
              ) : null}
            </div>
            <div className="topbar-icon-wrap" ref={supportRef}>
              <button
                className="topbar-icon-btn"
                type="button"
                aria-label={t('shell.support')}
                title={t('shell.support')}
                aria-expanded={supportOpen}
                onClick={() => {
                  setSupportOpen((v) => !v)
                  setNotificationsOpen(false)
                  setProfileMenuOpen(false)
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M12 3a8 8 0 0 0-8 8v1.5A2.5 2.5 0 0 0 6.5 15H8v-4H5.05a7 7 0 0 1 13.9 0H16v4h2v1a3 3 0 0 1-3 3h-2.4a2 2 0 1 1 0-2H15a1 1 0 0 0 1-1v-3.5H14v-1.5a8 8 0 0 0-2-5.29A7.95 7.95 0 0 0 12 3Z" fill="currentColor" />
                </svg>
              </button>
              {supportOpen ? (
                <div className="topbar-popover" role="dialog" aria-label={t('shell.support')}>
                  <div className="topbar-popover-title">{t('shell.support')}</div>
                  <a className="topbar-popover-link" href="https://t.me/envidicy" target="_blank" rel="noreferrer">
                    Telegram
                  </a>
                  <a className="topbar-popover-link" href="mailto:support@envidicy.kz">
                    support@envidicy.kz
                  </a>
                </div>
              ) : null}
            </div>
            <div className="profile-menu-wrap" ref={profileMenuRef}>
              <button
                className="profile-btn"
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => {
                  setProfileMenuOpen((v) => !v)
                  setNotificationsOpen(false)
                  setSupportOpen(false)
                }}
              >
                <span className="avatar">{(profile.email || 'U').trim().charAt(0).toUpperCase()}</span>
                <span className="profile-meta">
                  <span>{profile.name || t('shell.profile')}</span>
                  <span>{profile.email || ''}</span>
                </span>
              </button>
              {profileMenuOpen ? (
                <div className="profile-menu" role="menu">
                  <a className="profile-menu-item" href="/settings" onClick={() => setProfileMenuOpen(false)} role="menuitem">
                    {t('shell.settings')}
                  </a>
                  {isAdmin ? (
                    <a
                      className="profile-menu-item"
                      href={area === 'admin' ? '/dashboard' : '/admin/requests'}
                      onClick={() => setProfileMenuOpen(false)}
                      role="menuitem"
                    >
                      {area === 'admin' ? t('shell.clientArea') : t('shell.adminPanel')}
                    </a>
                  ) : null}
                  <button
                    className="profile-menu-item danger"
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false)
                      logout()
                    }}
                  >
                    {t('shell.logout')}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <section className="page-heading">
          <h1>{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </section>

        {children}
      </div>
    </>
  )
}
