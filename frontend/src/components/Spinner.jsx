export default function Spinner({ size = 'sm', className = '' }) {
  return (
    <span
      className={`loader loader-${size}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    />
  )
}
