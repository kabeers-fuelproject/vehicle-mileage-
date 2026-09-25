import { useState } from 'react'
import { api } from '../api'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api('/generate-token', {
        body: { username, password },
      })
      const token = data?.data?.[1]
      if (!token) throw new Error('No token received from server')
      localStorage.setItem('token', token)
      onLogin(token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white">
            VA
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Vehicle Automation
          </span>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
        >
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Enter your credentials to continue
          </p>

          <label className="mt-6 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Username
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </label>

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-neutral-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
            />
          </label>

          {error && (
            <p className="mt-4 border-l-4 border-brand-600 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
