import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { usedForOf } from '../usedFor'
import { supabase } from '../supabase'
import VaLogo from './VaLogo'

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

const unitKey = (u) => String(u.unitID)

export default function AssignedVehiclesTab({ token }) {
  const [vehicles, setVehicles] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [vehiclesError, setVehiclesError] = useState('')
  const [dbError, setDbError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [chosen, setChosen] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const results = await Promise.allSettled([
        api('/vehicle/getlist', { token }),
        supabase
          .from('summary_vehicle_selection')
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

  const savedKeys = useMemo(
    () => new Set(rows.map((r) => String(r.unit_id ?? ''))),
    [rows],
  )

  const selectedVehicles = useMemo(() => {
    const byUnit = new Map(vehicles.map((u) => [unitKey(u), u]))
    const byCode = new Map(vehicles.map((u) => [u.alias, u]))
    return rows.map((r) => {
      const vehicle =
        byUnit.get(String(r.unit_id ?? '')) ?? byCode.get(r.vehicle_code)
      const code = vehicle?.alias ?? r.vehicle_code
      return { ...r, vehicle, code, usedFor: usedForOf(code) }
    })
  }, [rows, vehicles])

  const availableUnits = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vehicles.filter((u) => {
      if (savedKeys.has(unitKey(u))) return false
      if (!q) return true
      const code = String(u.alias ?? '').toLowerCase()
      const usedFor = String(usedForOf(u.alias) ?? '').toLowerCase()
      return code.includes(q) || usedFor.includes(q)
    })
  }, [vehicles, savedKeys, search])

  const filteredSelectedVehicles = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return selectedVehicles
    return selectedVehicles.filter(
      (r) =>
        String(r.code ?? '').toLowerCase().includes(q) ||
        String(r.usedFor ?? '').toLowerCase().includes(q),
    )
  }, [selectedVehicles, search])

  const chosenUnit = chosen
    ? availableUnits.find((u) => unitKey(u) === chosen) ?? null
    : null

  async function addChosen() {
    if (!chosenUnit || saving) return
    setSaving(true)
    setDbError('')
    setNotice('')

    const insert = {
      vehicle_code:
        String(chosenUnit.alias ?? '').trim() || unitKey(chosenUnit),
      unit_id: unitKey(chosenUnit),
    }

    const { data, error } = await supabase
      .from('summary_vehicle_selection')
      .upsert(insert, { onConflict: 'vehicle_code', ignoreDuplicates: true })
      .select()

    setSaving(false)
    if (error) {
      setDbError(error.message)
      return
    }
    const added = data ?? []
    setChosen('')
    if (added.length === 0) {
      setNotice(`${insert.vehicle_code} is already assigned.`)
      return
    }
    setRows((prev) =>
      [...prev, ...added].sort((a, b) =>
        String(a.created_at).localeCompare(String(b.created_at)),
      ),
    )
    setNotice(`${insert.vehicle_code} added to the assigned vehicles.`)
  }

  async function removeRow(row) {
    if (saving || removingId) return
    setRemovingId(row.id)
    setDbError('')
    setNotice('')
    const { error } = await supabase
      .from('summary_vehicle_selection')
      .delete()
      .eq('id', row.id)
    setRemovingId(null)
    if (error) {
      setDbError(error.message)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    setRemoveTarget(null)
    setNotice(`${row.code} removed from the assigned vehicles.`)
  }

  useEffect(() => {
    if (!removeTarget) return undefined
    function onKey(e) {
      if (e.key === 'Escape' && !removingId) setRemoveTarget(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [removeTarget, removingId])

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
              Manage the vehicles assigned for the summary
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3.5">
          <Meta label="Selected" value={`${rows.length} / ${vehicles.length}`} />
          <Meta label="Unassigned" value={`${availableUnits.length}`} />
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by vehicle code or Used For..."
              className="w-80 rounded-lg border border-green-200 bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-200 placeholder:text-neutral-400 hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none"
            />
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-500 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
              >
                Clear
              </button>
            )}
            <span className="text-xs text-neutral-500">
              {filteredSelectedVehicles.length} assigned · {availableUnits.length} unassigned
            </span>

            <div className="ml-auto flex items-center gap-3">
              {availableUnits.length === 0 ? (
                <span className="text-xs text-neutral-500">
                  {vehicles.length === 0
                    ? 'No vehicles available.'
                    : search.trim()
                      ? `No unassigned vehicles match "${search.trim()}"`
                      : 'All vehicles are already assigned.'}
                </span>
              ) : (
                <>
                  <span className="relative inline-flex w-72">
                    <select
                      value={chosenUnit ? chosen : ''}
                      onChange={(e) => setChosen(e.target.value)}
                      className="w-full cursor-pointer appearance-none rounded-lg border border-green-200 bg-white py-2 pr-10 pl-3.5 text-sm text-ink shadow-sm transition-all duration-200 hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none"
                    >
                      <option value="" className="bg-white text-neutral-400">
                        Choose a vehicle...
                      </option>
                      {availableUnits.map((u) => (
                        <option
                          key={unitKey(u)}
                          value={unitKey(u)}
                          className="bg-white text-black"
                        >
                          {u.alias || u.unitID}
                          {usedForOf(u.alias) ? ` — ${usedForOf(u.alias)}` : ''}
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
                    onClick={addChosen}
                    disabled={saving || !chosenUnit}
                    className={primaryBtnClass}
                  >
                    {saving ? 'Saving...' : 'Add to Selection'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h4 className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
                Assigned Vehicles
              </h4>
              <span className="text-sm text-neutral-500">
                {search.trim()
                  ? `${filteredSelectedVehicles.length} of ${rows.length} assigned (filtered)`
                  : `${rows.length} of ${vehicles.length} vehicles assigned`}
              </span>
            </div>

            {rows.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-green-200 bg-green-50/60 px-4 py-6 text-center text-sm text-green-800/80">
                No vehicles assigned yet. Choose a vehicle from the dropdown
                above and click Add to Selection.
              </p>
            ) : filteredSelectedVehicles.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-green-200 bg-green-50/60 px-4 py-6 text-center text-sm text-green-800/80">
                No assigned vehicles match "{search.trim()}"
              </p>
            ) : (
              <div className="mt-3 -mx-6 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-green-700 text-[10px] tracking-wider text-white uppercase">
                      <th className="px-6 py-2.5 font-semibold">S #</th>
                      <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                        Vehicle Code
                      </th>
                      <th className="border-l border-white/25 px-4 py-2.5 font-semibold">
                        Used For
                      </th>
                      <th className="border-l border-white/25 px-4 py-2.5 text-right font-semibold">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSelectedVehicles.map((row, i) => (
                      <tr
                        key={row.id}
                        className={`border-b border-neutral-100 transition-colors last:border-0 hover:bg-green-100 ${
                          i % 2 === 1 ? 'bg-green-50' : ''
                        }`}
                      >
                        <td className="px-6 py-3 text-neutral-400">{i + 1}</td>
                        <td className="border-l border-neutral-300 px-4 py-3 font-semibold text-ink">
                          {row.code}
                          {!row.vehicle && (
                            <span className="ml-2 text-xs font-normal text-amber-600">
                              (not in current vehicle list)
                            </span>
                          )}
                        </td>
                        <td className="border-l border-neutral-300 px-4 py-3 text-neutral-600">
                          {row.usedFor || '—'}
                        </td>
                        <td className="border-l border-neutral-300 px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setRemoveTarget(row)}
                            className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-semibold text-red-600 transition-colors hover:border-red-500 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </>
      )}

      <div className="h-1 w-full bg-green-700" />

      {removeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => {
            if (!removingId) setRemoveTarget(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-xl"
          >
            <div className="h-1.5 w-full bg-red-600" />
            <div className="px-6 py-5">
              <h4 className="text-base font-bold tracking-tight text-ink">
                Remove vehicle?
              </h4>
              <p className="mt-2 text-sm text-neutral-600">
                <span className="font-semibold text-ink">{removeTarget.code}</span>
                {removeTarget.usedFor ? (
                  <span className="text-neutral-500"> — {removeTarget.usedFor}</span>
                ) : null}{' '}
                will be removed from the assigned vehicles. You can add it back
                at any time.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRemoveTarget(null)}
                  disabled={Boolean(removingId)}
                  className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(removeTarget)}
                  disabled={Boolean(removingId)}
                  className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-600/25 transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {removingId ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
