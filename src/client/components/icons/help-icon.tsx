export function HelpIcon({ className, active }: { className?: string; active?: boolean }) {
  if (active) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        height="24"
        width="24"
        className={className}
      >
        <path d="M0.5 12.001a11.5 11.5 0 1 0 23 0 11.5 11.5 0 1 0 -23 0" fill="#e7000b" strokeWidth="1" />
        <path d="M12 23.5a11.5 11.5 0 0 1 0 -23Z" fill="#f2babd59" strokeWidth="1" />
        <path d="M0.5 12.001a11.5 11.5 0 1 0 23 0 11.5 11.5 0 1 0 -23 0" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M8.25 9.742a3.752 3.752 0 1 1 4.562 3.658 1.007 1.007 0 0 0 -0.812 0.975v1.113" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M12 17.992a0.25 0.25 0 1 1 -0.25 0.25 0.25 0.25 0 0 1 0.25 -0.25" fill="none" stroke="#00303e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
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
      <path d="M0.5 12.001a11.5 11.5 0 1 0 23 0 11.5 11.5 0 1 0 -23 0" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="M12 23.5a11.5 11.5 0 0 1 0 -23Z" fill="currentColor" fillOpacity="0.15" strokeWidth="1" />
      <path d="M0.5 12.001a11.5 11.5 0 1 0 23 0 11.5 11.5 0 1 0 -23 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M8.25 9.742a3.752 3.752 0 1 1 4.562 3.658 1.007 1.007 0 0 0 -0.812 0.975v1.113" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M12 17.992a0.25 0.25 0 1 1 -0.25 0.25 0.25 0.25 0 0 1 0.25 -0.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </svg>
  )
}
