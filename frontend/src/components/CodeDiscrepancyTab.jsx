import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { supabase } from '../supabase'
import { dayRange } from '../reportRange'

const TABLE = 'summary_vehicle_selection'

const PRIMARY_BTN =
  'btn-shine relative overflow-hidden rounded-full bg-gradient-to-r from-green-700 to-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-700/25 transition-all duration-200 hover:from-green-600 hover:to-green-500 hover:shadow-lg hover:shadow-green-700/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'

const SEARCH_CLASS =
  'w-full rounded-lg border border-green-200 bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-200 placeholder:text-neutral-400 hover:border-green-300 focus:border-green-700 focus:ring-2 focus:ring-green-700/20 focus:outline-none sm:max-w-xs'

const ISSUE_META = {
  'status-mismatch': {
    label: 'Status code differs',
    tone: 'bg-red-50 text-red-700 border-red-200',
    group: 'conflict',
  },
  'report-mismatch': {
    label: 'Report code differs',
    tone: 'bg-orange-50 text-orange-700 border-orange-200',
    group: 'conflict',
  },
  'db-mismatch': {
    label: 'Database code differs',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    group: 'conflict',
  },
  'missing-in-status': {
    label: 'Not in status list',
    tone: 'bg-purple-50 text-purple-700 border-purple-200',
    group: 'unmatched',
  },
  'no-matching-unit': {
    label: 'No vehicle by this code',
    tone: 'bg-purple-50 text-purple-700 border-purple-200',
    group: 'unmatched',
  },
  'stale-db': {
    label: 'Saved code has no vehicle',
    tone: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    group: 'unmatched',
  },
}

const GROUP_META = {
  conflict: { label: 'Code Conflict', dot: 'bg-red-500' },
  unmatched: { label: 'Unmatched Code', dot: 'bg-purple-500' },
}

const FILTERS = [
  { key: 'discrepancies', label: 'Discrepancies only' },
  { key: 'conflicts', label: 'Conflicts' },
  { key: 'unmatched', label: 'Unmatched' },
  { key: 'clean', label: 'Matched' },
  { key: 'all', label: 'All vehicles' },
]

function normalizeCode(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function firstNonBlank(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return null
}

function compareCode(baseRaw, otherRaw) {
  if (!baseRaw || !otherRaw) return false
  return normalizeCode(baseRaw) !== normalizeCode(otherRaw)
}

function compareRecords(a, b) {
  const aKey = (a.listCode || a.statusCode || a.dbCode || '').toLowerCase()
  const bKey = (b.listCode || b.statusCode || b.dbCode || '').toLowerCase()
  if (aKey !== bKey) return aKey.localeCompare(bKey)
  return String(a.unitID ?? '').localeCompare(String(b.unitID ?? ''), undefined, {
    numeric: true,
  })
}

function fmtDate(date) {
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function StatCard({ label, value, tone, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 active:scale-[0.98] ${
        active
          ? 'border-green-600 bg-green-50 shadow-sm shadow-green-700/10'
          : 'border-green-100 bg-white hover:border-green-300 hover:bg-green-50/50'
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold ${tone}`}
      >
        {value}
      </span>
      <span className="min-w-0">
        <dt className="truncate text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
          {label}
        </dt>
      </span>
    </button>
  )
}

function IssueBadge({ issue }) {
  const meta = ISSUE_META[issue]
  if (!meta) return null
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${meta.tone}`}
    >
      {meta.label}
    </span>
  )
}

function CodeCell({ value, mismatch }) {
  if (!value) {
    return <span className="text-xs font-medium text-neutral-400">—</span>
  }
  return (
    <span
      className={`inline-block break-all font-semibold ${
        mismatch ? 'text-red-700' : 'text-ink'
      }`}
    >
      {value}
    </span>
  )
}

function GroupBadges({ issues }) {
  const groups = new Set(issues.map((i) => ISSUE_META[i]?.group).filter(Boolean))
  return (
    <span className="flex items-center gap-2">
      {[...groups].map((group) => (
        <span key={group} className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${GROUP_META[group].dot}`}
          />
          <span className="text-[11px] font-semibold text-neutral-600">
            {GROUP_META[group].label}
          </span>
        </span>
      ))}
      {issues.length === 0 && (
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
          <span className="text-[11px] font-semibold text-green-700">
            Matched
          </span>
        </span>
      )}
    </span>
  )
}

export default function CodeDiscrepancyTab({ token }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [generatedAt, setGeneratedAt] = useState(null)
  const [filter, setFilter] = useState('discrepancies')
  const [search, setSearch] = useState('')

  async function load(initial) {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError('')
    setNotice('')

    const [unitsResult, statusResult, dbResult] = await Promise.allSettled([
      api('/vehicle/getlist', { token }),
      api('/vehicle/getstatus', { token }),
      supabase.from(TABLE).select('*').order('vehicle_code'),
    ])

    const units =
      unitsResult.status === 'fulfilled'
        ? unitsResult.value?.data ?? []
        : []
    if (unitsResult.status === 'rejected') {
      setError(unitsResult.reason.message)
    }

    let statusVehicles = []
    if (statusResult.status === 'fulfilled') {
      statusVehicles = statusResult.value?.vehicles ?? []
    } else {
      setNotice(
        (old) =>
          `${old ? `${old} · ` : ''}Status list unavailable: ${statusResult.reason.message}`,
      )
    }

    let dbRows = []
    if (dbResult.status === 'fulfilled') {
      const value = dbResult.value
      if (value?.error) {
        setNotice(
          (old) =>
            `${old ? `${old} · ` : ''}Saved codes unavailable: ${value.error.message}`,
        )
      } else {
        dbRows = value?.data ?? []
      }
    } else {
      setNotice(
        (old) => `${old ? `${old} · ` : ''}Saved codes unavailable: ${dbResult.reason.message}`,
      )
    }

    if (!units.length) {
      setRecords([])
      setGeneratedAt(new Date())
      setLoading(false)
      setRefreshing(false)
      return
    }

    let reportRows = []
    try {
      const report = await api('/report/distance/preview', {
        token,
        body: { UnitIDs: units.map((u) => u.unitID), ...dayRange(new Date()) },
      })
      reportRows = report?.summary ?? []
    } catch (err) {
      setNotice(
        (old) => `${old ? `${old} · ` : ''}Report codes unavailable: ${err.message}`,
      )
    }

    if (initial) setLoading(false)
    else setRefreshing(false)
    setGeneratedAt(new Date())

    const statusByCode = new Map()
    for (const v of statusVehicles) {
      const key = normalizeCode(v.regNo)
      if (!key) continue
      if (!statusByCode.has(key)) statusByCode.set(key, String(v.regNo).trim())
    }

    const reportByCode = new Map()
    for (const row of reportRows) {
      const key = normalizeCode(row.vehicleRegNumber)
      if (!key) continue
      if (!reportByCode.has(key))
        reportByCode.set(key, String(row.vehicleRegNumber).trim())
    }

    const dbByUnit = new Map()
    const dbByCode = new Map()
    for (const row of dbRows) {
      if (row.unit_id != null) {
        const unitKey = String(row.unit_id)
        if (!dbByUnit.has(unitKey)) dbByUnit.set(unitKey, row)
      }
      const codeKey = normalizeCode(row.vehicle_code)
      if (codeKey && !dbByCode.has(codeKey)) dbByCode.set(codeKey, row)
    }

    const built = []
    const consumedDb = new Set()

    for (const unit of units) {
      const listCode = firstNonBlank(unit.alias, unit.regNo, unit.unitID) ?? ''
      const unitKey = String(unit.unitID)
      const codeKey = normalizeCode(listCode)

      let dbRow = dbByUnit.get(unitKey)
      if (!dbRow && codeKey) dbRow = dbByCode.get(codeKey)
      if (dbRow) consumedDb.add(dbRow)

      const statusCode = statusByCode.get(codeKey) ?? null
      const reportCode = reportByCode.get(codeKey) ?? null

      const issues = [...new Set(
        [
          compareCode(listCode, statusCode) ? 'status-mismatch' : null,
          compareCode(listCode, reportCode) ? 'report-mismatch' : null,
          compareCode(listCode, dbRow?.vehicle_code) ? 'db-mismatch' : null,
          statusCode ? null : 'missing-in-status',
        ].filter(Boolean),
      )]

      built.push({
        key: unitKey,
        unitID: unitKey,
        listCode,
        statusCode,
        reportCode,
        dbCode: dbRow?.vehicle_code ?? null,
        usedForCode: listCode,
        issues,
        clean: issues.length === 0,
      })
    }

    const matchedKeys = new Set(
      built
        .map((r) => normalizeCode(r.listCode))
        .filter(Boolean),
    )
    const unitIdSet = new Set(built.map((r) => r.unitID))

    for (const [key, statusCode] of statusByCode) {
      if (matchedKeys.has(key)) continue
      built.push({
        key: `status:${key}`,
        unitID: '',
        listCode: '',
        statusCode,
        reportCode: reportByCode.get(key) ?? null,
        dbCode: dbByCode.get(key)?.vehicle_code ?? null,
        usedForCode: '',
        issues: ['no-matching-unit'],
        clean: false,
      })
    }

    for (const row of dbRows) {
      if (consumedDb.has(row)) continue
      const code = firstNonBlank(row.vehicle_code, row.unit_id) ?? ''
      const key = normalizeCode(code)
      const hasUnit = row.unit_id != null && unitIdSet.has(String(row.unit_id))
      if (key && matchedKeys.has(key)) continue
      if (hasUnit) continue
      built.push({
        key: `db:${key || String(row.unit_id)}`,
        unitID: row.unit_id != null ? String(row.unit_id) : '',
        listCode: '',
        statusCode: statusByCode.get(key) ?? null,
        reportCode: reportByCode.get(key) ?? null,
        dbCode: String(row.vehicle_code ?? '').trim() || null,
        usedForCode: '',
        issues: ['stale-db'],
        clean: false,
      })
    }

    setRecords(built)
  }

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const counts = useMemo(() => {
    let conflicts = 0
    let unmatched = 0
    let clean = 0
    for (const rec of records) {
      if (rec.clean) clean += 1
      else if (rec.issues.some((i) => ISSUE_META[i].group === 'conflict'))
        conflicts += 1
      else unmatched += 1
    }
    return {
      conflicts,
      unmatched,
      clean,
      discrepancies: conflicts + unmatched,
      all: records.length,
    }
  }, [records])

  const visible = useMemo(() => {
    let list = records
    if (filter === 'conflicts')
      list = list.filter(
        (r) => !r.clean && r.issues.some((i) => ISSUE_META[i].group === 'conflict'),
      )
    else if (filter === 'unmatched')
      list = list.filter(
        (r) => !r.clean && r.issues.every((i) => ISSUE_META[i].group === 'unmatched'),
      )
    else if (filter === 'clean') list = list.filter((r) => r.clean)
    else if (filter === 'discrepancies') list = list.filter((r) => !r.clean)

    const query = search.trim().toLowerCase()
    if (query) {
      list = list.filter((r) =>
        [r.unitID, r.listCode, r.statusCode, r.reportCode, r.dbCode].some(
          (v) => v && String(v).toLowerCase().includes(query),
        ),
      )
    }
    return [...list].sort(compareRecords)
  }, [records, filter, search])

  const busy = loading || refreshing

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-ink">
            Vehicle Code Discrepancy
          </h3>
          <p className="mt-1 text-sm text-neutral-500">
            Compares each vehicle&apos;s code across the portal unit list, status
            list, distance report and saved selections.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:shrink-0">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search code or unit ID…"
            aria-label="Search codes"
            className={`${SEARCH_CLASS} sm:w-56 lg:w-64`}
          />
          <button
            type="button"
            onClick={() => load(false)}
            disabled={busy}
            className={`${PRIMARY_BTN} w-full py-2.5 text-sm sm:w-40 lg:w-auto lg:px-5`}
          >
            {refreshing ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Checking…
              </span>
            ) : (
              'Run Check'
            )}
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Conflicts"
          value={counts.conflicts}
          tone="bg-red-100 text-red-700"
          active={filter === 'conflicts'}
          onClick={() => setFilter('conflicts')}
        />
        <StatCard
          label="Unmatched"
          value={counts.unmatched}
          tone="bg-purple-100 text-purple-700"
          active={filter === 'unmatched'}
          onClick={() => setFilter('unmatched')}
        />
        <StatCard
          label="Total issues"
          value={counts.discrepancies}
          tone="bg-amber-100 text-amber-700"
          active={filter === 'discrepancies'}
          onClick={() => setFilter('discrepancies')}
        />
        <StatCard
          label="Matched"
          value={counts.clean}
          tone="bg-green-100 text-green-700"
          active={filter === 'clean'}
          onClick={() => setFilter('clean')}
        />
        <StatCard
          label="All vehicles"
          value={counts.all}
          tone="bg-neutral-100 text-neutral-700"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter discrepancies"
          className="flex flex-wrap gap-1.5 rounded-full border border-green-100 bg-white p-1"
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.key
                  ? 'bg-green-600 text-white shadow-sm shadow-green-600/30'
                  : 'text-neutral-600 hover:bg-green-50 hover:text-green-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {generatedAt && (
          <p className="text-xs text-neutral-400">
            Last checked: {fmtDate(generatedAt)}
          </p>
        )}
      </div>

      {error && (
        <p className="mb-4 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      {notice && (
        <p className="mb-4 border-l-4 border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {notice}
        </p>
      )}

      {loading && (
        <div className="flex items-center gap-3 text-sm text-neutral-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-green-700 border-t-transparent" />
          Checking vehicle codes…
        </div>
      )}

      {!loading && visible.length === 0 && !error && (
        <p className="text-sm text-neutral-500">
          {filter === 'discrepancies' && !search
            ? 'No code discrepancies found. All vehicle codes match across sources.'
            : 'No vehicles match the current filter.'}
        </p>
      )}

      {!loading && visible.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-green-100 bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-green-100 bg-green-50/70 text-[10px] tracking-widest text-green-700 uppercase">
                <th className="px-4 py-3 font-semibold">Unit ID</th>
                <th className="px-4 py-3 font-semibold">Unit List Code</th>
                <th className="px-4 py-3 font-semibold">Status Code</th>
                <th className="px-4 py-3 font-semibold">Report Code</th>
                <th className="px-4 py-3 font-semibold">Saved Code</th>
                <th className="px-4 py-3 font-semibold">Findings</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((rec) => {
                const baseKey = normalizeCode(rec.listCode)
                return (
                  <tr
                    key={rec.key}
                    className="border-b border-neutral-100 last:border-0 hover:bg-green-50/40"
                  >
                    <td className="px-4 py-3 align-middle text-neutral-500 tabular-nums">
                      {rec.unitID || '—'}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <CodeCell
                        value={rec.listCode}
                        mismatch={
                          compareCode(rec.listCode, rec.statusCode) ||
                          compareCode(rec.listCode, rec.reportCode) ||
                          compareCode(rec.listCode, rec.dbCode)
                        }
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <CodeCell
                        value={rec.statusCode}
                        mismatch={
                          baseKey
                            ? compareCode(rec.listCode, rec.statusCode)
                            : true
                        }
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <CodeCell
                        value={rec.reportCode}
                        mismatch={
                          baseKey
                            ? compareCode(rec.listCode, rec.reportCode)
                            : true
                        }
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <CodeCell
                        value={rec.dbCode}
                        mismatch={
                          baseKey
                            ? compareCode(rec.listCode, rec.dbCode)
                            : true
                        }
                      />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-wrap gap-1.5">
                        {rec.issues.length > 0 ? (
                          rec.issues.map((issue) => (
                            <IssueBadge key={issue} issue={issue} />
                          ))
                        ) : (
                          <GroupBadges issues={rec.issues} />
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
  )
}
