export function ToolsIcon({ className, active }: { className?: string; active?: boolean }) {
  if (active) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        height="24"
        width="24"
        className={className}
      >
        <path d="M22.751 4.254a1 1 0 0 1 0.749 0.968v12.524a1 1 0 0 1 -0.684 0.949L11.83 22.357a1 1 0 0 1 -0.658 -0.009L1.158 18.706a1 1 0 0 1 -0.658 -0.94V5.222a1 1 0 0 1 0.749 -0.968l10.5 -2.722a0.993 0.993 0 0 1 0.5 0Z" fill="#e7000b" strokeWidth="1" />
        <path d="M23.227 4.536a0.991 0.991 0 0 0 -0.476 -0.282l-10.5 -2.722a0.993 0.993 0 0 0 -0.5 0L1.249 4.254a1 1 0 0 0 -0.48 0.286L11.5 7.467Z" fill="#f2babd59" strokeWidth="1" />
        <path d="M22.751 4.254a1 1 0 0 1 0.749 0.968v12.524a1 1 0 0 1 -0.684 0.949L11.83 22.357a1 1 0 0 1 -0.658 -0.009L1.158 18.706a1 1 0 0 1 -0.658 -0.94V5.222a1 1 0 0 1 0.749 -0.968l10.5 -2.722a0.993 0.993 0 0 1 0.5 0Z" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m11.5 7.467 0 15" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M23.227 4.536 11.5 7.467 0.77 4.54" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
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
      <path d="M22.751 4.254a1 1 0 0 1 0.749 0.968v12.524a1 1 0 0 1 -0.684 0.949L11.83 22.357a1 1 0 0 1 -0.658 -0.009L1.158 18.706a1 1 0 0 1 -0.658 -0.94V5.222a1 1 0 0 1 0.749 -0.968l10.5 -2.722a0.993 0.993 0 0 1 0.5 0Z" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="M23.227 4.536a0.991 0.991 0 0 0 -0.476 -0.282l-10.5 -2.722a0.993 0.993 0 0 0 -0.5 0L1.249 4.254a1 1 0 0 0 -0.48 0.286L11.5 7.467Z" fill="currentColor" fillOpacity="0.15" strokeWidth="1" />
      <path d="M22.751 4.254a1 1 0 0 1 0.749 0.968v12.524a1 1 0 0 1 -0.684 0.949L11.83 22.357a1 1 0 0 1 -0.658 -0.009L1.158 18.706a1 1 0 0 1 -0.658 -0.94V5.222a1 1 0 0 1 0.749 -0.968l10.5 -2.722a0.993 0.993 0 0 1 0.5 0Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m11.5 7.467 0 15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M23.227 4.536 11.5 7.467 0.77 4.54" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </svg>
  )
}
