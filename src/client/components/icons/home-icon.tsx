export function HomeIcon({ className, active }: { className?: string; active?: boolean }) {
  if (active) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        height="24"
        width="24"
        className={className}
      >
        <path
          d="M22.5 23.5h-21a1 1 0 0 1 -1 -1V9.987A1 1 0 0 1 0.884 9.2l10.5 -8.218a1 1 0 0 1 1.232 0l10.5 8.218a1 1 0 0 1 0.384 0.787V22.5a1 1 0 0 1 -1 1Z"
          fill="#e7000b"
          strokeWidth="1"
        />
        <path
          d="M11.227 4.767a1.252 1.252 0 0 1 1.546 0l10.727 8.4v-3.18a1 1 0 0 0 -0.384 -0.787L12.616 0.982a1 1 0 0 0 -1.232 0L0.884 9.2a1 1 0 0 0 -0.384 0.787v3.175Z"
          fill="#f2babd59"
          strokeWidth="1"
        />
        <path
          d="M22.5 23.5h-21a1 1 0 0 1 -1 -1V9.987A1 1 0 0 1 0.884 9.2l10.5 -8.218a1 1 0 0 1 1.232 0l10.5 8.218a1 1 0 0 1 0.384 0.787V22.5a1 1 0 0 1 -1 1Z"
          fill="none"
          stroke="#00303e"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
        />
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
      <path
        d="M22.5 23.5h-21a1 1 0 0 1 -1 -1V9.987A1 1 0 0 1 0.884 9.2l10.5 -8.218a1 1 0 0 1 1.232 0l10.5 8.218a1 1 0 0 1 0.384 0.787V22.5a1 1 0 0 1 -1 1Z"
        fill="currentColor"
        fillOpacity="0.1"
        strokeWidth="1"
      />
      <path
        d="M11.227 4.767a1.252 1.252 0 0 1 1.546 0l10.727 8.4v-3.18a1 1 0 0 0 -0.384 -0.787L12.616 0.982a1 1 0 0 0 -1.232 0L0.884 9.2a1 1 0 0 0 -0.384 0.787v3.175Z"
        fill="currentColor"
        fillOpacity="0.05"
        strokeWidth="1"
      />
      <path
        d="M22.5 23.5h-21a1 1 0 0 1 -1 -1V9.987A1 1 0 0 1 0.884 9.2l10.5 -8.218a1 1 0 0 1 1.232 0l10.5 8.218a1 1 0 0 1 0.384 0.787V22.5a1 1 0 0 1 -1 1Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1"
      />
    </svg>
  )
}
