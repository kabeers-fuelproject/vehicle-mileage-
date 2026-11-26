import Spinner from './Spinner'

export default function LoadingOverlay({ label = 'Working…' }) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-4 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Spinner size="lg" />
    </div>
  )
}
