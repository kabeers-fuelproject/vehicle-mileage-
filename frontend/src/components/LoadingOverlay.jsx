/* Old loader helper (commented out - replaced by the .loader element below)
const ROAD_DASHES = [-40, 0, 40, 80, 120, 160, 200, 240]
*/

export default function LoadingOverlay({ label = 'Working…' }) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/20 px-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex w-72 flex-col items-center gap-4 overflow-hidden rounded-2xl border border-white/70 bg-white/90 px-6 pt-5 pb-5 shadow-2xl shadow-black/20">
        {/* Old SVG car loader (commented out)
        <svg viewBox="0 0 200 96" className="h-24 w-full" aria-hidden="true">
          <ellipse cx="100" cy="73" rx="66" ry="5" fill="#000" opacity="0.08" />

          <rect x="0" y="74" width="200" height="14" fill="#e7e5e4" />
          <rect x="0" y="74" width="200" height="1.5" fill="#d6d3d1" />
          <g className="va-road-dashes">
            {ROAD_DASHES.map((x) => (
              <rect key={x} x={x} y="81" width="22" height="3" rx="1.5" fill="#a8a29e" />
            ))}
          </g>

          <g stroke="#16a34a" strokeWidth="2" strokeLinecap="round">
            <line className="va-speed va-speed-1" x1="24" y1="36" x2="44" y2="36" />
            <line className="va-speed va-speed-2" x1="16" y1="50" x2="34" y2="50" />
            <line className="va-speed va-speed-3" x1="26" y1="62" x2="40" y2="62" />
          </g>

          <g fill="#16a34a">
            <circle className="va-puff va-puff-1" cx="34" cy="58" r="3.5" />
            <circle className="va-puff va-puff-2" cx="34" cy="58" r="3.5" />
            <circle className="va-puff va-puff-3" cx="34" cy="58" r="3.5" />
          </g>

          <g className="va-car">
            <g transform="translate(194.5,0) scale(-1,1)">
              <path
                d="M38 63 L39.5 51 Q40 46.5 45 45.5 L73 43.5 L87.5 31 Q89.5 28.5 93 28.5 L127 28.5 Q130.5 28.5 132.5 31 L144 44.5 L152 46.5 Q156.5 47.5 156.5 52 L156.5 63 Z"
                fill="#16a34a"
              />
              <path d="M91 34 L107 34 L107 44 L84.5 44 Z" fill="#dbeafe" />
              <path d="M111 34 L127.5 34 L137.5 44 L111 44 Z" fill="#dbeafe" />
            </g>
            <path
              d="M38 57 L156.5 57 L156.5 63 L38 63 Z"
              fill="#15803d"
            />
            <rect x="146" y="50" width="7" height="4" rx="2" fill="#fde047" />
            <rect x="41" y="50" width="6" height="4" rx="2" fill="#f87171" />

            <g className="va-wheel va-wheel-rear">
              <circle cx="64" cy="63" r="11" fill="#1f2937" />
              <circle cx="64" cy="63" r="5" fill="#d4d4d8" />
              <g stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round">
                <line x1="64" y1="56.5" x2="64" y2="69.5" />
                <line x1="57.5" y1="63" x2="70.5" y2="63" />
              </g>
            </g>
            <g className="va-wheel va-wheel-front">
              <circle cx="134" cy="63" r="11" fill="#1f2937" />
              <circle cx="134" cy="63" r="5" fill="#d4d4d8" />
              <g stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round">
                <line x1="134" y1="56.5" x2="134" y2="69.5" />
                <line x1="127.5" y1="63" x2="140.5" y2="63" />
              </g>
            </g>
          </g>
        </svg>
        */}

        <div className="loader" />

        <span className="text-sm font-semibold tracking-wide text-green-900">
          {label}
        </span>

        {/* Old loading progress bar (commented out)
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-green-100">
          <div className="va-load-bar h-full w-1/3 rounded-full bg-gradient-to-r from-green-600 via-green-400 to-green-600" />
        </div>
        */}
      </div>
    </div>
  )
}
