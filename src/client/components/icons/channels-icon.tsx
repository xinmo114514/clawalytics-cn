export function ChannelsIcon({ className, active }: { className?: string; active?: boolean }) {
  if (active) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        height="24"
        width="24"
        className={className}
      >
        <path d="M0.5 13.5a1 1 0 0 0 1 1h3v4l4 -4h12a1 1 0 0 0 1 -1v-12a1 1 0 0 0 -1 -1h-19a1 1 0 0 0 -1 1Z" fill="#e7000b" strokeWidth="1" />
        <path d="M1.5 14.5h3l14 -14h-17a1 1 0 0 0 -1 1v12a1 1 0 0 0 1 1Z" fill="#f2babd59" strokeWidth="1" />
        <path d="M11.5 17.5a6 6 0 1 0 12 0 6 6 0 1 0 -12 0" fill="#e7000b" strokeWidth="1" />
        <path d="M13.257 21.743a6 6 0 0 1 8.486 -8.486Z" fill="#f2babd59" strokeWidth="1" />
        <path d="M11.5 17.5a6 6 0 1 0 12 0 6 6 0 1 0 -12 0" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m17.5 20.5 0 -6" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m17.5 14.5 -2.25 2.25" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m17.5 14.5 2.25 2.25" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M9.5 14.5h-1l-4 4v-4h-3a1 1 0 0 1 -1 -1v-12a1 1 0 0 1 1 -1h19a1 1 0 0 1 1 1v8" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
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
      <path d="M0.5 13.5a1 1 0 0 0 1 1h3v4l4 -4h12a1 1 0 0 0 1 -1v-12a1 1 0 0 0 -1 -1h-19a1 1 0 0 0 -1 1Z" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="M1.5 14.5h3l14 -14h-17a1 1 0 0 0 -1 1v12a1 1 0 0 0 1 1Z" fill="currentColor" fillOpacity="0.05" strokeWidth="1" />
      <path d="M11.5 17.5a6 6 0 1 0 12 0 6 6 0 1 0 -12 0" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="M11.5 17.5a6 6 0 1 0 12 0 6 6 0 1 0 -12 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m17.5 20.5 0 -6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m17.5 14.5 -2.25 2.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m17.5 14.5 2.25 2.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M9.5 14.5h-1l-4 4v-4h-3a1 1 0 0 1 -1 -1v-12a1 1 0 0 1 1 -1h19a1 1 0 0 1 1 1v8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </svg>
  )
}
