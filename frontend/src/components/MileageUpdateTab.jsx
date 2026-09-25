const COLUMNS = [
  'Sr',
  'Vehicle Code',
  'Veh Type',
  'Driver Name',
  'Used For',
  'Supervisor',
  'Mileage',
  'Working Hours',
  'Status',
  'Last Updated Time',
]

const rows = []

export default function MileageUpdateTab() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight">Mileage Update</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Mileage, working hours and vehicle assignment records
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
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
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-12 text-center text-sm text-neutral-500"
                >
                  No mileage records yet.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={row.id ?? index}
                  className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-neutral-50"
                >
                  <td className="px-4 py-3 text-neutral-400">{index + 1}</td>
                  <td className="px-4 py-3 font-semibold text-black">
                    {row.vehicleCode}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{row.vehType}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {row.driverName}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{row.usedFor}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {row.supervisor}
                  </td>
                  <td className="px-4 py-3 text-black">{row.mileage}</td>
                  <td className="px-4 py-3 text-black">{row.workingHours}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full border border-neutral-300 bg-white px-2.5 py-0.5 text-xs text-black">
                      {row.status ?? '—'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                    {row.lastUpdated ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
