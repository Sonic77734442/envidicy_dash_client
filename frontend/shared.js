function renderHeader({ eyebrow, title, subtitle, buttons = [] }) {
  const root = document.getElementById('header-root')
  if (!root) return
  document.body.classList.add('with-sidebar')
  void buttons
  const email = localStorage.getItem('auth_email') || ''
  const isAdmin = email === 'romant997@gmail.com'
  const navItems = isAdmin
    ? [
        { label: 'Админ · Заявки', href: './admin-requests.html' },
        { label: 'Админ · Клиенты', href: './admin-clients.html' },
        { label: 'Админ · Аккаунты', href: './admin-accounts.html' },
        { label: 'Админ · Контрагенты', href: './admin-legal-entities.html' },
        { label: 'Админ · Компания', href: './admin-company.html' },
        { label: 'Админ · Пополнения', href: './admin-topups.html' },
        { label: 'Админ · Кошелек', href: './admin-wallet.html' },
      ]
    : [
        { label: 'Пополнение аккаунтов', href: './topup.html' },
        { label: 'Движение средств', href: './funds.html' },
        { label: 'Медиапланирование', href: './index.html' },
        { label: 'Дашборд', href: './dashboard.html' },
        { label: 'Настройки', href: './settings.html' },
      ]
  const current = location.pathname.split('/').pop()
  const navHtml = navItems
    .map((item) => {
      const active = item.href.endsWith(current) ? 'active' : ''
      return `<a class="nav-link ${active}" href="${item.href}">${item.label}</a>`
    })
    .join('')
  const hasAuth = Boolean(getAuthToken?.() || localStorage.getItem('auth_token'))
  const authHtml = hasAuth
    ? '<button class="nav-link nav-exit" id="nav-logout" type="button">Выход</button>'
    : '<a class="nav-link" href="./login.html">Вход</a>'
  root.innerHTML = `
    <nav class="sidebar">
      <div class="sidebar-brand">
        <span>Envidicy</span>
      </div>
      <div id="sidebar-balance" class="sidebar-balance">Баланс: —</div>
      ${isAdmin ? '' : '<button class="btn primary full" id="sidebar-topup" type="button">Пополнить баланс</button>'}
      <div class="nav">${navHtml}</div>
      <div class="nav-footer">${authHtml}</div>
    </nav>
    <div class="topbar">
      <div>
        <p class="eyebrow">${eyebrow ?? ''}</p>
        <h1>${title ?? ''}</h1>
        <p class="lede">${subtitle ?? ''}</p>
      </div>
    </div>
  `
  const logoutBtn = document.getElementById('nav-logout')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_email')
      localStorage.removeItem('auth_user_id')
      window.location.href = './login.html'
    })
  }
  const topupBtn = document.getElementById('sidebar-topup')
  if (topupBtn) {
    topupBtn.addEventListener('click', () => {
      const modal = document.getElementById('wallet-topup-modal')
      if (modal) {
        modal.classList.add('show')
        const amount = document.getElementById('wallet-topup-amount')
        const note = document.getElementById('wallet-topup-note')
        if (amount) amount.value = ''
        if (note) note.value = ''
        return
      }
      window.location.href = './funds.html#topup'
    })
  }
  loadWalletBalance()
}

function getAuthToken() {
  return localStorage.getItem('auth_token')
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function loadWalletBalance() {
  const el = document.getElementById('sidebar-balance')
  if (!el) return
  const token = getAuthToken()
  if (!token) {
    el.textContent = 'Баланс: —'
    return
  }
  fetch('https://envidicy-dash-client.onrender.com/wallet', { headers: authHeaders() })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) return
      const balance = Number(data.balance || 0).toLocaleString('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      el.textContent = `Баланс: ₸${balance}`
    })
    .catch(() => {
      el.textContent = 'Баланс: —'
    })
}
