export const THRESHOLDS = [
  { vehType: 'Arm Roller', mileage: 25, workingHours: '6:00:00' },
  { vehType: 'Compactor', mileage: 20, workingHours: '6:00:00' },
  { vehType: 'Dumper', mileage: 35, workingHours: '6:00:00' },
  { vehType: 'Front Blade Tractor', mileage: 2, workingHours: '6:00:00' },
  { vehType: 'Front End Loader', mileage: 2, workingHours: '6:00:00' },
  { vehType: 'Loader Rickshaw', mileage: 12, workingHours: '6:00:00' },
  { vehType: 'Mechanical Sweeper', mileage: 10, workingHours: '6:00:00' },
  { vehType: 'Mini Tipper', mileage: 10, workingHours: '6:00:00' },
  { vehType: 'Road Washer', mileage: 10, workingHours: '6:00:00' },
  { vehType: 'Tractor Trolley', mileage: 20, workingHours: '6:00:00' },
  { vehType: 'Container-Repair Vehicle', mileage: 3, workingHours: '6:00:00' },
  { vehType: 'Drain Cleaner', mileage: 2, workingHours: '6:00:00' },
]

function normalize(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s\-–—]+/g, ' ')
}

// Live overrides (Settings page) keyed by the exact THRESHOLDS vehType.
// Kept in module scope so non-component code (NotificationContext,
// module-level computeStatus helpers) can read them without prop threading.
let overrides = {}

export function setThresholdOverrides(map) {
  overrides = map ?? {}
}

export function getThresholdOverrides() {
  return overrides
}

export function findThreshold(vehType) {
  const normalized = normalize(vehType)
  if (!normalized) return null
  const exact = THRESHOLDS.find((t) => normalize(t.vehType) === normalized)
  let base = exact
  if (!base) {
    // e.g. "Mini Tipper Petrol" → "Mini Tipper"
    base = THRESHOLDS.find((t) => normalized.startsWith(normalize(t.vehType))) ?? null
  }
  if (!base) return null
  const override = overrides[base.vehType]
  if (!override) return base
  return {
    ...base,
    mileage: override.mileage,
    workingHours: override.workingHours,
  }
}
