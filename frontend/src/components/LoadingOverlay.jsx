export default function LoadingOverlay({ label = 'Working…' }) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/20 px-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex min-w-52 flex-col items-center gap-4 rounded-2xl border border-white/70 bg-white/90 px-8 py-6 shadow-2xl shadow-black/20">
        <div className="relative h-16 w-16">
          <span className="absolute inset-0 rounded-full border-4 border-green-100" />
          <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-green-700 border-r-green-400" />
          <span className="absolute inset-3 animate-pulse rounded-full bg-gradient-to-br from-green-700 to-green-400 shadow-lg shadow-green-500/40" />
        </div>
        <span className="text-sm font-semibold tracking-wide text-green-900">{label}</span>
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-700 [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-600 [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-green-500" />
        </span>
      </div>
    </div>
  )
}