import burantoLogoPath from "@assets/buranto-logo.jpg";

// BurantoLogo — renders the actual JPG logo
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

// BurantoLogoSVG — used in the dark sidebar
// Uses the actual logo image; CSS filter makes it white on dark backgrounds
export function BurantoLogoSVG({ width = 160 }: { width?: number }) {
  // The logo JPG is dark text on light background — invert for dark sidebar
  return (
    <img
      src={burantoLogoPath}
      alt="BURANTO"
      width={width}
      style={{
        display: "block",
        objectFit: "contain",
        filter: "brightness(0) invert(1)",  // White text on dark sidebar
        height: "auto",
      }}
    />
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
