import { THRESHOLDS } from '../thresholds'
import VaLogo from './VaLogo'

const COLUMNS = ['Veh Type', 'Mileage', 'Working Hours']

export default function ThresholdTab() {
  return (
    <div className="max-w-3xl overflow-hidden rounded-xl border-2 border-neutral-400 bg-white shadow-sm">
      <div className="h-1.5 w-full bg-green-700" />

      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-neutral-200 px-6 py-5">
        <div className="flex items-center gap-4">
          <VaLogo className="h-11 w-11" />
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-green-700 uppercase">
              Vehicle Automation
            </p>
            <h3 className="text-lg font-bold tracking-tight text-ink">
              Threshold
            </h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Allowed mileage and working hours per vehicle type — used to
              calculate mileage updates
            </p>
          </div>
        </div>
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
              Applies To
            </dt>
            <dd className="mt-1 text-sm font-semibold text-green-900">
              Mileage status
            </dd>
          </div>
        </dl>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-green-700 tracking-wider text-white uppercase">
              {COLUMNS.map((column, i) => (
                <th
                  key={column}
                  className={`border border-white/25 px-4 py-2.5 font-semibold ${
                    i > 0 ? 'text-right' : ''
                  }`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {THRESHOLDS.map((row, index) => (
              <tr
                key={row.vehType}
                className={`transition-colors hover:bg-green-100 ${
                  index % 2 === 0 ? 'bg-green-50' : 'bg-white'
                }`}
              >
                <td className="border border-neutral-300 px-4 py-2.5 font-semibold text-black">
                  {row.vehType}
                </td>
                <td className="border border-neutral-300 px-4 py-2.5 text-right font-semibold tabular-nums text-black">
                  {row.mileage}
                </td>
                <td className="border border-neutral-300 px-4 py-2.5 text-right font-semibold tabular-nums text-black">
                  {row.workingHours}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-green-200 bg-green-50 px-6 py-3.5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-green-900/80">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-green-700" />
            Mileage — daily distance allowance per vehicle type
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Below allowance — vehicle flagged Low in mileage report
          </span>
        </div>
        <p className="text-[11px] text-green-800">
          Reference table · {THRESHOLDS.length} vehicle types
        </p>
      </div>
      <div className="h-1 w-full bg-green-700" />
    </div>
  )
}
