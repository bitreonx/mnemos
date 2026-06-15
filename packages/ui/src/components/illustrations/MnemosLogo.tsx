interface MnemosLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function MnemosLogo({ size = 28, showWordmark = false, className = '' }: MnemosLogoProps) {
  if (showWordmark) {
    return (
      <img
        src="/logo.png"
        alt="Mnemos"
        className={`mnemos-logo-wordmark ${className}`}
        height={size}
        draggable={false}
      />
    );
  }

  return (
    <img
      src="/logo.png"
      alt="Mnemos"
      className={`mnemos-logo-mark ${className}`}
      width={size}
      height={size}
      style={{ borderRadius: size * 0.25 }}
      draggable={false}
    />
  );
}
