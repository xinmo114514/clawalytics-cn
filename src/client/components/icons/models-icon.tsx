export function ModelsIcon({ className, active }: { className?: string; active?: boolean }) {
  if (active) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        height="24"
        width="24"
        className={className}
      >
        {/* CPU/Chip icon representing AI models */}
        <rect x="5" y="5" width="14" height="14" rx="2" fill="#f2babd59" strokeWidth="1" />
        <rect x="5" y="5" width="14" height="3" rx="1" fill="#fdc8c6" strokeWidth="1" />
        <rect x="5" y="5" width="14" height="14" rx="2" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <rect x="8" y="8" width="8" height="8" rx="1" fill="#e7000b" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        {/* Pins */}
        <path d="M8 5V2" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M12 5V2" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M16 5V2" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M8 22v-3" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M12 22v-3" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M16 22v-3" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M5 8H2" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M5 12H2" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M5 16H2" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M22 8h-3" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M22 12h-3" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M22 16h-3" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      </svg>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      height="24"
      width="24"
      className={className}
    >
      {/* CPU/Chip icon representing AI models */}
      <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <rect x="5" y="5" width="14" height="3" rx="1" fill="currentColor" fillOpacity="0.15" strokeWidth="1" />
      <rect x="5" y="5" width="14" height="14" rx="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      {/* Pins */}
      <path d="M8 5V2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M12 5V2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M16 5V2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M8 22v-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M12 22v-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M16 22v-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M5 8H2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M5 12H2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M5 16H2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M22 8h-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M22 12h-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M22 16h-3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </svg>
  )
}
