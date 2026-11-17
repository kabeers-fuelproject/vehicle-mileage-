import { useEffect, useMemo, useRef, useState } from 'react'
import { THRESHOLDS } from '../thresholds'
import { useThresholds } from '../ThresholdContext'
import { logActivity } from '../activityLogger'
import LoadingOverlay from './LoadingOverlay'

function normalizeHours(text) {
  const parts = String(text ?? '').trim().split(':').map((p) => p.trim())
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => p === '')) return null
  const numbers = parts.map((p) => Number(p))
  if (numbers.some((n) => !Number.isFinite(n) || n < 0)) return null
  if (numbers.length > 1 && numbers.slice(1).some((n) => n > 59)) return null
  const [h, m = 0, s = 0] = numbers
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function parseMileage(text) {
  if (String(text ?? '').trim() === '') return null
  const n = Number(text)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function initialDrafts(overrides) {
  const drafts = {}
  for (const t of THRESHOLDS) {
    const override = overrides[t.vehType]
    drafts[t.vehType] = {
      mileage: String(override ? override.mileage : t.mileage),
      hours: override ? override.workingHours : t.workingHours,
    }
  }
  return drafts
}

export default function SettingsTab() {
  const { overrides, ready, saveThreshold, resetThreshold, resetAllThresholds } = useThresholds()
  const [drafts, setDrafts] = useState(() => initialDrafts({}))
  const [savingType, setSavingType] = useState('')
  const [message, setMessage] = useState(null)
  const [confirmingResetAll, setConfirmingResetAll] = useState(false)
  const confirmTimerRef = useRef(null)

  useEffect(
    () => () => clearTimeout(confirmTimerRef.current),
    [],
  )

  // Re-seed drafts once overrides load (and after any save/reset that
  // changed the effective values behind the user's back).
  useEffect(() => {
    setDrafts((prev) => {
      const next = initialDrafts(overrides)
      // keep untouched in-progress edits, seed the rest
      for (const key of Object.keys(next)) {
        if (prev[key]?.dirty) next[key] = prev[key]
      }
      return next
    })
  }, [ready, overrides])

  const customizedCount = useMemo(
    () => Object.keys(overrides).length,
    [overrides],
  )

  function setDraft(vehType, field, value) {
    setDrafts((prev) => ({
      ...prev,
      [vehType]: { ...prev[vehType], [field]: value, dirty: true },
    }))
  }

  function clearDirty(vehType) {
    setDrafts((prev) => ({ ...prev, [vehType]: { ...prev[vehType], dirty: false } }))
  }

  async function handleSave(row) {
    const draft = drafts[row.vehType]
    const mileage = parseMileage(draft.mileage)
    const hours = normalizeHours(draft.hours)
    if (mileage === null || hours === null) {
      setMessage({ type: 'error', text: `Invalid values for ${row.vehType} — mileage must be a number ≥ 0 and hours formatted h:mm:ss` })
      return
    }
    setSavingType(row.vehType)
    setMessage(null)
    try {
      await saveThreshold(row.vehType, { mileage, workingHours: hours })
      clearDirty(row.vehType)
      await logActivity(
        'threshold_update',
        `Set ${row.vehType} threshold: mileage ${mileage} km, working hours ${hours}`,
        { vehType: row.vehType, mileage, workingHours: hours },
      )
      setMessage({ type: 'success', text: `${row.vehType} threshold updated — mileage status will use it immediately` })
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || `Could not save threshold for ${row.vehType}` })
    } finally {
      setSavingType('')
    }
  }

  async function handleReset(row) {
    setSavingType(row.vehType)
    setMessage(null)
    try {
      await resetThreshold(row.vehType)
      setDrafts((prev) => ({
        ...prev,
        [row.vehType]: {
          mileage: String(row.mileage),
          hours: row.workingHours,
          dirty: false,
        },
      }))
      await logActivity('threshold_update', `Reset ${row.vehType} threshold to default`, {
        vehType: row.vehType,
      })
      setMessage({ type: 'success', text: `${row.vehType} threshold reset to default` })
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || `Could not reset threshold for ${row.vehType}` })
    } finally {
      setSavingType('')
    }
  }

  const isCustomized = (vehType) => overrides[vehType] !== undefined

  async function handleResetAll() {
    if (!confirmingResetAll) {
      setConfirmingResetAll(true)
      clearTimeout(confirmTimerRef.current)
      confirmTimerRef.current = setTimeout(
        () => setConfirmingResetAll(false),
        3000,
      )
      return
    }
    clearTimeout(confirmTimerRef.current)
    setConfirmingResetAll(false)
    setSavingType('__all__')
    setMessage(null)
    try {
      await resetAllThresholds()
      setDrafts(initialDrafts({}))
      await logActivity(
        'threshold_update',
        `Reset all thresholds to default (${customizedCount} customized types)`,
        { resetAll: true, count: customizedCount },
      )
      setMessage({ type: 'success', text: 'All thresholds reset to default — mileage status updated immediately' })
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Could not reset all thresholds' })
    } finally {
      setSavingType('')
    }
  }

  return (
    <div className="max-w-4xl overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-sm">
      {savingType && (
        <LoadingOverlay
          label={savingType === '__all__' ? 'Resetting all thresholds…' : `Saving threshold for ${savingType}…`}
        />
      )}
      <div className="h-1.5 w-full bg-green-700" />

      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-neutral-200 px-4 py-5 sm:px-6">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
              Vehicle Automation
            </p>
            <h3 className="text-lg font-bold tracking-tight text-ink">
              Threshold Settings
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Override the mileage / working-hours threshold per vehicle type —
              changes take effect immediately in mileage status, summary and
              notifications
            </p>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-4">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-green-200 bg-green-50 px-5 py-3.5">
            <div>
              <dt className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
                Vehicle Types
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-green-900">
                {THRESHOLDS.length}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold tracking-wider text-green-700 uppercase">
                Customized
              </dt>
              <dd className="mt-1 text-sm font-semibold tabular-nums text-green-900">
                {customizedCount}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleResetAll}
            disabled={customizedCount === 0 || savingType !== ''}
            aria-label="Reset to default threshold"
            title={
              confirmingResetAll
                ? 'Click again to confirm — resets all thresholds to default'
                : 'Reset to default threshold'
            }
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
              confirmingResetAll
                ? 'bg-red-600 text-white shadow-sm shadow-red-600/30 hover:bg-red-700'
                : 'border border-red-300 bg-white text-red-600 hover:bg-red-50'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-5 w-5 ${confirmingResetAll ? 'anim-spin-once' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2 border-b px-4 py-2.5 text-xs font-medium sm:px-6 ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
          role="status"
        >
          <span
            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
              message.type === 'success' ? 'bg-green-700' : 'bg-red-600'
            }`}
          />
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-green-700 tracking-wider text-white uppercase">
              <th className="border border-white/25 px-4 py-2.5 font-semibold">Veh Type</th>
              <th className="border border-white/25 px-3 py-2.5 font-semibold">Mileage (km)</th>
              <th className="border border-white/25 px-3 py-2.5 font-semibold">Working Hours</th>
              <th className="border border-white/25 px-3 py-2.5 text-center font-semibold">Status</th>
              <th className="border border-white/25 px-3 py-2.5 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {THRESHOLDS.map((row, index) => {
              const draft = drafts[row.vehType]
              const customized = isCustomized(row.vehType)
              const mileageInvalid = parseMileage(draft?.mileage) === null
              const hoursInvalid = normalizeHours(draft?.hours) === null
              const dirty = draft?.dirty && (
                parseMileage(draft.mileage) !== (customized ? overrides[row.vehType].mileage : row.mileage) ||
                normalizeHours(draft.hours) !== (customized ? overrides[row.vehType].workingHours : row.workingHours)
              )
              const saving = savingType !== ''
              return (
                <tr
                  key={row.vehType}
                  className={`transition-colors hover:bg-green-100 ${
                    index % 2 === 0 ? 'bg-green-50' : 'bg-white'
                  }`}
                >
                  <td className="border border-neutral-300 px-4 py-2.5 font-semibold text-black">
                    {row.vehType}
                  </td>
                  <td className="border border-neutral-300 px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={draft?.mileage ?? ''}
                      onChange={(e) => setDraft(row.vehType, 'mileage', e.target.value)}
                      aria-label={`Mileage threshold for ${row.vehType}`}
                      disabled={saving}
                      className={`w-24 rounded-md border px-2 py-1.5 text-right font-semibold tabular-nums text-black transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/30 disabled:opacity-50 ${
                        mileageInvalid
                          ? 'border-red-400 bg-red-50'
                          : 'border-neutral-300 bg-white focus:border-green-600'
                      }`}
                    />
                  </td>
                  <td className="border border-neutral-300 px-3 py-2">
                    <input
                      type="text"
                      placeholder="h:mm:ss"
                      value={draft?.hours ?? ''}
                      onChange={(e) => setDraft(row.vehType, 'hours', e.target.value)}
                      aria-label={`Working hours threshold for ${row.vehType}`}
                      disabled={saving}
                      className={`w-24 rounded-md border px-2 py-1.5 text-right font-semibold tabular-nums text-black transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/30 disabled:opacity-50 ${
                        hoursInvalid
                          ? 'border-red-400 bg-red-50'
                          : 'border-neutral-300 bg-white focus:border-green-600'
                      }`}
                    />
                  </td>
                  <td className="border border-neutral-300 px-3 py-2 text-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${
                        customized
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {customized ? 'Custom' : 'Default'}
                    </span>
                  </td>
                  <td className="border border-neutral-300 px-3 py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleSave(row)}
                      disabled={saving || mileageInvalid || hoursInvalid || !dirty}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-green-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReset(row)}
                      disabled={saving || !customized}
                      title="Reset to built-in default"
                      className="ml-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-neutral-600 transition-colors hover:border-red-400 hover:text-red-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Reset
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-green-200 bg-green-50 px-4 py-3.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-green-900/80">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-700" />
            A vehicle is Ok only when daily mileage ≥ allowance AND hours ≥ required
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Customized types override the built-in default
          </span>
        </div>
        <p className="text-[11px] text-green-800">
          {customizedCount} customized · {THRESHOLDS.length - customizedCount} default
        </p>
      </div>
      <div className="h-1 w-full bg-green-700" />
    </div>
  )
}
