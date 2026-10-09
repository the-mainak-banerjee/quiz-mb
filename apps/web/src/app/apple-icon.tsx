import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Raster Apple icon using the existing app/icon.svg geometry and palette. */
export default function AppleIcon() {
  return new ImageResponse(
    <svg
      width="180"
      height="180"
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" fill="#1b3022" />
      <circle cx="15" cy="16" r="4" fill="#5b8266" />
      <circle cx="25" cy="16" r="4" fill="#dfe7e1" />
      <path
        d="M13 27c0-2.5 3-4 7-4s7 1.5 7 4"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>,
    size,
  );
}
