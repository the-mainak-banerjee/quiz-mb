// Approved Stitch wordmark geometry; colors use the QuizMB semantic palette.
export function Brand() {
  return (
    <svg
      viewBox="0 0 200 48"
      fill="none"
      role="img"
      aria-label="QuizMB"
      className="h-control-large w-auto"
    >
      <rect
        x="2"
        y="6"
        width="36"
        height="36"
        rx="10"
        className="fill-action-primary"
      />
      <circle cx="16" cy="20" r="4" className="fill-action-secondary" />
      <circle cx="24" cy="20" r="4" className="fill-accent-soft" />
      <path
        d="M14 29C14 26.5 17 25 20 25C23 25 26 26.5 26 29"
        className="stroke-action-on-primary"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <text
        x="48"
        y="31"
        fontSize="22"
        fontWeight="700"
        letterSpacing="-0.02em"
        className="font-sans fill-action-primary-hover"
      >
        Quiz<tspan className="fill-accent">MB</tspan>
      </text>
    </svg>
  );
}
