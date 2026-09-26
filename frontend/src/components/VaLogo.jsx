const VARIANTS = {
  green: {
    shell: 'from-green-500 to-green-700 shadow-lg shadow-green-700/40',
    dot: '#15803d',
  },
  brand: {
    shell: 'from-brand-500 to-brand-700 shadow-lg shadow-brand-600/40',
    dot: '#c2410c',
  },
}

export default function VaLogo({ variant = 'green', className = 'h-11 w-11' }) {
  const v = VARIANTS[variant]
  return (
    <span
      className={`va-logo grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br ring-1 ring-white/15 ${v.shell} ${className}`}
    >
      <svg viewBox="0 0 40 40" className="h-[62%] w-[62%]" fill="none" aria-hidden="true">
        <path
          d="M7.5 26.5a12.5 12.5 0 0 1 25 0"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path d="M11.2 17.7 13.3 19.8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M28.8 17.7 26.7 19.8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M20 8.5v3" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        <g className="va-needle">
          <path
            d="M20 26.5 27 14.8"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <circle cx="20" cy="26.5" r="3.4" fill="white" />
        <circle cx="20" cy="26.5" r="1.4" fill={v.dot} />
      </svg>
    </span>
  )
}
