const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

renderHeader({
  eyebrow: 'Envidicy · Admin',
  title: 'Пользователи',
  subtitle: 'Все зарегистрированные, кто ещё не стал клиентом.',
  buttons: [],
})

const usersBody = document.getElementById('admin-users')
const usersStatus = document.getElementById('admin-users-status')

function authHeadersSafe() {
  const token = localStorage.getItem('auth_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function handleAuthFailure(res) {
  if (res.status === 401 || res.status === 403) {
    if (usersStatus) usersStatus.textContent = 'Нет доступа к админке.'
    return true
  }
  return false
}

function formatDate(value) {
  if (!value) return '—'
  const str = String(value)
  if (str.includes('T')) return str.split('T')[0]
  return str.split(' ')[0]
}

async function fetchUsers() {
  try {
    const res = await fetch(`${apiBase}/admin/users`, { headers: authHeadersSafe() })
    if (handleAuthFailure(res)) return
    if (!res.ok) throw new Error('Failed to load users')
    const data = await res.json()
    renderUsers(data)
  } catch (e) {
    if (usersStatus) usersStatus.textContent = 'Ошибка загрузки пользователей.'
  }
}

function renderUsers(rows) {
  if (!usersBody) return
  if (!rows || rows.length === 0) {
    usersBody.innerHTML = `<tr><td colspan="2" class="muted">Нет пользователей.</td></tr>`
    return
  }
  usersBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.email || '—'}</td>
        <td>${formatDate(row.created_at)}</td>
      </tr>
    `
    )
    .join('')
}

fetchUsers()
