export function SecurityIcon({ className, active }: { className?: string; active?: boolean }) {
  if (active) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        height="24"
        width="24"
        className={className}
      >
        <path d="M1.5 3.775v7.637A12.311 12.311 0 0 0 9.719 22.88l1.121 0.414a3.365 3.365 0 0 0 2.32 0l1.121 -0.414A12.311 12.311 0 0 0 22.5 11.412V3.775a1.533 1.533 0 0 0 -0.934 -1.406A24.237 24.237 0 0 0 12 0.5a24.237 24.237 0 0 0 -9.566 1.869A1.533 1.533 0 0 0 1.5 3.775Z" fill="hsl(var(--primary-muted))" strokeWidth="1" />
        <path d="M12 0.5a24.237 24.237 0 0 0 -9.566 1.869A1.533 1.533 0 0 0 1.5 3.775v7.637A12.311 12.311 0 0 0 9.719 22.88l1.121 0.414A3.373 3.373 0 0 0 12 23.5Z" fill="hsl(var(--primary-light))" strokeWidth="1" />
        <path d="M1.5 3.775v7.637A12.311 12.311 0 0 0 9.719 22.88l1.121 0.414a3.365 3.365 0 0 0 2.32 0l1.121 -0.414A12.311 12.311 0 0 0 22.5 11.412V3.775a1.533 1.533 0 0 0 -0.934 -1.406A24.237 24.237 0 0 0 12 0.5a24.237 24.237 0 0 0 -9.566 1.869A1.533 1.533 0 0 0 1.5 3.775Z" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <path d="M8.5 9.243h7s1 0 1 1v5.999s0 1 -1 1h-7s-1 0 -1 -1v-5.999s0 -1 1 -1" fill="hsl(var(--destructive))" strokeWidth="1" />
        <path d="M12 9.243H8.5a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1H12Z" fill="hsl(var(--primary-muted))" strokeWidth="1" />
        <path d="M8.5 9.243h7s1 0 1 1v5.999s0 1 -1 1h-7s-1 0 -1 -1v-5.999s0 -1 1 -1" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
        <path d="M10.75 13.306a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 1 0 -2.5 0" fill="hsl(var(--destructive))" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
        <path d="M14.5 7.743a2.5 2.5 0 0 0 -5 0v1.5h5Z" stroke="hsl(var(--foreground))" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
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
      <path d="M1.5 3.775v7.637A12.311 12.311 0 0 0 9.719 22.88l1.121 0.414a3.365 3.365 0 0 0 2.32 0l1.121 -0.414A12.311 12.311 0 0 0 22.5 11.412V3.775a1.533 1.533 0 0 0 -0.934 -1.406A24.237 24.237 0 0 0 12 0.5a24.237 24.237 0 0 0 -9.566 1.869A1.533 1.533 0 0 0 1.5 3.775Z" fill="currentColor" fillOpacity="0.1" strokeWidth="1" />
      <path d="M12 0.5a24.237 24.237 0 0 0 -9.566 1.869A1.533 1.533 0 0 0 1.5 3.775v7.637A12.311 12.311 0 0 0 9.719 22.88l1.121 0.414A3.373 3.373 0 0 0 12 23.5Z" fill="currentColor" fillOpacity="0.15" strokeWidth="1" />
      <path d="M1.5 3.775v7.637A12.311 12.311 0 0 0 9.719 22.88l1.121 0.414a3.365 3.365 0 0 0 2.32 0l1.121 -0.414A12.311 12.311 0 0 0 22.5 11.412V3.775a1.533 1.533 0 0 0 -0.934 -1.406A24.237 24.237 0 0 0 12 0.5a24.237 24.237 0 0 0 -9.566 1.869A1.533 1.533 0 0 0 1.5 3.775Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <path d="M8.5 9.243h7s1 0 1 1v5.999s0 1 -1 1h-7s-1 0 -1 -1v-5.999s0 -1 1 -1" fill="currentColor" fillOpacity="0.2" strokeWidth="1" />
      <path d="M8.5 9.243h7s1 0 1 1v5.999s0 1 -1 1h-7s-1 0 -1 -1v-5.999s0 -1 1 -1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
      <path d="M10.75 13.306a1.25 1.25 0 1 0 2.5 0 1.25 1.25 0 1 0 -2.5 0" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" />
      <path d="M14.5 7.743a2.5 2.5 0 0 0 -5 0v1.5h5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="1" />
    </svg>
  )
}
