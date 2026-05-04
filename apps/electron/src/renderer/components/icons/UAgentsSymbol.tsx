interface UAgentsSymbolProps {
  className?: string
}

/**
 * U Agents glyph — vertical "U" formed from three horizontal bars (rotated 90° from the
 * source horizontal "E" form). Path data matches apps/electron/resources/icon.svg
 * exactly so the in-app icon and the bundled icon.{svg,icns,ico,png} stay in sync.
 * Color is supplied by the parent via className (currentColor).
 */
export function UAgentsSymbol({ className }: UAgentsSymbolProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="rotate(-90 12 12)">
        <g transform="translate(3.4502, 3)" fill="currentColor">
          <path
            d="M3.17890888,3.6 L3.17890888,0 L16,0 L16,3.6 L3.17890888,3.6 Z M9.642,7.2 L9.64218223,10.8 L0,10.8 L0,3.6 L16,3.6 L16,7.2 L9.642,7.2 Z M3.17890888,18 L3.178,14.4 L0,14.4 L0,10.8 L16,10.8 L16,18 L3.17890888,18 Z"
            fillRule="nonzero"
          />
        </g>
      </g>
    </svg>
  )
}
