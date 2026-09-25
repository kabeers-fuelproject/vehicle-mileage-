import { THRESHOLDS } from '../thresholds'

const COLUMNS = ['Veh Type', 'Mileage', 'Working Hours']

export default function ThresholdTab() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">Threshold</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Allowed mileage and working hours per vehicle type — used to
          calculate mileage updates
        </p>
      </div>

      <div className="max-w-2xl overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-black text-[11px] uppercase tracking-wider text-white">
              {COLUMNS.map((column) => (
                <th key={column} className="px-4 py-3.5 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {THRESHOLDS.map((row) => (
              <tr
                key={row.vehType}
                className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50"
              >
                <td className="px-4 py-3 font-semibold text-black">
                  {row.vehType}
                </td>
                <td className="px-4 py-3 text-black">{row.mileage}</td>
                <td className="px-4 py-3 text-neutral-600">
                  {row.workingHours}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
