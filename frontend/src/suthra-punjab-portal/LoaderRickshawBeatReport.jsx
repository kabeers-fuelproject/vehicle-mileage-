import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getSuthraAclOfficesMetadata,
  searchSuthraLoaderRickshawBeatReport,
} from './suthraApi'
import { supervisorOf } from '../supervisors'

const DEFAULT_DIVISION_NAME = 'Bahawalpur'
const DEFAULT_DISTRICT_NAME = 'Bahawalnagar'
const DEFAULT_TEHSIL_NAME = 'Haroonabad'
const DEFAULT_VEHICLE_TYPES = ['Loader Rickshaw']

const COLUMNS = [
  { key: 'vehicle_label', label: 'Vehicle' },
  { key: 'tehsil_name', label: 'Tehsil' },
  { key: 'total_distance_km', label: 'Total km' },
  { key: 'inside_beat_working_minutes', label: 'Working hours within beat' },
  { key: 'assigned_lr_to_we_trips', label: 'LR beat → WE (3-min stop)' },
  { key: 'supervisor', label: 'Supervisor' },
]

function yesterday() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function formatObservedTime(minutes) {
  const total = Number(minutes)
  if (!Number.isFinite(total) || total <= 0) return '00:00:00'
  const seconds = Math.max(0, Math.round(total * 60))
  const h = Math.floor(seconds / 3600)
  const m = seconds % 3600
  return [h, Math.floor(m / 60), m % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

function formatBeatTime(minutes) {
  return minutes == null || minutes === '' ? '—' : formatObservedTime(minutes)
}

function rowSupervisor(row) {
  const code = String(row?.vehicle_label ?? row?.tracking_identifier ?? '').trim()
  return supervisorOf(code) || ''
}

function formatCell(row, key) {
  switch (key) {
    case 'supervisor':
      return rowSupervisor(row) || '—'
    case 'total_distance_km':
      return Number(row?.total_distance_km || 0).toFixed(1)
    case 'inside_beat_working_minutes':
      return formatBeatTime(row?.inside_beat_working_minutes)
    case 'assigned_lr_to_we_trips':
      return Number(row?.assigned_lr_to_we_trips || 0)
    default: {
      const value = row?.[key]
      return value === null || value === undefined || value === '' ? '—' : value
    }
  }
}

function formatCellForExport(row, key) {
  switch (key) {
    case 'supervisor':
      return rowSupervisor(row) || ''
    case 'total_distance_km':
      return Number(row?.total_distance_km || 0).toFixed(1)
    case 'inside_beat_working_minutes':
      return formatBeatTime(row?.inside_beat_working_minutes).replace('—', '')
    case 'assigned_lr_to_we_trips':
      return Number(row?.assigned_lr_to_we_trips || 0)
    default: {
      const value = row?.[key]
      return value === null || value === undefined || value === '' ? '' : value
    }
  }
}

function exportToExcel(rows, fileName) {
  const headers = ['Sr#', ...COLUMNS.map((c) => c.label)]
  const data = rows.map((row, index) => [
    String(index + 1),
    ...COLUMNS.map((c) => formatCellForExport(row, c.key)),
  ])

  const csv = [
    headers.join(','),
    ...data.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${fileName}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

export default function LoaderRickshawBeatReport({ token }) {
  const [metadata, setMetadata] = useState(null)
  const [metaError, setMetaError] = useState('')
  const [metaLoading, setMetaLoading] = useState(true)

  const [divisionId, setDivisionId] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [officeId, setOfficeId] = useState('')
  const [date, setDate] = useState(yesterday)

  const [rows, setRows] = useState(null)
  const [summary, setSummary] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)

  const [selectedSupervisors, setSelectedSupervisors] = useState([])
  const [supervisorSort, setSupervisorSort] = useState('none')
  const [supervisorDropdownOpen, setSupervisorDropdownOpen] = useState(false)
  const [supervisorDropdownPos, setSupervisorDropdownPos] = useState({ top: 0, left: 0 })
  const supervisorDropdownRef = useRef(null)
  const supervisorBtnRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    setMetaLoading(true)
    setMetaError('')
    getSuthraAclOfficesMetadata(token)
      .then((data) => {
        if (cancelled) return
        const meta = data?.data ?? {}
        setMetadata({
          divisions: meta.divisions ?? [],
          districts: meta.districts ?? [],
          offices: meta.offices ?? [],
          tehsils: meta.tehsils ?? [],
        })
        const defaultDivision = (meta.divisions ?? []).find(
          (d) => String(d.name).toLowerCase() === DEFAULT_DIVISION_NAME.toLowerCase(),
        )
        const defaultDistrict = (meta.districts ?? []).find(
          (d) => String(d.name).toLowerCase() === DEFAULT_DISTRICT_NAME.toLowerCase(),
        )
        const defaultOffice = (meta.offices ?? []).find((o) => {
          const tehsil = (meta.tehsils ?? []).find((t) => String(t.id) === String(o.tehsil_id))
          return (
            Number(o.tehsil_id) > 0 &&
            String(o.name).startsWith('Tehsil Office') &&
            String(tehsil?.name ?? '').toLowerCase() === DEFAULT_TEHSIL_NAME.toLowerCase()
          )
        })
        setDivisionId(defaultDivision ? String(defaultDivision.id) : '')
        setDistrictId(defaultDistrict ? String(defaultDistrict.id) : '')
        setOfficeId(defaultOffice ? String(defaultOffice.id) : '')
      })
      .catch((err) => {
        if (!cancelled) setMetaError(err.message)
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const districts = useMemo(
    () =>
      (metadata?.districts ?? []).filter(
        (d) => !divisionId || String(d.division_id) === String(divisionId),
      ),
    [metadata, divisionId],
  )

  const offices = useMemo(
    () =>
      (metadata?.offices ?? []).filter((o) => {
        const inDistrict = !districtId || String(o.district_id) === String(districtId)
        const district = (metadata?.districts ?? []).find(
          (d) => String(d.id) === String(o.district_id),
        )
        const inDivision =
          !divisionId || (district && String(district.division_id) === String(divisionId))
        return inDistrict && inDivision && Number(o.tehsil_id) > 0
      }),
    [metadata, districtId, divisionId],
  )

  const selectedOffice = useMemo(
    () => (metadata?.offices ?? []).find((o) => String(o.id) === String(officeId)) ?? null,
    [metadata, officeId],
  )

  const selectedTehsil = useMemo(() => {
    if (!selectedOffice) return null
    return (
      (metadata?.tehsils ?? []).find(
        (t) => String(t.id) === String(selectedOffice.tehsil_id),
      ) ?? null
    )
  }, [metadata, selectedOffice])

  const canSearch = Boolean(divisionId && districtId && officeId && date && selectedTehsil)

  const search = useCallback(async () => {
    if (!canSearch) return
    setSearching(true)
    setSearchError('')
    try {
      const data = await searchSuthraLoaderRickshawBeatReport(
        token,
        selectedTehsil.id,
        { date, vehicle_types: DEFAULT_VEHICLE_TYPES, used_for: '', mapped_with_lr: '' },
      )
      const payload = data?.data ?? {}
      setRows(payload.rows ?? [])
      setSummary(payload.summary ?? null)
    } catch (err) {
      setSearchError(err.message)
      setRows(null)
      setSummary(null)
    } finally {
      setSearching(false)
    }
  }, [canSearch, date, selectedTehsil, token])

  useEffect(() => {
    if (canSearch && !searching && rows === null && !metaLoading) {
      search()
    }
  }, [canSearch, metaLoading, search, searching, rows])

  const supervisorOptions = useMemo(() => {
    const counts = new Map()
    for (const row of rows ?? []) {
      const name = rowSupervisor(row) || '—'
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base' }))
      .map(([name, count]) => ({ name, count }))
  }, [rows])

  const visibleRows = useMemo(() => {
    let list = rows ?? []
    if (selectedSupervisors.length > 0) {
      list = list.filter((row) =>
        selectedSupervisors.includes(rowSupervisor(row) || '—'),
      )
    }
    if (supervisorSort !== 'none') {
      list = [...list].sort((a, b) => {
        const result = (rowSupervisor(a) || '—').localeCompare(
          rowSupervisor(b) || '—',
          undefined,
          { sensitivity: 'base' },
        )
        return supervisorSort === 'asc' ? result : -result
      })
    }
    return list
  }, [rows, selectedSupervisors, supervisorSort])

  function dropdownPosFromRect(rect) {
    const width = 224
    const estimatedHeight = 340
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    let top = rect.bottom + 4
    if (top + estimatedHeight > window.innerHeight && rect.top - estimatedHeight > 0) {
      top = Math.max(8, rect.top - estimatedHeight - 4)
    }
    return { top, left }
  }

  function toggleSupervisorDropdown() {
    if (supervisorDropdownOpen) {
      setSupervisorDropdownOpen(false)
      return
    }
    const rect = supervisorBtnRef.current?.getBoundingClientRect()
    if (rect) setSupervisorDropdownPos(dropdownPosFromRect(rect))
    setSupervisorDropdownOpen(true)
  }

  function toggleSupervisor(name) {
    setSelectedSupervisors((prev) =>
      prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name],
    )
  }

  useEffect(() => {
    if (!supervisorDropdownOpen) return
    const onPointerDown = (event) => {
      if (!supervisorDropdownRef.current?.contains(event.target)) {
        setSupervisorDropdownOpen(false)
      }
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSupervisorDropdownOpen(false)
    }
    const reposition = () => {
      const rect = supervisorBtnRef.current?.getBoundingClientRect()
      if (rect) setSupervisorDropdownPos(dropdownPosFromRect(rect))
    }
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(reposition)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', reposition)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', reposition)
    }
  }, [supervisorDropdownOpen])

  const handleExport = () => {
    if (!visibleRows.length) return
    const tehsilName = selectedOffice?.name?.replace(/[^a-z0-9]/gi, '_') || 'report'
    exportToExcel(visibleRows, `LR_Beat_Report_${tehsilName}_${date}`)
  }

  return (
    <div className="mt-8">
      <div className="overflow-hidden rounded-3xl border border-green-100 bg-white shadow-xl">
        <div className="h-1.5 w-full bg-gradient-to-r from-green-800 via-green-500 to-green-800" />

        <div className="border-b border-green-100 bg-green-50 px-6 py-4">
          <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
            Suthra Punjab Portal
          </p>
          <h3 className="mt-0.5 text-lg font-bold tracking-tight text-green-900">
            Loader Rickshaw Beat Performance Report
          </h3>
        </div>

        <div className="flex flex-wrap items-end gap-3 px-6 py-4">
          <label className="min-w-[10rem] flex-1 text-[10px] font-semibold tracking-wider text-green-700 uppercase">
            Division
            <select
              value={divisionId}
              onChange={(e) => {
                setDivisionId(e.target.value)
                setDistrictId('')
                setOfficeId('')
              }}
              className="mt-1.5 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-ink transition-all duration-200 hover:border-green-300 focus:border-green-700 focus:outline-none"
            >
              <option value="">All Divisions</option>
              {(metadata?.divisions ?? []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>

          <label className="min-w-[10rem] flex-1 text-[10px] font-semibold tracking-wider text-green-700 uppercase">
            District
            <select
              value={districtId}
              onChange={(e) => {
                setDistrictId(e.target.value)
                setOfficeId('')
              }}
              className="mt-1.5 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-ink transition-all duration-200 hover:border-green-300 focus:border-green-700 focus:outline-none"
            >
              <option value="">All Districts</option>
              {districts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </label>

          <label className="min-w-[10rem] flex-1 text-[10px] font-semibold tracking-wider text-green-700 uppercase">
            Tehsil Office
            <select
              value={officeId}
              onChange={(e) => setOfficeId(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-ink transition-all duration-200 hover:border-green-300 focus:border-green-700 focus:outline-none"
            >
              <option value="">Select Tehsil Office</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>

          <label className="min-w-[10rem] flex-1 text-[10px] font-semibold tracking-wider text-green-700 uppercase">
            Date
            <input
              type="date"
              value={date}
              max={yesterday()}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-ink transition-all duration-200 hover:border-green-300 focus:border-green-700 focus:outline-none"
            />
          </label>

<button
            onClick={search}
            disabled={!canSearch || searching}
            title="Search"
            className="h-10 w-10 rounded-full bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center text-white shadow-sm shadow-green-600/30 transition-all duration-200 hover:from-green-700 hover:to-green-800 hover:shadow-md hover:shadow-green-600/40 active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            {searching ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35Z" />
              </svg>
            )}
          </button>

          {visibleRows.length > 0 && (
            <button
              onClick={handleExport}
              title="Export to Excel"
              className="h-10 w-10 rounded-full bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center text-white shadow-sm shadow-green-600/30 transition-all duration-200 hover:from-green-700 hover:to-green-800 hover:shadow-md hover:shadow-green-600/40 active:scale-[0.95] focus:outline-none focus:ring-2 focus:ring-green-500/20"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}
        </div>

        {metaLoading && (
          <p className="px-6 pb-4 text-sm text-neutral-500">Loading portal metadata…</p>
        )}

        {metaError && (
          <p className="mx-6 mb-4 border-l-4 border-green-700 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            {metaError}
          </p>
        )}

        {searchError && (
          <p className="mx-6 mb-4 border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {searchError}
          </p>
        )}

        {summary && (
          <div className="grid grid-cols-2 gap-3 px-6 pb-4 sm:grid-cols-4 lg:grid-cols-8">
            {[
              ['Total', summary.total],
              ['Available', summary.available],
              ['No Data', summary.no_data],
              ['VTCS Trips', summary.vtcs_trips],
              ['WE → TCP', summary.we_to_tcp_trips],
              ['TCP → Dumpsite', summary.tcp_to_dumpsite_trips],
              ['Direct Dumpsite', summary.direct_dumpsite_trips],
              ['No Tracking', summary.vtcs_trips_without_tracking],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-green-100 bg-green-50/50 px-3 py-2">
                <p className="text-[9px] font-semibold tracking-wider text-neutral-400 uppercase">
                  {label}
                </p>
                <p className="mt-0.5 text-lg font-bold text-green-800">{value ?? 0}</p>
              </div>
            ))}
          </div>
        )}

        {searching && (
          <p className="px-6 pb-6 text-sm text-neutral-500">Fetching report data…</p>
        )}

        {rows && !searching && (
          <div className="overflow-x-auto border-t border-green-100">
            <table className="w-full min-w-[54rem] table-fixed text-left text-xs">
              <thead className="border-b border-green-100 bg-green-50">
                <tr>
                  <th className="w-14 px-3 py-2.5 text-[10px] font-semibold tracking-wider text-green-700 uppercase">Sr#</th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-[10px] font-semibold tracking-wider text-green-700 uppercase"
                    >
                      {col.key === 'supervisor' ? (
                        <span className="relative inline-flex" ref={supervisorDropdownRef}>
                          <button
                            type="button"
                            ref={supervisorBtnRef}
                            onClick={toggleSupervisorDropdown}
                            aria-haspopup="listbox"
                            aria-expanded={supervisorDropdownOpen}
                            title="Sort and filter by supervisor"
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap transition-colors hover:text-green-900"
                          >
                            {col.label}
                            {supervisorSort !== 'none' && (
                              <span className="text-[9px]">
                                {supervisorSort === 'asc' ? '▲' : '▼'}
                              </span>
                            )}
                            {selectedSupervisors.length > 0 && (
                              <span
                                aria-hidden="true"
                                className="h-1.5 w-1.5 rounded-full bg-green-700"
                              />
                            )}
                            <svg
                              viewBox="0 0 24 24"
                              className={`h-3.5 w-3.5 transition-transform duration-200 ${supervisorDropdownOpen ? 'scale-y-[-1]' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </button>
                          {supervisorDropdownOpen && (
                            <div
                              role="listbox"
                              aria-multiselectable="true"
                              style={{
                                position: 'fixed',
                                top: supervisorDropdownPos.top,
                                left: supervisorDropdownPos.left,
                              }}
                              className="z-30 max-h-80 w-56 overflow-y-auto rounded-xl border border-green-200 bg-white p-1.5 text-left normal-case shadow-lg"
                            >
                              <button
                                type="button"
                                onClick={() => setSupervisorSort('asc')}
                                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition-colors hover:bg-green-50 ${supervisorSort === 'asc' ? 'text-green-800' : 'text-neutral-700'}`}
                              >
                                <span className="w-3.5 text-[10px]">▲</span> Sort A → Z
                              </button>
                              <button
                                type="button"
                                onClick={() => setSupervisorSort('desc')}
                                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition-colors hover:bg-green-50 ${supervisorSort === 'desc' ? 'text-green-800' : 'text-neutral-700'}`}
                              >
                                <span className="w-3.5 text-[10px]">▼</span> Sort Z → A
                              </button>
                              <button
                                type="button"
                                onClick={() => setSupervisorSort('none')}
                                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition-colors hover:bg-green-50 ${supervisorSort === 'none' ? 'text-green-800' : 'text-neutral-700'}`}
                              >
                                <span className="w-3.5 text-[10px]">↕</span> Clear sort
                              </button>
                              <div className="my-1 h-px bg-green-100" />
                              <div className="flex items-center justify-between px-3 pb-1 pt-0.5">
                                <span className="text-[9px] font-semibold tracking-wider text-neutral-400 uppercase">
                                  Filter
                                </span>
                                {selectedSupervisors.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSupervisors([])}
                                    className="cursor-pointer text-[10px] font-semibold text-green-700 hover:text-green-900"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              {supervisorOptions.map((option) => {
                                const selected = selectedSupervisors.includes(option.name)
                                return (
                                  <button
                                    key={option.name}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => toggleSupervisor(option.name)}
                                    title={selected ? 'Untick' : 'Tick'}
                                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold text-black transition-colors hover:bg-green-50"
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border transition-colors duration-150 ${selected ? 'border-green-700 bg-green-700' : 'border-neutral-300 bg-white'}`}
                                    >
                                      {selected && (
                                        <svg
                                          viewBox="0 0 24 24"
                                          className="h-3 w-3 text-white"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="3.2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        >
                                          <path d="m5 13 4 4L19 7" />
                                        </svg>
                                      )}
                                    </span>
                                    <span className="flex-1 break-words">
                                      {option.name} ({option.count})
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </span>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-green-50">
                {visibleRows.map((row, index) => (
                  <tr key={row.id ?? index} className="transition-colors hover:bg-green-50/50">
                    <td className="px-3 py-2.5 font-medium text-ink">{index + 1}</td>
                    {COLUMNS.map((col) => (
                      <td key={col.key} className="whitespace-nowrap px-3 py-2.5 text-neutral-600">
                        {formatCell(row, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
                {!visibleRows.length && (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-sm text-neutral-400">
                      {rows.length
                        ? 'No rows match the selected supervisors.'
                        : 'No rows found for this selection.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-green-100 bg-green-50 px-6 py-3">
          <p className="text-[11px] text-green-800">
            Source · suthra.punjab.gov.pk · Loader Rickshaw Beat Performance Report
          </p>
        </div>

        <div className="h-1.5 w-full bg-gradient-to-r from-green-800 via-green-500 to-green-800" />
      </div>
    </div>
  )
}