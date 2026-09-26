import { useState } from 'react'
import { api } from '../api'
import loginBg from '../assets/login-bg.jpg'

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-neutral-950 px-4 py-10">
      <img
        src={loginBg}
        alt=""
        aria-hidden="true"
        className="anim-zoom absolute inset-0 h-full w-full object-cover"
      />

      <div className="anim-fade-up relative z-10 w-full max-w-md">
        <div className="group overflow-hidden rounded-2xl border-2 border-neutral-400 bg-white shadow-2xl transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_-15px_rgba(5,46,22,0.65)]">
          <div className="h-1.5 w-full bg-gradient-to-r from-green-800 via-green-500 to-green-800" />

          <div className="flex items-center gap-4 border-b border-green-200 bg-green-50 px-6 py-5 transition-colors duration-300 group-hover:bg-green-100">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-green-700 text-sm font-bold text-white shadow-md shadow-green-700/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
              VA
            </span>
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
                Vehicle Automation
              </p>
              <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-green-900">
                Sign in
              </h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6">
            <p className="text-sm text-neutral-500">
              Enter your credentials to continue
            </p>

            <label className="mt-5 block text-[10px] font-semibold tracking-wider text-green-700 uppercase transition-colors focus-within:text-green-900">
              Username
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="mt-1.5 w-full rounded-lg border border-green-200 bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-200 placeholder:text-neutral-400 hover:border-green-300 focus:border-green-700 focus:shadow-[0_0_0_4px_rgba(21,128,61,0.12)] focus:outline-none"
              />
            </label>

            <label className="mt-4 block text-[10px] font-semibold tracking-wider text-green-700 uppercase transition-colors focus-within:text-green-900">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-green-200 bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-200 placeholder:text-neutral-400 hover:border-green-300 focus:border-green-700 focus:shadow-[0_0_0_4px_rgba(21,128,61,0.12)] focus:outline-none"
              />
            </label>

            {error && (
              <p className="anim-fade-up mt-4 border-l-4 border-green-700 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-shine group/btn relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-green-700 to-green-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 hover:shadow-lg hover:shadow-green-700/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <span className="anim-spin inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <span className="inline-block transition-transform duration-200 group-hover/btn:translate-x-1">
                    →
                  </span>
                </>
              )}
            </button>
          </form>

          <div className="border-t border-green-200 bg-green-50 px-6 py-3 transition-colors duration-300 group-hover:bg-green-100">
            <p className="text-[11px] text-green-800">
              Secure access · Vehicle Automation Suite
            </p>
          </div>

          <div className="h-1.5 w-full bg-gradient-to-r from-green-800 via-green-500 to-green-800" />
        </div>
      </div>
    </div>
  )
}
