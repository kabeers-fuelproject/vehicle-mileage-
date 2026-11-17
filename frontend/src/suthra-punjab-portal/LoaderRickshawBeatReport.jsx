import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getSuthraAclOfficesMetadata,
  searchSuthraLoaderRickshawBeatReport,
} from './suthraApi'

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

function formatCell(row, key) {
  switch (key) {
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

const SUMMARY_CARDS = [
  { key: 'total', label: 'Total', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { key: 'available', label: 'Available', color: 'bg-green-50 text-green-700 border-green-100' },
  { key: 'no_data', label: 'No Data', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  { key: 'vtcs_trips', label: 'VTCS Trips', color: 'bg-purple-50 text-purple-700 border-purple-100' },
  { key: 'we_to_tcp_trips', label: 'WE → TCP', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { key: 'tcp_to_dumpsite_trips', label: 'TCP → Dumpsite', color: 'bg-teal-50 text-teal-700 border-teal-100' },
  { key: 'direct_dumpsite_trips', label: 'Direct Dumpsite', color: 'bg-orange-50 text-orange-700 border-orange-100' },
  { key: 'vtcs_trips_without_tracking', label: 'No Tracking', color: 'bg-red-50 text-red-700 border-red-100' },
]

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
            className="rounded-full bg-gradient-to-r from-green-700 to-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-green-500/20"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
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
            {SUMMARY_CARDS.map(({ key, label, color }) => (
              <div key={label} className={`rounded-xl border ${color} px-3 py-2`}>
                <p className="text-[9px] font-semibold tracking-wider text-neutral-400 uppercase">
                  {label}
                </p>
                <p className="mt-0.5 text-lg font-bold">{summary[key] ?? 0}</p>
              </div>
            ))}
          </div>
        )}

        {searching && (
          <p className="px-6 pb-6 text-sm text-neutral-500">Fetching report data…</p>
        )}

        {rows && !searching && (
          <div className="overflow-x-auto border-t border-green-100">
            <table className="w-full min-w-[48rem] table-fixed text-left text-xs">
              <thead className="border-b border-green-100 bg-green-50">
                <tr>
                  <th className="w-14 px-3 py-2.5 text-[10px] font-semibold tracking-wider text-green-700 uppercase">Sr#</th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-[10px] font-semibold tracking-wider text-green-700 uppercase"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-green-50">
                {rows.map((row, index) => (
                  <tr key={row.id ?? index} className="transition-colors hover:bg-green-50/50">
                    <td className="px-3 py-2.5 font-medium text-ink">{index + 1}</td>
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className="break-words px-3 py-2.5 text-neutral-600"
                      >
                        {formatCell(row, col.key)}
                      </td>
                    ))}
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-sm text-neutral-400">
                      No rows found for this selection.
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