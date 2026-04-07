import burantoLogoPath from "@assets/buranto-logo.jpg";

// BurantoLogo — renders the actual JPG image for light backgrounds (login page)
export function BurantoLogo({ width = 200, height }: { width?: number; height?: number }) {
  const computedHeight = height ?? Math.round(width * 0.22);
  return (
    <img
      src={burantoLogoPath}
      alt="BURANTO"
      width={width}
      height={computedHeight}
      style={{ display: "block", objectFit: "contain" }}
    />
  );
}

// BurantoLogoSVG — SVG wordmark replica with white text for dark sidebar backgrounds
// The "O" has a yellow (#FFE600) half-circle accent on its upper-right
export function BurantoLogoSVG({ width = 160 }: { width?: number }) {
  const height = Math.round(width * 0.28);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 180 42"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="BURANTO"
    >
      {/* BURANT letters in white, wide-tracked geometric bold */}
      <text
        x="0"
        y="32"
        fontFamily="Montserrat, Arial Black, sans-serif"
        fontWeight="800"
        fontSize="28"
        letterSpacing="4"
        fill="#FFFFFF"
      >
        BURANTO
      </text>
      {/* Yellow half-circle accent on the "O" — upper-right arc overlay */}
      <defs>
        <clipPath id="o-top-right">
          <rect x="150" y="4" width="26" height="18" />
        </clipPath>
      </defs>
      <circle
        cx="161"
        cy="21"
        r="12"
        fill="none"
        stroke="#FFE600"
        strokeWidth="4"
        clipPath="url(#o-top-right)"
      />
    </svg>
  );
}

// BurantoLogoSmall — compact icon-sized version for favicon/tab use
export function BurantoLogoSmall({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Buranto"
    >
      {/* Black square background */}
      <rect width="24" height="24" rx="4" fill="#000000" />
      {/* "B" lettermark in white */}
      <text
        x="4"
        y="17"
        fontFamily="Montserrat, Arial Black, sans-serif"
        fontWeight="900"
        fontSize="14"
        fill="#FFFFFF"
      >
        B
      </text>
      {/* Yellow accent dot */}
      <circle cx="18" cy="6" r="3" fill="#FFE600" />
    </svg>
  );
}
