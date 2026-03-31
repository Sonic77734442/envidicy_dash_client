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

function money(v, d = 2) {
  return Number(v || 0).toLocaleString('ru-RU', {
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

export default function AppShell({ eyebrow, title, subtitle, area = 'client', children }) {
  const router = useRouter()
  const pathname = usePathname()

  const [profile, setProfile] = useState({ email: '', name: '' })
  const [walletText, setWalletText] = useState('Баланс: —')
  const [rateUsd, setRateUsd] = useState('USD: курс недоступен')
  const [rateEur, setRateEur] = useState('EUR: курс недоступен')
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
        { label: 'Админ · Заявки', href: '/admin/requests' },
        { label: 'Админ · Клиенты', href: '/admin/clients' },
        { label: 'Админ · Аккаунты', href: '/admin/accounts' },
        { label: 'Админ · Пополнения', href: '/admin/topups' },
        { label: 'Админ · Кошелек', href: '/admin/wallet' },
        { label: 'Админ · Пользователи', href: '/admin/users' },
        { label: 'Админ · Агентства', href: '/admin/agencies' },
        { label: 'Админ · Компания', href: '/admin/company' },
        { label: 'Админ · Контрагенты', href: '/admin/legal-entities' },
      ]
    }
    return [
      { label: 'Пополнение аккаунтов', href: '/topup' },
      { label: 'Финансы', href: '/funds' },
      { label: 'Медиапланирование', href: '/plan' },
      { label: 'Дашборд', href: '/dashboard' },
      { label: 'Инструменты', href: '/tools' },
      { label: 'Настройки', href: '/settings' },
    ]
  }, [area])

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
          name: data.name || data.company || 'Профиль',
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
        const usdRate = getMarkedRate(ratesData?.rates?.USD)
        const eurRate = getMarkedRate(ratesData?.rates?.EUR)

        if (usdRate && eurRate) {
          setWalletText(
            `Баланс: ₸${money(balanceKzt, 0)} · $${money(balanceKzt / usdRate)} · €${money(balanceKzt / eurRate)}`
          )
        } else {
          setWalletText(`Баланс: ₸${money(balanceKzt, 0)}`)
        }
        setRateUsd(usdRate ? `USD: 1$ = ${money(usdRate)} ₸` : 'USD: курс недоступен')
        setRateEur(eurRate ? `EUR: 1€ = ${money(eurRate)} ₸` : 'EUR: курс недоступен')
      } catch {
        // ignore
      }
    }

    loadProfile()
    loadWalletAndRates()
  }, [area])

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
            <a key={item.href} className={`nav-link ${pathname === item.href ? 'active' : ''}`} href={item.href}>
              {item.label}
            </a>
          ))}
        </div>
        {area === 'client' ? (
          <div className="sidebar-rates-panel">
            <div className="sidebar-rates-title">Курс пополнения</div>
            <div className="sidebar-rate-row">{rateUsd}</div>
            <div className="sidebar-rate-row">{rateEur}</div>
          </div>
        ) : null}
        <div className="nav-footer">
          {isAdmin && area === 'client' ? (
            <a className="nav-link" href="/admin/requests">
              Админка
            </a>
          ) : null}
          <button className="nav-link nav-exit" onClick={logout} type="button">
            Выход
          </button>
        </div>
      </nav>

      <div className={`nav-drawer ${drawerOpen ? 'show' : ''}`} onClick={(e) => e.target === e.currentTarget && setDrawerOpen(false)}>
        <div className="nav-drawer-panel">
          <div className="nav-drawer-head">
            <span>Envidicy</span>
            <button className="btn ghost small" type="button" onClick={() => setDrawerOpen(false)}>
              Закрыть
            </button>
          </div>
          <div className="nav-drawer-links">
            {navItems.map((item) => (
              <a key={item.href} className={`nav-link ${pathname === item.href ? 'active' : ''}`} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>
          {area === 'client' ? (
            <div className="sidebar-rates-panel">
              <div className="sidebar-rates-title">Курс пополнения</div>
              <div className="sidebar-rate-row">{rateUsd}</div>
              <div className="sidebar-rate-row">{rateEur}</div>
            </div>
          ) : null}
          <div className="nav-drawer-footer">
            <button className="nav-link nav-exit" onClick={logout} type="button">
              Выход
            </button>
          </div>
        </div>
      </div>

      <div className="app with-sidebar plan-app">
        <div className="bg-blur" />
        {impersonationActive ? (
          <div className="impersonation-banner">
            <span>Вы вошли как клиент: {impersonationLabel || profile.email || ''}</span>
            <button className="btn ghost small" onClick={logout} type="button">
              Вернуться в админку
            </button>
          </div>
        ) : null}
        <header className="topbar">
          <div className="topbar-right">
            <button className="nav-toggle" type="button" onClick={() => setDrawerOpen(true)} aria-label="Menu">
              ☰
            </button>
            <span className="topbar-context">{eyebrow || 'Envidicy'}</span>
            {area === 'client' ? (
              <>
                <div className="balance-pill">{walletText}</div>
                <a className="topbar-topup-btn" href="/funds?action=topup-balance">
                  Пополнить баланс
                </a>
              </>
            ) : null}
            <div className="topbar-icon-wrap" ref={notificationsRef}>
              <button
                className="topbar-icon-btn"
                type="button"
                aria-label="Уведомления"
                title="Уведомления"
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
                <div className="topbar-popover" role="dialog" aria-label="Уведомления">
                  <div className="topbar-popover-title">Уведомления</div>
                  <div className="topbar-popover-item">Новых уведомлений пока нет</div>
                </div>
              ) : null}
            </div>
            <div className="topbar-icon-wrap" ref={supportRef}>
              <button
                className="topbar-icon-btn"
                type="button"
                aria-label="Поддержка"
                title="Поддержка"
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
                <div className="topbar-popover" role="dialog" aria-label="Поддержка">
                  <div className="topbar-popover-title">Поддержка</div>
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
                  <span>{profile.name || 'Профиль'}</span>
                  <span>{profile.email || ''}</span>
                </span>
              </button>
              {profileMenuOpen ? (
                <div className="profile-menu" role="menu">
                  <a className="profile-menu-item" href="/settings" onClick={() => setProfileMenuOpen(false)} role="menuitem">
                    Настройки
                  </a>
                  {isAdmin ? (
                    <a
                      className="profile-menu-item"
                      href={area === 'admin' ? '/dashboard' : '/admin/requests'}
                      onClick={() => setProfileMenuOpen(false)}
                      role="menuitem"
                    >
                      {area === 'admin' ? 'Клиентская часть' : 'Админка'}
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
                    Выход
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
