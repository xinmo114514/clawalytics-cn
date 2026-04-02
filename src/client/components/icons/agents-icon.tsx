export function AgentsIcon({ className, active }: { className?: string; active?: boolean }) {
  if (active) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        height="24"
        width="24"
        className={className}
      >
        <path d="M6 1h12s1.5 0 1.5 1.5v6s0 1.5 -1.5 1.5H6s-1.5 0 -1.5 -1.5v-6S4.5 1 6 1" fill="hsl(var(--primary-muted))" strokeWidth="1" />
        <path d="M19.5 3v-0.5A1.5 1.5 0 0 0 18 1H6a1.5 1.5 0 0 0 -1.5 1.5V3Z" fill="hsl(var(--primary-light))" strokeWidth="1" />
        <path d="M6 1h12s1.5 0 1.5 1.5v6s0 1.5 -1.5 1.5H6s-1.5 0 -1.5 -1.5v-6S4.5 1 6 1" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <path d="M6.5 5.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0 -3 0" fill="hsl(var(--destructive))" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M14.5 5.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0 -3 0" fill="hsl(var(--destructive))" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m10.5 12 3 0" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <path d="m10.5 14 3 0" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <path d="M14.97 16H9.03a3.663 3.663 0 0 0 -3.581 4.429l0.466 2.176A0.5 0.5 0 0 0 6.4 23h11.2a0.5 0.5 0 0 0 0.489 -0.395l0.466 -2.176A3.663 3.663 0 0 0 14.97 16Z" fill="hsl(var(--primary-muted))" strokeWidth="1" />
        <path d="M5.5 20.674A3.662 3.662 0 0 1 9.03 18h5.94a3.662 3.662 0 0 1 3.53 2.674l0.053 -0.245A3.662 3.662 0 0 0 14.97 16H9.03a3.662 3.662 0 0 0 -3.581 4.429Z" fill="hsl(var(--primary-light))" strokeWidth="1" />
        <path d="M14.97 16H9.03a3.663 3.663 0 0 0 -3.581 4.429l0.466 2.176A0.5 0.5 0 0 0 6.4 23h11.2a0.5 0.5 0 0 0 0.489 -0.395l0.466 -2.176A3.663 3.663 0 0 0 14.97 16Z" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <path d="m18.614 19.279 2.074 -1.605A3.662 3.662 0 0 0 22 14l-0.053 -0.186" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <path d="M23 10a2.5 2.5 0 0 1 -4 3" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <path d="m5.387 19.279 -2.075 -1.605A3.662 3.662 0 0 1 2 14l0.016 -0.2" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <path d="M1 10a2.5 2.5 0 0 0 4 3" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <path d="M15.5 23v-3.5a0.5 0.5 0 0 0 -0.5 -0.5H9a0.5 0.5 0 0 0 -0.5 0.5V23Z" fill="hsl(var(--destructive))" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
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
      <path d="M6 1h12s1.5 0 1.5 1.5v6s0 1.5 -1.5 1.5H6s-1.5 0 -1.5 -1.5v-6S4.5 1 6 1" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="M19.5 3v-0.5A1.5 1.5 0 0 0 18 1H6a1.5 1.5 0 0 0 -1.5 1.5V3Z" fill="currentColor" fillOpacity="0.15" strokeWidth="1" />
      <path d="M6 1h12s1.5 0 1.5 1.5v6s0 1.5 -1.5 1.5H6s-1.5 0 -1.5 -1.5v-6S4.5 1 6 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <path d="M6.5 5.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0 -3 0" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M14.5 5.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0 -3 0" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m10.5 12 3 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <path d="m10.5 14 3 0" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <path d="M14.97 16H9.03a3.663 3.663 0 0 0 -3.581 4.429l0.466 2.176A0.5 0.5 0 0 0 6.4 23h11.2a0.5 0.5 0 0 0 0.489 -0.395l0.466 -2.176A3.663 3.663 0 0 0 14.97 16Z" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="M14.97 16H9.03a3.663 3.663 0 0 0 -3.581 4.429l0.466 2.176A0.5 0.5 0 0 0 6.4 23h11.2a0.5 0.5 0 0 0 0.489 -0.395l0.466 -2.176A3.663 3.663 0 0 0 14.97 16Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <path d="m18.614 19.279 2.074 -1.605A3.662 3.662 0 0 0 22 14l-0.053 -0.186" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <path d="M23 10a2.5 2.5 0 0 1 -4 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <path d="m5.387 19.279 -2.075 -1.605A3.662 3.662 0 0 1 2 14l0.016 -0.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <path d="M1 10a2.5 2.5 0 0 0 4 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <path d="M15.5 23v-3.5a0.5 0.5 0 0 0 -0.5 -0.5H9a0.5 0.5 0 0 0 -0.5 0.5V23Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </svg>
  )
}
