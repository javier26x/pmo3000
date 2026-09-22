/** Marca de "Iniciar sesión con Microsoft", según su guía de botones de ingreso. */
export function LogoMicrosoft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 21 21" aria-hidden className={className}>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  )
}
