import { useState } from 'react'
import SuthraSignIn from './SuthraSignIn'
import LoaderRickshawBeatReport from './LoaderRickshawBeatReport'

function readSession() {
  const token = localStorage.getItem('suthra_token')
  if (!token) return null
  try {
    return { token, user: JSON.parse(localStorage.getItem('suthra_user') || 'null') }
  } catch {
    return { token, user: null }
  }
}

export default function SuthraPortalAuth() {
  const [session, setSession] = useState(readSession)

  function handleSignOut() {
    localStorage.removeItem('suthra_token')
    localStorage.removeItem('suthra_user')
    setSession(null)
  }

  function handleSignIn(token, user) {
    setSession({ token, user })
  }

  if (!session) {
    return <SuthraSignIn onSignIn={handleSignIn} />
  }

  const user = session.user ?? {}
  const rows = [
    ['Name', [user.salutation, user.first_name, user.last_name].filter(Boolean).join(' ')],
    ['CNIC', user.cnic],
    ['Account Type', user.account_type],
    ['Mobile', user.mobile_number],
    ['Last Login', user.last_login],
  ].filter(([, value]) => value)

  return (
    <div className="py-10">
      <div className="mx-auto max-w-7xl">
        <div className="anim-fade-up mx-auto max-w-md">
          <div className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-xl">
            <div className="h-1.5 w-full bg-gradient-to-r from-green-800 via-green-500 to-green-800" />

            <div className="flex items-center gap-4 border-b border-green-100 bg-green-50 px-6 py-5">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-green-600 text-lg font-bold text-white">
                {(user.first_name || 'S')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
                  Suthra Punjab Portal
                </p>
                <h2 className="mt-0.5 truncate text-xl font-bold tracking-tight text-green-900">
                  Signed in
                </h2>
              </div>
            </div>

            <dl className="divide-y divide-green-50 px-6 py-2">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                    {label}
                  </dt>
                  <dd className="truncate text-sm font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="px-6 pb-6 pt-2">
              <button
                onClick={handleSignOut}
                className="w-full rounded-full border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-green-700 transition-all duration-200 hover:border-green-600 hover:bg-green-50 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-green-500/20"
              >
                Sign out of Suthra Punjab Portal
              </button>
            </div>

            <div className="border-t border-green-100 bg-green-50 px-6 py-3">
              <p className="text-[11px] text-green-800">
                Secure access · suthra.punjab.gov.pk
              </p>
            </div>

            <div className="h-1.5 w-full bg-gradient-to-r from-green-800 via-green-500 to-green-800" />
          </div>
        </div>
      </div>
    </div>
  )
}