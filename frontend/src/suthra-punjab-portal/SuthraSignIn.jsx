import { useState } from 'react'
import { suthraLogin } from './suthraApi'

export default function SuthraSignIn({ onSignIn }) {
  const [cnic, setCnic] = useState('')
  const [password, setPassword] = useState('')
  const [accountType, setAccountType] = useState('employee')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await suthraLogin({ cnic, password, account_type: accountType })
      const token = data?.data?.token
      if (!token) throw new Error('No token received from the Suthra Punjab portal')
      const user = data?.data?.user ?? null
      localStorage.setItem('suthra_token', token)
      localStorage.setItem('suthra_user', JSON.stringify(user))
      onSignIn(token, user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center py-10">
      <div className="anim-fade-up w-full max-w-md">
        <div className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-xl">
          <div className="h-1.5 w-full bg-gradient-to-r from-green-800 via-green-500 to-green-800" />

          <div className="flex items-center gap-4 border-b border-green-100 bg-green-50 px-6 py-5">
            <div>
              <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
                Suthra Punjab Portal
              </p>
              <h2 className="mt-0.5 text-xl font-bold tracking-tight text-green-900">
                Sign in
              </h2>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6">
            <p className="text-sm text-neutral-500">
              Enter your portal credentials to continue
            </p>

            <label className="mt-5 block text-[10px] font-semibold tracking-wider text-green-700 uppercase transition-colors focus-within:text-green-900">
              CNIC
              <input
                type="text"
                inputMode="numeric"
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                required
                autoFocus
                placeholder="13-digit CNIC without dashes"
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

            <label className="mt-4 block text-[10px] font-semibold tracking-wider text-green-700 uppercase transition-colors focus-within:text-green-900">
              Account Type
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-green-200 bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-200 hover:border-green-300 focus:border-green-700 focus:shadow-[0_0_0_4px_rgba(21,128,61,0.12)] focus:outline-none"
              >
                <option value="employee">Employee</option>
              </select>
            </label>

            {error && (
              <p className="anim-fade-up mt-4 border-l-4 border-green-700 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-shine group/btn relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-green-700 to-green-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 hover:shadow-lg hover:shadow-green-700/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
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

          <div className="border-t border-green-100 bg-green-50 px-6 py-3">
            <p className="text-[11px] text-green-800">
              Secure access · suthra.punjab.gov.pk
            </p>
          </div>

          <div className="h-1.5 w-full bg-gradient-to-r from-green-800 via-green-500 to-green-800" />
        </div>
      </div>
    </div>
  )
}
