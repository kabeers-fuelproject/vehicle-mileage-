import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from './supabase'
import { setThresholdOverrides } from './thresholds'

const TABLE = 'vehicle_thresholds'

const ThresholdContext = createContext(null)

export function ThresholdProvider({ children }) {
  const [overrides, setOverridesState] = useState({})
  const [version, setVersion] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error } = await supabase
        .from(TABLE)
        .select('veh_type, mileage, working_hours')
      if (cancelled) return
      if (!error && data) {
        const map = {}
        for (const row of data) {
          map[row.veh_type] = {
            mileage: Number(row.mileage),
            workingHours: row.working_hours,
          }
        }
        setThresholdOverrides(map)
        setOverridesState(map)
        setVersion((v) => v + 1)
      }
      if (!cancelled) setReady(true)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const saveThreshold = useCallback(async (vehType, { mileage, workingHours }) => {
    const { error } = await supabase
      .from(TABLE)
      .upsert({
        veh_type: vehType,
        mileage,
        working_hours: workingHours,
        updated_at: new Date().toISOString(),
      })
    if (error) throw error
    setOverridesState((prev) => {
      const next = {
        ...prev,
        [vehType]: { mileage: Number(mileage), workingHours },
      }
      setThresholdOverrides(next)
      return next
    })
    setVersion((v) => v + 1)
  }, [])

  const resetThreshold = useCallback(async (vehType) => {
    const { error } = await supabase.from(TABLE).delete().eq('veh_type', vehType)
    if (error) throw error
    setOverridesState((prev) => {
      const next = { ...prev }
      delete next[vehType]
      setThresholdOverrides(next)
      return next
    })
    setVersion((v) => v + 1)
  }, [])

  const resetAllThresholds = useCallback(async () => {
    const { error } = await supabase.from(TABLE).delete().neq('veh_type', '')
    if (error) throw error
    setThresholdOverrides({})
    setOverridesState({})
    setVersion((v) => v + 1)
  }, [])

  const value = useMemo(
    () => ({ overrides, version, ready, saveThreshold, resetThreshold, resetAllThresholds }),
    [overrides, version, ready, saveThreshold, resetThreshold, resetAllThresholds],
  )

  return (
    <ThresholdContext.Provider value={value}>
      {children}
    </ThresholdContext.Provider>
  )
}

export function useThresholds() {
  const context = useContext(ThresholdContext)
  if (!context) {
    throw new Error('useThresholds must be used within a ThresholdProvider')
  }
  return context
}

// Subscribing components re-render when thresholds change, so
// Ok/Low statuses recomputed during render pick up the new values.
export function useThresholdVersion() {
  return useContext(ThresholdContext)?.version ?? 0
}
