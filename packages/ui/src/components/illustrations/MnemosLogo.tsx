interface MnemosLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function MnemosLogo({ size = 28, showWordmark = false, className = '' }: MnemosLogoProps) {
  if (showWordmark) {
    return (
      <img
        src="/logo.svg"
        alt="Mnemos"
        className={`mnemos-logo-wordmark ${className}`}
        height={size}
        draggable={false}
      />
    );
  }

  return (
    <svg
      className={`mnemos-logo-mark ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="mnemos-logo-grad" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c8f542" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#141416" />
      <circle className="mnemos-logo-orbit" cx="32" cy="32" r="22" stroke="url(#mnemos-logo-grad)" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.5" />
      <path className="mnemos-logo-core" d="M32 14 L46 32 L32 50 L18 32 Z" fill="url(#mnemos-logo-grad)" />
      <circle cx="32" cy="32" r="4" fill="#141416" />
    </svg>
  );
}
