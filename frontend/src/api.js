const API_BASE = '/api'

export async function api(path, { method = 'POST', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    // non-JSON response body
  }

  if (!res.ok || data?.succeeded === false) {
    const message =
      data?.error ||
      data?.messages?.filter(Boolean).join(', ') ||
      data?.title ||
      `Request failed (${res.status})`
    throw new Error(message)
  }

  return data
}
