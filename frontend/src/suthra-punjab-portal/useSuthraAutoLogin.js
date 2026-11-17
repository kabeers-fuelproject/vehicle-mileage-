import { useState, useEffect } from 'react'
import { suthraLogin } from './suthraApi'

const SUTHRA_CNIC = '6110120068569'
const SUTHRA_PASSWORD = '123pitb3211'
const SUTHRA_ACCOUNT_TYPE = 'employee'

function readSession() {
  const token = localStorage.getItem('suthra_token')
  if (!token) return null
  try {
    return { token, user: JSON.parse(localStorage.getItem('suthra_user') || 'null') }
  } catch {
    return { token, user: null }
  }
}

export function useSuthraAutoLogin() {
  const [session, setSession] = useState(readSession)
  const [autoError, setAutoError] = useState('')
  const [autoSigning, setAutoSigning] = useState(false)

  useEffect(() => {
    let cancelled = false

    const existing = readSession()
    if (existing) {
      setSession(existing)
      return
    }

    let attempts = 0
    const maxAttempts = 3
    const tryLogin = async () => {
      setAutoSigning(true)
      try {
        const data = await suthraLogin({
          cnic: SUTHRA_CNIC,
          password: SUTHRA_PASSWORD,
          account_type: SUTHRA_ACCOUNT_TYPE,
        })
        const token = data?.data?.token
        if (!token) throw new Error('No token received from the Suthra Punjab portal')
        const user = data?.data?.user ?? null
        localStorage.setItem('suthra_token', token)
        localStorage.setItem('suthra_user', JSON.stringify(user))
        if (!cancelled) {
          setSession({ token, user })
          setAutoError('')
        }
      } catch (err) {
        if (cancelled) return
        attempts += 1
        if (attempts < maxAttempts) {
          setTimeout(tryLogin, 2000)
        } else {
          setAutoError(err.message)
        }
      } finally {
        if (!cancelled) setAutoSigning(false)
      }
    }

    tryLogin()
    return () => {
      cancelled = true
    }
  }, [])

  return { session, setSession, autoError, autoSigning }
}