export function SessionsIcon({ className, active }: { className?: string; active?: boolean }) {
  if (active) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        height="24"
        width="24"
        className={className}
      >
        <path d="M20.5 4.5v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10Z" fill="hsl(var(--destructive))" strokeWidth="1" />
        <path d="m4.5 16.5 12 -12H0.5v10a2 2 0 0 0 2 2Z" fill="hsl(var(--primary-muted))" strokeWidth="1" />
        <path d="M20.5 4.5H0.5v-2a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2Z" fill="hsl(var(--primary-light))" strokeWidth="1" />
        <path d="m0.518 4.504 20 0" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M3.518 2.254a0.25 0.25 0 1 0 0.25 0.25 0.25 0.25 0 0 0 -0.25 -0.25" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M5.518 2.254a0.25 0.25 0 1 0 0.25 0.25 0.25 0.25 0 0 0 -0.25 -0.25" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M7.518 2.254a0.25 0.25 0 1 0 0.25 0.25 0.25 0.25 0 0 0 -0.25 -0.25" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M8.518 16.5h-6a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2V10" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M11.518 17.505a6 6 0 1 0 12 0 6 6 0 1 0 -12 0" fill="hsl(var(--primary-muted))" strokeWidth="1" />
        <path d="M13.275 21.747a6 6 0 0 1 8.486 -8.485Z" fill="hsl(var(--primary-light))" strokeWidth="1" />
        <path d="M11.518 17.505a6 6 0 1 0 12 0 6 6 0 1 0 -12 0" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m19.518 17.505 -2 0 0 -3" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
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
      <path d="M20.5 4.5v10a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2v-10Z" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="m4.5 16.5 12 -12H0.5v10a2 2 0 0 0 2 2Z" fill="currentColor" fillOpacity="0.05" strokeWidth="1" />
      <path d="M20.5 4.5H0.5v-2a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2Z" fill="currentColor" fillOpacity="0.15" strokeWidth="1" />
      <path d="m0.518 4.504 20 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M3.518 2.254a0.25 0.25 0 1 0 0.25 0.25 0.25 0.25 0 0 0 -0.25 -0.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M5.518 2.254a0.25 0.25 0 1 0 0.25 0.25 0.25 0.25 0 0 0 -0.25 -0.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M7.518 2.254a0.25 0.25 0 1 0 0.25 0.25 0.25 0.25 0 0 0 -0.25 -0.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M8.518 16.5h-6a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2V10" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M11.518 17.505a6 6 0 1 0 12 0 6 6 0 1 0 -12 0" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="M11.518 17.505a6 6 0 1 0 12 0 6 6 0 1 0 -12 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m19.518 17.505 -2 0 0 -3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </svg>
  )
}
