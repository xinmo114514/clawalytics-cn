export function DevicesIcon({ className, active }: { className?: string; active?: boolean }) {
  if (active) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        height="24"
        width="24"
        className={className}
      >
        <path d="M10.5 4v14H0.5V4a2.006 2.006 0 0 1 2 -2h6a2 2 0 0 1 2 2Z" fill="hsl(var(--destructive))" strokeWidth="1" />
        <path d="M10.5 18v2a2 2 0 0 1 -2 2h-6a2.006 2.006 0 0 1 -2 -2v-2Z" fill="hsl(var(--primary-light))" strokeWidth="1" />
        <path d="M23.5 4v14h-10V4a2.006 2.006 0 0 1 2 -2h6a2 2 0 0 1 2 2Z" fill="hsl(var(--destructive))" strokeWidth="1" />
        <path d="M23.5 18v2a2 2 0 0 1 -2 2h-6a2.006 2.006 0 0 1 -2 -2v-2Z" fill="hsl(var(--primary-light))" strokeWidth="1" />
        <path d="M10.5 5.779V4a2 2 0 0 0 -2 -2h-6a2.006 2.006 0 0 0 -2 2v11.779Z" fill="hsl(var(--primary-light))" strokeWidth="1" />
        <path d="M23.5 5.779V4a2 2 0 0 0 -2 -2h-6a2.006 2.006 0 0 0 -2 2v11.779Z" fill="hsl(var(--primary-light))" strokeWidth="1" />
        <path d="M10.5 16.5V20a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v3.5" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m10.5 18 -10 0" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M13.5 7.5V4a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v16a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v-3.5" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m23.5 18 -10 0" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m4.5 12 15 0" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m7.5 15.015 -3 -3 3 -3" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="m16.5 15.015 3 -3 -3 -3" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M5.5 19.75a0.25 0.25 0 0 1 0.25 0.25h0a0.25 0.25 0 0 1 -0.25 0.25h0a0.25 0.25 0 0 1 -0.25 -0.25h0a0.25 0.25 0 0 1 0.25 -0.25" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M18.5 19.75a0.25 0.25 0 0 1 0.25 0.25h0a0.25 0.25 0 0 1 -0.25 0.25h0a0.25 0.25 0 0 1 -0.25 -0.25h0a0.25 0.25 0 0 1 0.25 -0.25" fill="none" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
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
      <path d="M10.5 4v14H0.5V4a2.006 2.006 0 0 1 2 -2h6a2 2 0 0 1 2 2Z" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="M10.5 18v2a2 2 0 0 1 -2 2h-6a2.006 2.006 0 0 1 -2 -2v-2Z" fill="currentColor" fillOpacity="0.15" strokeWidth="1" />
      <path d="M23.5 4v14h-10V4a2.006 2.006 0 0 1 2 -2h6a2 2 0 0 1 2 2Z" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="M23.5 18v2a2 2 0 0 1 -2 2h-6a2.006 2.006 0 0 1 -2 -2v-2Z" fill="currentColor" fillOpacity="0.15" strokeWidth="1" />
      <path d="M10.5 16.5V20a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2V4a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m10.5 18 -10 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M13.5 7.5V4a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v16a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m23.5 18 -10 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m4.5 12 15 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m7.5 15.015 -3 -3 3 -3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="m16.5 15.015 3 -3 -3 -3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M5.5 19.75a0.25 0.25 0 0 1 0.25 0.25h0a0.25 0.25 0 0 1 -0.25 0.25h0a0.25 0.25 0 0 1 -0.25 -0.25h0a0.25 0.25 0 0 1 0.25 -0.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M18.5 19.75a0.25 0.25 0 0 1 0.25 0.25h0a0.25 0.25 0 0 1 -0.25 0.25h0a0.25 0.25 0 0 1 -0.25 -0.25h0a0.25 0.25 0 0 1 0.25 -0.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
    </svg>
  )
}
