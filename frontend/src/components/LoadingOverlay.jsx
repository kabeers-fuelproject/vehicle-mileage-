export default function LoadingOverlay({ label = 'Working…' }) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="loader">
        <span>Loading</span>
      </div>
    </div>
  )
}
