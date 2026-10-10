import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const SelectionContext = createContext(null)

const TABLE = 'summary_vehicle_selection'

export function SelectionProvider({ children }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const { data, error: dbError } = await supabase
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: true })
      if (dbError) throw new Error(dbError.message)
      setRows(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const flagAssigned = useCallback((sel) => {
    if (!sel) return false
    return sel.is_assigned ?? sel.selection_type === 'assigned'
  }, [])

  const flagHired = useCallback((sel) => {
    if (!sel) return false
    return sel.is_hired ?? sel.selection_type === 'hired'
  }, [])

  const applyChange = useCallback(async (vehicleCode, unitId, updates) => {
    const { data, error: dbError } = await supabase
      .from(TABLE)
      .upsert({
        vehicle_code: vehicleCode,
        unit_id: unitId,
        ...updates,
      }, { onConflict: 'vehicle_code' })
      .select()

    if (dbError) throw new Error(dbError.message)

    const saved = data?.[0]
    if (saved) {
      setRows((prev) => {
        const filtered = prev.filter((r) => r.id !== saved.id)
        return [...filtered, saved].sort((a, b) =>
          String(a.created_at).localeCompare(String(b.created_at))
        )
      })
    }
    return saved
  }, [])

  const deleteSelection = useCallback(async (id) => {
    const { error: dbError } = await supabase
      .from(TABLE)
      .delete()
      .eq('id', id)

    if (dbError) throw new Error(dbError.message)

    setRows((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const refresh = useCallback(() => {
    load()
  }, [load])

  const value = {
    rows,
    loading,
    error,
    flagAssigned,
    flagHired,
    applyChange,
    deleteSelection,
    refresh,
  }

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection() {
  const context = useContext(SelectionContext)
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider')
  }
  return context
}