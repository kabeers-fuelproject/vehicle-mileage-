import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import { usedForOf } from '../usedFor'
import { supabase } from '../supabase'
import VaLogo from './VaLogo'

const TABLE = 'summary_vehicle_selection'

function Meta({ label, value }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums text-green-900">
        {value}
      </dd>
    </div>
  )
}

const primaryBtnClass =
  'btn-shine relative overflow-hidden rounded-full bg-gradient-to-r from-green-700 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 hover:shadow-lg hover:shadow-green-700/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

const hireBtnClass =
  'rounded-full border border-amber-400 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-700 transition-all duration-200 hover:border-amber-500 hover:bg-amber-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'

const assignBtnOff =
  'rounded-full border border-green-200 bg-white px-3 py-1 text-[11px] font-semibold text-green-700 transition-colors hover:border-green-500 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-40'

const hireBtnOff =
  'rounded-full border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold text-amber-700 transition-colors hover:border-amber-500 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40'

const unassignBtnOff =
  'rounded-full border border-red-200 bg-white px-3 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:border-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40'

const assignFillBtn =
  'rounded-full bg-green-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-green-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'

const hireFillBtn =
  'rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'

const unitKey = (u) => String(u.unitID)

function flagAssigned(sel) {
  if (!sel) return false
  return sel.is_assigned ?? sel.selection_type === 'assigned'
}

function flagHired(sel) {
  if (!sel) return false
  return sel.is_hired ?? sel.selection_type === 'hired'
}

export default function AssignedVehiclesTab({ token }) {
  const [vehicles, setVehicles] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [vehiclesError, setVehiclesError] = useState('')
  const [dbError, setDbError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [chosenAssign, setChosenAssign] = useState('')
  const [chosenHire, setChosenHire] = useState('')
  const [busyKey, setBusyKey] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  const [confirmJob, setConfirmJob] = useState(null)
  const selectAllRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const results = await Promise.allSettled([
        api('/vehicle/getlist', { token }),
        supabase
          .from(TABLE)
          .select('*')
          .order('created_at', { ascending: true }),
      ])
      if (cancelled) return

      const [unitsResult, selectionResult] = results
      if (unitsResult.status === 'fulfilled') {
        setVehicles(unitsResult.value?.data ?? [])
      } else {
        setVehiclesError(unitsResult.reason.message)
      }

      if (selectionResult.status === 'rejected') {
        setDbError(selectionResult.reason.message)
      } else if (selectionResult.value.error) {
        setDbError(selectionResult.value.error.message)
      } else {
        setRows(selectionResult.value.data ?? [])
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const selMaps = useMemo(() => {
    const byUnit = new Map()
    const byCode = new Map()
    for (const r of rows) {
      if (r.unit_id) byUnit.set(String(r.unit_id), r)
      if (r.vehicle_code) byCode.set(r.vehicle_code, r)
    }
    return { byUnit, byCode }
  }, [rows])

  const tableItems = useMemo(() => {
    const matched = new Set()
    const list = vehicles.map((u) => {
      const sel =
        selMaps.byUnit.get(unitKey(u)) ?? selMaps.byCode.get(u.alias) ?? null
      if (sel) matched.add(sel.id)
      return {
        key: unitKey(u),
        vehicle: u,
        code: u.alias || unitKey(u),
        usedFor: usedForOf(u.alias),
        sel,
      }
    })
    for (const r of rows) {
      if (matched.has(r.id)) continue
      list.push({
        key: `db-${r.id}`,
        vehicle: null,
        code: r.vehicle_code,
        usedFor: usedForOf(r.vehicle_code),
        sel: r,
      })
    }
    return list
  }, [vehicles, rows, selMaps])

  const shownItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = tableItems
    if (q) {
      list = list.filter(
        (t) =>
          String(t.code ?? '').toLowerCase().includes(q) ||
          String(t.usedFor ?? '').toLowerCase().includes(q),
      )
    }
    if (statusFilter !== 'all') {
      list = list.filter((t) => {
        const a = flagAssigned(t.sel)
        const h = flagHired(t.sel)
        if (statusFilter === 'assigned') return a
        if (statusFilter === 'unassigned') return !a
        if (statusFilter === 'hired') return h
        if (statusFilter === 'unhired') return !h
        if (statusFilter === 'both') return a && h
        return true
      })
    }
    return list
  }, [tableItems, search, statusFilter])

  const assignableItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tableItems.filter((t) => {
      if (!t.vehicle || flagAssigned(t.sel)) return false
      if (!q) return true
      return (
        String(t.code ?? '').toLowerCase().includes(q) ||
        String(t.usedFor ?? '').toLowerCase().includes(q)
      )
    })
  }, [tableItems, search])

  const hireableItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tableItems.filter((t) => {
      if (!t.vehicle || flagHired(t.sel)) return false
      if (!q) return true
      return (
        String(t.code ?? '').toLowerCase().includes(q) ||
        String(t.usedFor ?? '').toLowerCase().includes(q)
      )
    })
  }, [tableItems, search])

  const assignedCount = rows.filter((r) => flagAssigned(r)).length
  const hiredCount = rows.filter((r) => flagHired(r)).length
  const unassignedCount = tableItems.filter(
    (t) => t.vehicle && !flagAssigned(t.sel),
  ).length

  const chosenAssignItem = chosenAssign
    ? assignableItems.find((t) => t.key === chosenAssign) ?? null
    : null

  const chosenHireItem = chosenHire
    ? hireableItems.find((t) => t.key === chosenHire) ?? null
    : null

  const selectedItems = shownItems.filter((t) => selectedKeys.has(t.key))
  const bulkAssignable = selectedItems.filter(
    (t) => t.vehicle && !flagAssigned(t.sel),
  )
  const bulkHireable = selectedItems.filter(
    (t) => t.vehicle && !flagHired(t.sel),
  )
  const bulkUnassignable = selectedItems.filter((t) => flagAssigned(t.sel))
  const bulkHirable = selectedItems.filter((t) => flagHired(t.sel))
  const allVisibleSelected =
    shownItems.length > 0 && shownItems.every((t) => selectedKeys.has(t.key))

  useEffect(() => {
    const el = selectAllRef.current
    if (!el) return
    const sel = shownItems.filter((t) => selectedKeys.has(t.key)).length
    el.indeterminate = sel > 0 && sel < shownItems.length
  }, [shownItems, selectedKeys])

  function toggleKey(key) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAllVisible() {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const t of shownItems) next.delete(t.key)
      } else {
        for (const t of shownItems) next.add(t.key)
      }
      return next
    })
  }

  const actionsDisabled = busyKey !== null

  function nextFlags(sel, action) {
    const curAssigned = flagAssigned(sel)
    const curHired = flagHired(sel)
    if (action === 'assign') return { is_assigned: true, is_hired: curHired }
    if (action === 'unassign') return { is_assigned: false, is_hired: curHired }
    if (action === 'hire') return { is_assigned: curAssigned, is_hired: true }
    return { is_assigned: curAssigned, is_hired: false } // unhire
  }

  async function applyState(item, next, action) {
    if (busyKey || !item) return false
    setBusyKey(item.key)
    setDbError('')
    setNotice('')
    try {
      if (!next.is_assigned && !next.is_hired) {
        if (!item.sel) return false
        const { error } = await supabase
          .from(TABLE)
          .delete()
          .eq('id', item.sel.id)
        if (error) throw new Error(error.message)
        setRows((prev) => prev.filter((r) => r.id !== item.sel.id))
        setNotice(`${item.code} ${action === 'unhire' ? 'unhired' : 'unassigned'}.`)
        if (item.key === chosenAssign && next.is_assigned) setChosenAssign('')
        if (item.key === chosenHire && next.is_hired) setChosenHire('')
        return true
      }

      const insert = {
        vehicle_code: item.code,
        unit_id: item.vehicle
          ? unitKey(item.vehicle)
          : (item.sel?.unit_id ?? null),
        is_assigned: Boolean(next.is_assigned),
        is_hired: Boolean(next.is_hired),
      }

      const { data, error } = await supabase
        .from(TABLE)
        .upsert(insert, { onConflict: 'vehicle_code' })
        .select()
      if (error) throw new Error(error.message)

      const saved = data?.[0]
      if (saved) {
        setRows((prev) =>
          [...prev.filter((r) => r.id !== saved.id), saved].sort((a, b) =>
            String(a.created_at).localeCompare(String(b.created_at)),
          ),
        )
      }
      const messages = {
        assign: `${item.code} assigned.`,
        unassign: next.is_hired
          ? `${item.code} unassigned — still hired.`
          : `${item.code} unassigned.`,
        hire: `${item.code} hired.`,
        unhire: `${item.code} unhired.`,
      }
      setNotice(messages[action] ?? `${item.code} updated.`)
      if (item.key === chosenAssign && next.is_assigned) setChosenAssign('')
      if (item.key === chosenHire && next.is_hired) setChosenHire('')
      return true
    } catch (err) {
      setDbError(err.message)
      return false
    } finally {
      setBusyKey(null)
    }
  }

  async function bulkApply(action, items) {
    if (busyKey || items.length === 0) return false
    setBusyKey('bulk')
    setDbError('')
    setNotice('')
    let done = 0
    try {
      for (const item of items) {
        const next = nextFlags(item.sel, action)
        if (!next.is_assigned && !next.is_hired) {
          if (!item.sel) continue
          const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', item.sel.id)
          if (error) throw new Error(error.message)
          const id = item.sel.id
          setRows((prev) => prev.filter((r) => r.id !== id))
        } else {
          const insert = {
            vehicle_code: item.code,
            unit_id: item.vehicle
              ? unitKey(item.vehicle)
              : (item.sel?.unit_id ?? null),
            is_assigned: Boolean(next.is_assigned),
            is_hired: Boolean(next.is_hired),
          }
          const { data, error } = await supabase
            .from(TABLE)
            .upsert(insert, { onConflict: 'vehicle_code' })
            .select()
          if (error) throw new Error(error.message)
          const saved = data?.[0]
          if (saved) {
            setRows((prev) =>
              [...prev.filter((r) => r.id !== saved.id), saved].sort((a, b) =>
                String(a.created_at).localeCompare(String(b.created_at)),
              ),
            )
          }
        }
        done++
      }
      const pastTense = {
        assign: 'assigned',
        unassign: 'unassigned',
        hire: 'hired',
        unhire: 'unhired',
      }
      setNotice(
        `${done} vehicle${done === 1 ? '' : 's'} ${pastTense[action] ?? 'updated'}.`,
      )
      setSelectedKeys(new Set())
      return true
    } catch (err) {
      setDbError(
        `Stopped after ${done} of ${items.length}: ${err.message}`,
      )
      return false
    } finally {
      setBusyKey(null)
    }
  }

  async function runConfirmJob() {
    if (!confirmJob) return
    const { action, items } = confirmJob
    let ok = false
    if (items.length === 1) {
      ok = await applyState(items[0], nextFlags(items[0].sel, action), action)
    } else if (items.length > 1) {
      ok = await bulkApply(action, items)
    }
    if (ok) setConfirmJob(null)
  }

  useEffect(() => {
    if (!confirmJob) return undefined
    function onKey(e) {
      if (e.key === 'Escape' && !busyKey) setConfirmJob(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmJob, busyKey])

  const jobAction = confirmJob?.action ?? 'unassign'
  const jobCount = confirmJob?.items.length ?? 0
  const jobPrimary =
    {
      assign: 'Assign',
      unassign: 'Unassign',
      hire: 'Hire',
      unhire: 'Unhire',
    }[jobAction] ?? 'Unassign'
  const jobBusy =
    busyKey === 'bulk' ||
    (jobCount === 1 && busyKey === confirmJob?.items[0].key)

  return (
    <div className="overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-sm">
      <div className="h-1.5 w-full bg-green-700" />

      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-neutral-200 px-6 py-5">
        <div className="flex items-center gap-4">
          <VaLogo className="h-11 w-11" />
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
              Vehicle Automation
            </p>
            <h3 className="text-lg font-bold tracking-tight text-ink">
              Assigned Vehicles
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Assign or hire vehicles for the summary — both at the same time
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-x-8 gap-y-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3.5">
          <Meta label="Assigned" value={`${assignedCount}`} />
          <Meta label="Hired" value={`${hiredCount}`} />
          <Meta label="Unassigned" value={`${unassignedCount}`} />
        </dl>
      </div>

      {loading && (
        <div className="flex items-center gap-2.5 px-6 py-5 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
          Loading vehicles and saved selection...
        </div>
      )}

      {!loading && (vehiclesError || dbError) && (
        <p className="mx-6 mt-5 border-l-4 border-red-600 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {vehiclesError || dbError}
        </p>
      )}

      {!loading && notice && (
        <p className="mx-6 mt-5 border-l-4 border-green-700 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          {notice}
        </p>
      )}

      {!loading && !vehiclesError && !dbError && (
        <>
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-6 py-4">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setSelectedKeys(new Set())
              }}
              placeholder="Search by vehicle code or Used For..."
              className="w-80 rounded-lg border border-green-200 bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-200 placeholder:text-neutral-400 hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none"
            />
            {search.trim() && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setSelectedKeys(new Set())
                }}
                className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
              >
                Clear
              </button>
            )}
            <span className="text-xs text-neutral-500">
              {assignedCount} assigned · {hiredCount} hired · {unassignedCount} unassigned
            </span>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {assignableItems.length === 0 ? (
                <span className="text-xs text-neutral-500">
                  {vehicles.length === 0
                    ? 'No vehicles available.'
                    : search.trim()
                      ? `No vehicles to assign match "${search.trim()}"`
                      : 'All vehicles are already assigned.'}
                </span>
              ) : (
                <>
                  <span className="relative inline-flex w-64">
                    <select
                      value={chosenAssignItem ? chosenAssign : ''}
                      onChange={(e) => setChosenAssign(e.target.value)}
                      className="w-full cursor-pointer appearance-none rounded-lg border border-green-200 bg-white py-2 pr-10 pl-3.5 text-sm text-ink shadow-sm transition-all duration-200 hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none"
                    >
                      <option value="" className="bg-white text-neutral-400">
                        Vehicle to assign...
                      </option>
                      {assignableItems.map((t) => (
                        <option
                          key={t.key}
                          value={t.key}
                          className="bg-white text-black"
                        >
                          {t.code}
                          {t.usedFor ? ` — ${t.usedFor}` : ''}
                        </option>
                      ))}
                    </select>
                    <svg
                      viewBox="0 0 24 24"
                      className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-green-700"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      applyState(
                        chosenAssignItem,
                        nextFlags(chosenAssignItem?.sel, 'assign'),
                        'assign',
                      )
                    }
                    disabled={actionsDisabled || !chosenAssignItem}
                    className={`${primaryBtnClass} px-4 py-2`}
                  >
                    {busyKey && chosenAssignItem && busyKey === chosenAssignItem.key
                      ? 'Saving...'
                      : 'Assign'}
                  </button>
                </>
              )}

              <span className="mx-1 hidden h-6 w-px bg-neutral-200 xl:block" />

              {hireableItems.length === 0 ? (
                <span className="text-xs text-neutral-500">
                  {vehicles.length === 0
                    ? 'No vehicles available.'
                    : search.trim()
                      ? `No vehicles to hire match "${search.trim()}"`
                      : 'All vehicles are already hired.'}
                </span>
              ) : (
                <>
                  <span className="relative inline-flex w-64">
                    <select
                      value={chosenHireItem ? chosenHire : ''}
                      onChange={(e) => setChosenHire(e.target.value)}
                      className="w-full cursor-pointer appearance-none rounded-lg border border-amber-300 bg-white py-2 pr-10 pl-3.5 text-sm text-ink shadow-sm transition-all duration-200 hover:border-amber-400 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 focus:outline-none"
                    >
                      <option value="" className="bg-white text-neutral-400">
                        Vehicle to hire...
                      </option>
                      {hireableItems.map((t) => (
                        <option
                          key={t.key}
                          value={t.key}
                          className="bg-white text-black"
                        >
                          {t.code}
                          {t.usedFor ? ` — ${t.usedFor}` : ''}
                        </option>
                      ))}
                    </select>
                    <svg
                      viewBox="0 0 24 24"
                      className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-amber-600"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      applyState(
                        chosenHireItem,
                        nextFlags(chosenHireItem?.sel, 'hire'),
                        'hire',
                      )
                    }
                    disabled={actionsDisabled || !chosenHireItem}
                    className={`${hireBtnClass} px-4 py-2`}
                  >
                    {busyKey && chosenHireItem && busyKey === chosenHireItem.key
                      ? 'Saving...'
                      : 'Hire'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
                All Vehicles
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="av-status-filter"
                  className="text-xs font-semibold text-neutral-500"
                >
                  Show
                </label>
                <select
                  id="av-status-filter"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value)
                    setSelectedKeys(new Set())
                  }}
                  className="cursor-pointer rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-600 transition-colors hover:border-neutral-400 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none"
                >
                  <option value="all">All vehicles</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="hired">Hired</option>
                  <option value="unhired">Not hired</option>
                  <option value="both">Assigned &amp; hired</option>
                </select>
                <span className="text-sm text-neutral-500">
                  {search.trim() || statusFilter !== 'all'
                    ? `${shownItems.length} of ${tableItems.length} shown (filtered)`
                    : `${tableItems.length} vehicles`}
                </span>
              </div>
            </div>

            {selectedItems.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3.5 py-2.5">
                <span className="text-xs font-semibold text-green-800">
                  {selectedItems.length} vehicle
                  {selectedItems.length === 1 ? '' : 's'} selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedKeys(new Set())}
                  className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-white"
                >
                  Clear selection
                </button>
                <span className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    title="Assign every selected vehicle that is not assigned (hiring is not affected)"
                    onClick={() =>
                      setConfirmJob({
                        action: 'assign',
                        items: bulkAssignable,
                      })
                    }
                    disabled={actionsDisabled || bulkAssignable.length === 0}
                    className={assignFillBtn}
                  >
                    Assign ({bulkAssignable.length})
                  </button>
                  <button
                    type="button"
                    title="Hire every selected vehicle that is not hired (assignment is not affected)"
                    onClick={() =>
                      setConfirmJob({ action: 'hire', items: bulkHireable })
                    }
                    disabled={actionsDisabled || bulkHireable.length === 0}
                    className={hireFillBtn}
                  >
                    Hire ({bulkHireable.length})
                  </button>
                  <button
                    type="button"
                    title="Unassign every selected vehicle that is assigned (hiring is not affected)"
                    onClick={() =>
                      setConfirmJob({
                        action: 'unassign',
                        items: bulkUnassignable,
                      })
                    }
                    disabled={actionsDisabled || bulkUnassignable.length === 0}
                    className={`${unassignBtnOff} px-3.5 py-1.5 text-xs`}
                  >
                    Unassign ({bulkUnassignable.length})
                  </button>
                  <button
                    type="button"
                    title="Unhire every selected vehicle that is hired (assignment is not affected)"
                    onClick={() =>
                      setConfirmJob({ action: 'unhire', items: bulkHirable })
                    }
                    disabled={actionsDisabled || bulkHirable.length === 0}
                    className={`${hireBtnOff} px-3.5 py-1.5 text-xs`}
                  >
                    Unhire ({bulkHirable.length})
                  </button>
                </span>
              </div>
            )}

            {shownItems.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-green-200 bg-green-50/60 px-4 py-6 text-center text-sm text-green-800/80">
                {tableItems.length === 0
                  ? 'No vehicles available.'
                  : search.trim()
                    ? `No vehicles match "${search.trim()}"`
                    : 'No vehicles match the current filter.'}
              </p>
            ) : (
              <div className="mt-3 max-h-[32rem] overflow-auto rounded-xl border border-green-200">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-[10px] tracking-wider text-white uppercase">
                      <th className="sticky top-0 z-10 bg-green-700 px-4 py-2.5 font-semibold">
                        <span className="flex items-center gap-2.5">
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={toggleAllVisible}
                            aria-label="Select all shown vehicles"
                            className="h-4 w-4 cursor-pointer accent-green-700"
                          />
                          Vehicle Code
                        </span>
                      </th>
                      <th className="sticky top-0 z-10 border-l border-white/25 bg-green-700 px-4 py-2.5 font-semibold">
                        Used For
                      </th>
                      <th className="sticky top-0 z-10 border-l border-white/25 bg-green-700 px-4 py-2.5 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownItems.map((item, i) => {
                      const isAssigned = flagAssigned(item.sel)
                      const isHired = flagHired(item.sel)
                      const isBusy = busyKey === item.key
                      const isSelected = selectedKeys.has(item.key)
                      const rowBg = isSelected
                        ? 'bg-green-100/70'
                        : i % 2 === 1
                          ? 'bg-green-50/40'
                          : ''
                      return (
                        <tr
                          key={item.key}
                          className={`border-b border-neutral-100 transition-colors last:border-0 hover:bg-green-100/60 ${rowBg}`}
                        >
                          <td className="px-4 py-2.5">
                            <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleKey(item.key)}
                                aria-label={`Select ${item.code}`}
                                className="h-4 w-4 shrink-0 cursor-pointer accent-green-700"
                              />
                              <span className="font-semibold text-ink">
                                {item.code}
                              </span>
                              {isAssigned && (
                                <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-green-700 uppercase">
                                  Assigned
                                </span>
                              )}
                              {isHired && (
                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-amber-700 uppercase">
                                  Hired
                                </span>
                              )}
                              {!item.vehicle && (
                                <span className="text-xs font-normal text-amber-600">
                                  (not in vehicle list)
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="border-l border-neutral-200 px-4 py-2.5 text-neutral-600">
                            {item.usedFor || '—'}
                          </td>
                          <td className="border-l border-neutral-200 px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {isAssigned ? (
                                <button
                                  type="button"
                                  title="Remove the assignment (hiring is not affected)"
                                  onClick={() =>
                                    setConfirmJob({
                                      action: 'unassign',
                                      items: [item],
                                    })
                                  }
                                  disabled={actionsDisabled}
                                  className={unassignBtnOff}
                                >
                                  Unassign
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  title="Assign for the summary"
                                  onClick={() =>
                                    applyState(
                                      item,
                                      nextFlags(item.sel, 'assign'),
                                      'assign',
                                    )
                                  }
                                  disabled={actionsDisabled}
                                  className={assignBtnOff}
                                >
                                  Assign
                                </button>
                              )}
                              <button
                                type="button"
                                title={
                                  isHired
                                    ? 'Hired — click to unhire (assignment is not affected)'
                                    : 'Hire for the summary'
                                }
                                onClick={() =>
                                  applyState(
                                    item,
                                    nextFlags(item.sel, isHired ? 'unhire' : 'hire'),
                                    isHired ? 'unhire' : 'hire',
                                  )
                                }
                                disabled={actionsDisabled}
                                className={hireBtnOff}
                              >
                                {isHired ? 'Unhire' : 'Hire'}
                              </button>
                              {isBusy && (
                                <span className="ml-1 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <div className="h-1 w-full bg-green-700" />

      {confirmJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => {
            if (!busyKey) setConfirmJob(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-xl"
          >
            <div
              className={`h-1.5 w-full ${
                jobAction === 'unassign'
                  ? 'bg-red-600'
                  : jobAction === 'assign'
                    ? 'bg-green-600'
                    : 'bg-amber-500'
              }`}
            />
            <div className="px-6 py-5">
              <h4 className="text-base font-bold tracking-tight text-ink">
                {jobCount === 1
                  ? `${jobPrimary} vehicle?`
                  : `${jobPrimary} ${jobCount} vehicles?`}
              </h4>
              <p className="mt-2 text-sm text-neutral-600">
                {jobCount === 1 ? (
                  <>
                    <span className="font-semibold text-ink">
                      {confirmJob.items[0].code}
                    </span>
                    {confirmJob.items[0].usedFor ? (
                      <span className="text-neutral-500">
                        {' '}
                        — {confirmJob.items[0].usedFor}
                      </span>
                    ) : null}{' '}
                    {jobAction === 'assign' ? (
                      <>
                        will be assigned to the summary
                        {flagHired(confirmJob.items[0].sel)
                          ? ' — it will remain hired'
                          : ''}
                        . You can unassign it at any time.
                      </>
                    ) : jobAction === 'unassign' ? (
                      <>
                        will be unassigned from the summary
                        {flagHired(confirmJob.items[0].sel)
                          ? ' — it will remain hired'
                          : ''}
                        . You can assign it again at any time.
                      </>
                    ) : jobAction === 'hire' ? (
                      <>
                        will be hired for the summary
                        {flagAssigned(confirmJob.items[0].sel)
                          ? ' — it will remain assigned'
                          : ''}
                        . You can unhire it at any time.
                      </>
                    ) : (
                      <>
                        will be unhired from the summary — its assignment is
                        not affected.
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-ink">
                      {jobCount} vehicles
                    </span>{' '}
                    {jobAction === 'assign'
                      ? 'will be assigned to the summary — already-hired vehicles keep their hiring.'
                      : jobAction === 'unassign'
                        ? 'will be unassigned from the summary — hired vehicles keep their hiring.'
                        : jobAction === 'hire'
                          ? 'will be hired for the summary — assignments are not affected.'
                          : 'will be unhired from the summary — assignments are not affected.'}{' '}
                    You can reverse this at any time.
                    <span className="mt-1.5 block text-xs text-neutral-500">
                      {confirmJob.items
                        .slice(0, 8)
                        .map((t) => t.code)
                        .join(', ')}
                      {jobCount > 8 ? ` …and ${jobCount - 8} more` : ''}
                    </span>
                  </>
                )}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmJob(null)}
                  disabled={Boolean(busyKey)}
                  className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={runConfirmJob}
                  disabled={Boolean(busyKey)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold text-white shadow-md transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    jobAction === 'unassign'
                      ? 'bg-red-600 shadow-red-600/25 hover:bg-red-700'
                      : jobAction === 'assign'
                        ? 'bg-green-600 shadow-green-600/25 hover:bg-green-700'
                        : 'bg-amber-500 shadow-amber-500/25 hover:bg-amber-600'
                  }`}
                >
                  {jobBusy ? `${jobPrimary}ing…` : jobPrimary}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
