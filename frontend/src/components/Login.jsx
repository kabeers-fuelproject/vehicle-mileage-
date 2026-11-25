import { useState } from 'react'
import { api } from '../api'
import loginFleet from '../assets/login-fleet.jpg'
import LoadingOverlay from './LoadingOverlay'
import { logActivity } from '../activityLogger'
import { getDeviceDisplayName } from '../deviceInfo'

const FEATURES = [
  {
    title: 'Live fleet visibility',
    description: 'Track vehicle status, trips and assignments in one place.',
    icon: (
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    ),
  },
  {
    title: 'Operational reporting',
    description: 'Generate distance, mileage and summary reports in seconds.',
    icon: (
      <>
        <path d="M3 3v18h18" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
      </>
    ),
  },
  {
    title: 'Secure access',
    description: 'Every action is authenticated and logged for audit.',
    icon: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
  },
]

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      await logActivity('login', `Signed in from ${getDeviceDisplayName()}`, {
        username,
        device: getDeviceDisplayName(),
      })
      onLogin(token)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-neutral-50 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {loading && <LoadingOverlay label="Signing in…" />}

      <div aria-hidden="true" className="absolute inset-0 overflow-hidden lg:hidden">
        <img src={loginFleet} alt="" className="h-full w-full object-cover object-center" />
      </div>

      <aside className="relative hidden overflow-hidden bg-green-950 px-12 py-12 lg:flex lg:flex-col lg:justify-center xl:px-16">
        <img
          src={loginFleet}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        <div className="relative w-full max-w-md [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_2px_12px_rgba(0,0,0,0.6)]">
          <h1 className="text-4xl leading-tight font-bold tracking-tight text-white xl:text-[2.75rem]">
            Manage your fleet with confidence.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/90">
            A single workspace for vehicle status, reporting and field operations across your network.
          </p>

          <ul className="mt-12 space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/25 text-white ring-1 ring-white/30 backdrop-blur-sm">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    {feature.icon}
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{feature.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/85">{feature.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="absolute bottom-8 left-12 text-xs text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_2px_12px_rgba(0,0,0,0.6)] xl:left-16">
          © {new Date().getFullYear()} Vehicle Automation · All rights reserved
        </p>
      </aside>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:min-h-0">
        <div className="anim-fade-up w-full max-w-[420px]">
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-24px_rgba(16,24,40,0.2)]">
            <h2 className="text-[22px] font-semibold tracking-tight text-neutral-900">Sign in</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Enter your credentials to access your account.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="Enter your username"
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-green-700 focus:ring-2 focus:ring-green-700/15 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 pr-16 text-sm text-neutral-900 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors placeholder:text-neutral-400 hover:border-neutral-400 focus:border-green-700 focus:ring-2 focus:ring-green-700/15 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex items-center px-3.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800 focus:outline-none focus-visible:text-green-700"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="anim-fade-up flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-green-700 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-green-900/20 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-green-800 hover:shadow-lg hover:shadow-green-900/30 active:translate-y-0 active:bg-green-900 active:shadow-sm focus-visible:ring-2 focus-visible:ring-green-700/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:bg-green-700 disabled:hover:shadow-sm"
              >
                {loading && (
                  <span className="anim-spin inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white" />
                )}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 border-t border-neutral-100 pt-4 text-center text-xs text-neutral-400">
              Secure access · Vehicle Automation
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
