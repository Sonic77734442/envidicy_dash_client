const apiBase = window.API_BASE || 'https://envidicy-dash-client.onrender.com'

renderHeader({
  eyebrow: 'Envidicy � Admin',
  title: '������������',
  subtitle: '��� ������������������, ��� ��� �� ���� ��������.',
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
    if (usersStatus) usersStatus.textContent = '��� ������� � �������.'
    return true
  }
  return false
}

function formatDate(value) {
  if (!value) return '�'
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
    if (usersStatus) usersStatus.textContent = '������ �������� �������������.'
  }
}

function renderUsers(rows) {
  if (!usersBody) return
  if (!rows || rows.length === 0) {
    usersBody.innerHTML = `<tr><td colspan="3" class="muted">��� �������������.</td></tr>`
    return
  }
  usersBody.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.email || '�'}</td>
        <td>${formatDate(row.created_at)}</td>
        <td style="text-align:right;">
          <button class="btn primary small" data-make-client="${row.id}" data-email="${row.email || ''}">
            ������� ��������
          </button>
        </td>
      </tr>
    `
    )
    .join('')
}

if (usersBody) {
  usersBody.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-make-client]')
    if (!btn) return
    const userId = btn.dataset.makeClient
    const email = btn.dataset.email || '������������'
    if (!userId) return
    if (!confirm(`��������� ${email} � �������?`)) return
    try {
      const res = await fetch(`${apiBase}/admin/users/${userId}/make-client`, {
        method: 'POST',
        headers: authHeadersSafe(),
      })
      if (handleAuthFailure(res)) return
      if (!res.ok) throw new Error('Failed to update user')
      if (usersStatus) usersStatus.textContent = '������������ �������� � �������.'
      await fetchUsers()
    } catch (e) {
      if (usersStatus) usersStatus.textContent = '������ �������� � �������.'
    }
  })
}

fetchUsers()


