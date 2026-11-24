const BASE = '/api'

async function req(path, opts = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  users: () => req('/users'),
  updateUser: (id, body) => req(`/users/${id}`, { method: 'PATCH', body }),
  templates: () => req('/templates'),
  template: (id) => req(`/templates/${id}`),
  createTemplate: (body) => req('/templates', { method: 'POST', body }),
  projects: () => req('/projects'),
  project: (id) => req(`/projects/${id}`),
  createProject: (body) => req('/projects', { method: 'POST', body }),
  updateProject: (id, body) => req(`/projects/${id}`, { method: 'PATCH', body }),
  step: (id) => req(`/steps/${id}`),
  updateStep: (id, body) => req(`/steps/${id}`, { method: 'PATCH', body }),
  addChecklist: (id, body) => req(`/steps/${id}/checklist`, { method: 'POST', body }),
  toggleChecklist: (id, body) => req(`/checklist/${id}`, { method: 'PATCH', body }),
  notifications: (userId) => req(`/notifications?user_id=${userId}`),
  readNotification: (id) => req(`/notifications/${id}/read`, { method: 'POST' }),
  readAll: (userId) => req('/notifications/read-all', { method: 'POST', body: { user_id: userId } }),
  dashboard: () => req('/dashboard'),
  tasks: (userId) => req(`/tasks?user_id=${userId}`),
  activity: (id) => req(`/projects/${id}/activity`),
  runScan: () => req('/admin/run-deadline-scan', { method: 'POST' })
}
