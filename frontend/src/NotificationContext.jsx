import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import { api } from './api'
import { dayRange } from './reportRange'
import { vehicleTypeOf } from './vehicleTypes'
import { findThreshold } from './thresholds'

const NotificationContext = createContext(null)

const TABLE = 'notifications'
const MILEAGE_TYPES = ['mileage_update', 'low_mileage', 'zero_mileage']

function todayRange() {
  return dayRange(new Date())
}

function normalizeKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function parseNumber(value) {
  const n = parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n : null
}

function parseDuration(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const parts = text.split(':').map((part) => parseFloat(part))
  if (parts.some((part) => !Number.isFinite(part))) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 3600 + parts[1] * 60
  return parts[0] * 3600
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function mergeMileage(values) {
  if (values.length === 1) return values[0] ?? ''
  const numbers = values.map(parseNumber).filter((n) => n !== null)
  if (numbers.length === 0) return ''
  const total = numbers.reduce((sum, n) => sum + n, 0)
  return String(Math.round(total * 10) / 10)
}

function mergeHours(values) {
  if (values.length === 1) return values[0] ?? ''
  const durations = values.map(parseDuration)
  if (durations.every((d) => d === null)) return ''
  const total = durations.reduce((sum, d) => sum + (d ?? 0), 0)
  return formatDuration(total)
}

function buildReportMap(summaryRows) {
  const grouped = new Map()
  for (const row of summaryRows ?? []) {
    const key = normalizeKey(row.vehicleRegNumber)
    if (!key) continue
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(row)
  }
  const map = {}
  for (const [key, rows] of grouped) {
    map[key] = {
      mileage: mergeMileage(rows.map((r) => r.mileage)),
      workingHours: mergeHours(rows.map((r) => r.igONTime)),
    }
  }
  return map
}

function computeStatus(code, reportMap) {
  const threshold = findThreshold(vehicleTypeOf(code))
  if (!threshold) return ''
  const mileage = parseNumber(reportMap[normalizeKey(code)]?.mileage)
  const hours = parseDuration(reportMap[normalizeKey(code)]?.workingHours)
  const requiredHours = parseDuration(threshold.workingHours)
  if (mileage === null || hours === null) return ''
  const mileageOk = mileage >= threshold.mileage
  const hoursOk = requiredHours === null || hours >= requiredHours
  return mileageOk && hoursOk ? 'Ok' : 'Low'
}

function computeLowVehicles(vehicles, reportMap) {
  const result = []
  for (const v of vehicles) {
    const code = String(v.alias || v.unitID).trim()
    if (computeStatus(code, reportMap) === 'Low') result.push(code)
  }
  return result.sort()
}

function computeZeroVehicles(vehicles, reportMap) {
  const result = []
  for (const v of vehicles) {
    const code = String(v.alias || v.unitID).trim()
    const mileage = parseNumber(reportMap[normalizeKey(code)]?.mileage)
    if (mileage === null || mileage === 0) result.push(code)
  }
  return result.sort()
}

function formatCodes(codes, max = 5) {
  const shown = codes.slice(0, max).join(', ')
  const extra = codes.length - max
  return extra > 0 ? `${shown} …and ${extra} more` : shown
}

function sameList(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function loadStoredList(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([])
  const [currentFingerprint, setCurrentFingerprint] = useState(
    () => localStorage.getItem('mileageFingerprint'),
  )
  const [lastSeenFingerprint, setLastSeenFingerprint] = useState(
    () => localStorage.getItem('lastSeenMileageFingerprint'),
  )
  const [loading, setLoading] = useState(true)

  const currentFpRef = useRef(currentFingerprint)
  const lastSeenFpRef = useRef(lastSeenFingerprint)
  const notificationsRef = useRef(notifications)
  const busyRef = useRef(false)
  const unitIdsRef = useRef(null)
  const vehiclesRef = useRef(null)

  useEffect(() => { currentFpRef.current = currentFingerprint }, [currentFingerprint])
  useEffect(() => { lastSeenFpRef.current = lastSeenFingerprint }, [lastSeenFingerprint])
  useEffect(() => { notificationsRef.current = notifications }, [notifications])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (cancelled) return
      if (!error && data) setNotifications(data)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const createNotification = useCallback(async ({ type, title, message }) => {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ type, title, message, is_read: false })
      .select()
    if (!error && data && data[0]) {
      setNotifications((prev) => [data[0], ...prev])
    }
    return data?.[0] ?? null
  }, [])

  const notifyIfListChanged = useCallback(async (type, currentList, storageKey, title, label) => {
    const stored = loadStoredList(storageKey)
    if (stored && sameList(stored, currentList)) return

    localStorage.setItem(storageKey, JSON.stringify(currentList))

    if (currentList.length === 0) return

    const hasUnread = notificationsRef.current.some(
      (n) => n.type === type && !n.is_read,
    )
    if (hasUnread) return

    await createNotification({
      type,
      title,
      message: `${currentList.length} vehicle${currentList.length === 1 ? '' : 's'} ${label}: ${formatCodes(currentList)}`,
    })
  }, [createNotification])

  const refreshFingerprint = useCallback(async (token) => {
    if (!token || busyRef.current) return
    busyRef.current = true
    try {
      if (!vehiclesRef.current) {
        const units = await api('/vehicle/getlist', { token })
        vehiclesRef.current = units?.data ?? []
        unitIdsRef.current = vehiclesRef.current.map((u) => u.unitID)
        if (unitIdsRef.current.length === 0) return
      }
      const range = todayRange()
      const resp = await api('/mileage/fingerprint', {
        token,
        body: { UnitIDs: unitIdsRef.current, ...range },
      })

      if (!resp || !resp.fingerprint) return

      const fp = resp.fingerprint
      const prevCurrent = currentFpRef.current
      const lastSeen = lastSeenFpRef.current

      if (fp === prevCurrent) return

      setCurrentFingerprint(fp)
      currentFpRef.current = fp
      localStorage.setItem('mileageFingerprint', fp)

      if (lastSeen && fp !== lastSeen) {
        const hasUnread = notificationsRef.current.some(
          (n) => n.type === 'mileage_update' && !n.is_read,
        )
        if (!hasUnread) {
          await createNotification({
            type: 'mileage_update',
            title: 'New Mileage Update',
            message: 'Fresh mileage data is now available for today.',
          })
        }
      }

      const reportMap = buildReportMap(resp.summary)
      const lowList = computeLowVehicles(vehiclesRef.current, reportMap)
      const zeroList = computeZeroVehicles(vehiclesRef.current, reportMap)

      await notifyIfListChanged(
        'low_mileage', lowList, 'lastNotifiedLowVehicles',
        'Low Mileage Vehicles', 'below threshold',
      )
      await notifyIfListChanged(
        'zero_mileage', zeroList, 'lastNotifiedZeroVehicles',
        'Zero Mileage Vehicles', 'with 0 mileage',
      )
    } catch {
      // silently ignore polling errors
    } finally {
      busyRef.current = false
    }
  }, [createNotification, notifyIfListChanged])

  const markMileageViewed = useCallback(() => {
    const fp = currentFpRef.current
    if (fp) {
      setLastSeenFingerprint(fp)
      lastSeenFpRef.current = fp
      localStorage.setItem('lastSeenMileageFingerprint', fp)
    }
    const unread = notificationsRef.current.filter(
      (n) => MILEAGE_TYPES.includes(n.type) && !n.is_read,
    )
    if (unread.length === 0) return
    const ids = unread.map((n) => n.id)
    supabase
      .from(TABLE)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids)
      .then(() => {
        setNotifications((prev) =>
          prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)),
        )
      })
  }, [])

  const markNotificationRead = useCallback(async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    )
    await supabase
      .from(TABLE)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    const unread = notificationsRef.current.filter((n) => !n.is_read)
    if (unread.length === 0) return
    const ids = unread.map((n) => n.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    await supabase
      .from(TABLE)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in('id', ids)
  }, [])

  const hasUnseenMileageUpdate = Boolean(
    currentFingerprint && lastSeenFingerprint && currentFingerprint !== lastSeenFingerprint,
  )
  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        loading,
        unreadCount,
        hasUnseenMileageUpdate,
        refreshFingerprint,
        markMileageViewed,
        markNotificationRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}