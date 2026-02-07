function renderHeader({ eyebrow, title, subtitle, buttons = [] }) {
  const root = document.getElementById('header-root')
  if (!root) return
  document.body.classList.add('with-sidebar')
  void buttons
  const email = localStorage.getItem('auth_email') || ''
  const isAdmin = email === 'romant997@gmail.com' || email === 'kolyadov.denis@gmail.com'
  const navItems = isAdmin
    ? [
        { label: '����� � ������', href: '/admin/requests' },
        { label: '����� � ������������', href: '/admin/users' },
        { label: '����� � �������', href: '/admin/clients' },
        { label: '����� � ��������', href: '/admin/accounts' },
        { label: '����� � �����������', href: '/admin/legal-entities' },
        { label: '����� � ��������', href: '/admin/company' },
        { label: '����� � �������', href: '/admin/wallet' },
      ]
    : [
        { label: '���������� ���������', href: '/topup' },
        { label: '�������', href: '/funds' },
        { label: '�����������������', href: '/plan' },
        { label: '�������', href: '/dashboard' },
        { label: '�����������', href: '/tools' },
        { label: '���������', href: '/settings' },
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
    ? '<button class="nav-link nav-exit" id="nav-logout" type="button">�����</button>'
    : '<a class="nav-link" href="/login">����</a>'
  root.innerHTML = `
    <nav class="sidebar">
      <div class="sidebar-brand">
        <span>Envidicy</span>
      </div>
      <div class="nav">${navHtml}</div>
      <div class="nav-footer">${authHtml}</div>
    </nav>
    <div class="topbar">
      <div class="topbar-left">
        <p class="eyebrow">${eyebrow ?? ''}</p>
        <h1>${title ?? ''}</h1>
        <p class="lede">${subtitle ?? ''}</p>
      </div>
      <div class="topbar-right">
        ${isAdmin ? '' : '<div id="header-balance" class="balance-pill">������: �</div>'}
        ${isAdmin ? '' : '<button class="btn primary" id="header-topup" type="button">��������� ������</button>'}
        <div class="header-actions">
          ${isAdmin ? '' : '<button class="icon-circle" id="help-btn" data-tooltip="������">?</button>'}
          <div class="dropdown">
            <button class="icon-circle" id="bell-btn" title="�����������">??</button>
            <span id="bell-count" class="badge" hidden></span>
            <div class="dropdown-menu" id="bell-menu">
              <div class="dropdown-head">�����������</div>
              <div class="dropdown-body" id="bell-list">��� �����������.</div>
            </div>
          </div>
          <div class="dropdown">
            <button class="profile-btn" id="profile-btn">
              <span class="avatar" id="header-avatar">?</span>
              <span class="profile-meta">
                <span id="header-name">�������</span>
                <span id="header-email">${email || ''}</span>
              </span>
            </button>
            <div class="dropdown-menu" id="profile-menu">
              <div class="dropdown-head">�������</div>
              <div class="dropdown-body">
                <div class="dropdown-item">
                  <div class="dropdown-title" id="profile-menu-name">�������</div>
                  <div class="dropdown-meta" id="profile-menu-email">${email || ''}</div>
                </div>
              </div>
              <div class="dropdown-body">
                <a class="dropdown-link" href="/settings">������������� �������</a>
                <button class="dropdown-link" id="profile-logout" type="button">�����</button>
              </div>
            </div>
          </div>
        </div>
        ${isAdmin ? '' : '<div class="help-popover" id="help-popover"><div class="help-title">������</div><p>����� ������������? �������� ������.</p><button class="btn ghost small" id="help-request">�������� ������</button></div>'}
      </div>
    </div>
  `
  const logoutBtn = document.getElementById('nav-logout')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_email')
      localStorage.removeItem('auth_user_id')
      window.location.href = '/login'
    })
  }
  const headerTopup = document.getElementById('header-topup')
  if (headerTopup) {
    headerTopup.addEventListener('click', () => {
      const modal = document.getElementById('wallet-topup-modal')
      if (modal) {
        modal.classList.add('show')
        const amount = document.getElementById('wallet-topup-amount')
        const note = document.getElementById('wallet-topup-note')
        if (amount) amount.value = ''
        if (note) note.value = ''
        return
      }
      window.location.href = '/funds#topup'
    })
  }
  const profileLogout = document.getElementById('profile-logout')
  if (profileLogout) {
    profileLogout.addEventListener('click', () => {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_email')
      localStorage.removeItem('auth_user_id')
      window.location.href = '/login'
    })
  }
  const helpBtn = document.getElementById('help-btn')
  const helpPopover = document.getElementById('help-popover')
  if (helpBtn && helpPopover) {
    helpBtn.addEventListener('click', () => {
      closeAllPopovers()
      helpPopover.classList.toggle('show')
    })
    document.addEventListener('click', (event) => {
      if (!helpPopover.contains(event.target) && event.target !== helpBtn) {
        helpPopover.classList.remove('show')
      }
    })
  }
  const helpRequest = document.getElementById('help-request')
  if (helpRequest) {
    helpRequest.addEventListener('click', () => {
      alert('�������� ������, � �� �������� � ����.')
    })
  }
  bindDropdown('bell-btn', 'bell-menu')
  bindDropdown('profile-btn', 'profile-menu')
  loadWalletBalance()
  loadHeaderProfile()
  loadNotifications(isAdmin)
  if (!isAdmin) {
    const bellBtn = document.getElementById('bell-btn')
    if (bellBtn && !bellBtn.dataset.readBound) {
      bellBtn.addEventListener('click', () => {
        markNotificationsRead()
      })
      bellBtn.dataset.readBound = '1'
    }
  }
}

function enforceAuth() {
  const token = localStorage.getItem('auth_token')
  if (token) return
  const current = location.pathname.split('/').pop()
  if (current === 'login' || current === 'register') return
  window.location.href = '/login'
}

function getAuthToken() {
  return localStorage.getItem('auth_token')
}

function authHeaders() {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function loadWalletBalance() {
  const el = document.getElementById('header-balance')
  if (!el) return
  const token = getAuthToken()
  if (!token) {
    el.textContent = '������: �'
    return
  }
  fetch(`${window.API_BASE || 'https://envidicy-dash-client.onrender.com'}/wallet`, { headers: authHeaders() })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data) return
      const balance = Number(data.balance || 0).toLocaleString('ru-RU', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      el.textContent = `������: ?${balance}`
    })
    .catch(() => {
      el.textContent = '������: �'
    })
}

function bindDropdown(triggerId, menuId) {
  const trigger = document.getElementById(triggerId)
  const menu = document.getElementById(menuId)
  if (!trigger || !menu) return
  trigger.addEventListener('click', (event) => {
    event.stopPropagation()
    closeAllPopovers()
    menu.classList.toggle('show')
  })
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target) && event.target !== trigger) {
      menu.classList.remove('show')
    }
  })
}

function closeAllPopovers() {
  const bellMenu = document.getElementById('bell-menu')
  const profileMenu = document.getElementById('profile-menu')
  const helpPopover = document.getElementById('help-popover')
  bellMenu?.classList.remove('show')
  profileMenu?.classList.remove('show')
  helpPopover?.classList.remove('show')
}

async function loadHeaderProfile() {
  const nameEl = document.getElementById('header-name')
  const emailEl = document.getElementById('header-email')
  const avatarEl = document.getElementById('header-avatar')
  const menuName = document.getElementById('profile-menu-name')
  const menuEmail = document.getElementById('profile-menu-email')
  try {
    const res = await fetch(`${window.API_BASE || 'https://envidicy-dash-client.onrender.com'}/profile`, {
      headers: authHeaders(),
    })
    if (!res.ok) return
    const data = await res.json()
    const displayName = data.name || data.company || '�������'
    if (nameEl) nameEl.textContent = displayName
    if (emailEl) emailEl.textContent = data.email || ''
    if (menuName) menuName.textContent = displayName
    if (menuEmail) menuEmail.textContent = data.email || ''
    if (avatarEl && data.avatar_url) {
      avatarEl.innerHTML = `<img src="${window.API_BASE || 'https://envidicy-dash-client.onrender.com'}${data.avatar_url}" alt="avatar" />`
    } else if (avatarEl) {
      const letter = (data.email || 'U').trim().charAt(0).toUpperCase()
      avatarEl.textContent = letter || '?'
    }
  } catch (e) {
    if (emailEl) emailEl.textContent = localStorage.getItem('auth_email') || ''
    if (menuEmail) menuEmail.textContent = localStorage.getItem('auth_email') || ''
  }
}

async function markNotificationsRead() {
  try {
    const res = await fetch(`${window.API_BASE || 'https://envidicy-dash-client.onrender.com'}/notifications/read`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!res.ok) return
    const countEl = document.getElementById('bell-count')
    if (countEl) countEl.hidden = true
  } catch (e) {
    // ignore
  }
}

function renderNotifications(items) {
  if (!items.length) {
    return `<div class="dropdown-empty">��� �����������</div>`
  }
  return items
    .map((item) => {
      const date = formatDate(item.created_at)
      const subtitle =
        item.type === 'account_request'
          ? `${item.platform || ''} ${item.name || ''}`.trim()
          : `${item.platform || ''} ${item.name || ''}`.trim()
      const amount =
        item.amount != null ? ` · ${Number(item.amount).toLocaleString('ru-RU')} ${item.currency || ''}` : ''
      const user = item.user_email ? ` · ${item.user_email}` : ''
      return `
        <div class="dropdown-item">
          <div class="dropdown-title">${item.title}${amount}${user}</div>
          <div class="dropdown-meta">${subtitle} · ${date}</div>
        </div>
      `
    })
    .join('')
}

function formatDate(value) {
  if (!value) return '—'
  const str = String(value)
  if (str.includes('T')) return str.split('T')[0]
  return str.split(' ')[0]
}

function enforceAdminRoutes() {
  const email = localStorage.getItem('auth_email') || ''
  const isAdmin = email === 'romant997@gmail.com' || email === 'kolyadov.denis@gmail.com'
  const path = location.pathname
  const blocked = ['/admin/accounts', '/admin/topups']
  if (!blocked.includes(path)) return
  if (!isAdmin) window.location.href = '/login'
}

enforceAuth()
enforceAdminRoutes()





async function loadNotifications(isAdmin) {
  const listEl = document.getElementById('bell-list')
  const countEl = document.getElementById('bell-count')
  if (!listEl) return
  try {
    const url = isAdmin
      ? `${window.API_BASE || 'https://envidicy-dash-client.onrender.com'}/admin/notifications`
      : `${window.API_BASE || 'https://envidicy-dash-client.onrender.com'}/notifications`
    const res = await fetch(url, { headers: authHeaders() })
    if (!res.ok) throw new Error('notifications failed')
    const data = await res.json()
    const items = Array.isArray(data) ? data : data.items || []
    const unread = Array.isArray(data) ? items.length : Number(data.unread || 0)
    if (!items.length) {
      listEl.textContent = '��� �����������.'
      if (countEl) countEl.hidden = true
      return
    }
    if (countEl) {
      countEl.textContent = String(unread)
      countEl.hidden = unread <= 0
    }
    if (isAdmin) {
      const requests = items.filter((i) => i.type === 'account_request')
      const topups = items.filter((i) => i.type === 'topup')
      listEl.innerHTML = `
        <div class="dropdown-section">
          <div class="dropdown-subhead">������ �� �������</div>
          ${renderNotifications(requests)}
        </div>
        <div class="dropdown-section">
          <div class="dropdown-subhead">����������</div>
          ${renderNotifications(topups)}
        </div>
      `
      return
    }
    listEl.innerHTML = renderNotifications(items)
  } catch (e) {
    listEl.textContent = '�� ������� ��������� �����������.'
  }
}


