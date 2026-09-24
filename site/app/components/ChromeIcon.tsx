export default function ChromeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M24 24 13 5A22 22 0 0 1 46 24Z" fill="#171a1f" />
      <path d="M24 24h22A22 22 0 0 1 13 43Z" fill="#858990" />
      <path d="M24 24 13 43A22 22 0 0 1 13 5Z" fill="#fff" />
      <circle cx="24" cy="24" r="10" fill="#fff" />
      <circle cx="24" cy="24" r="8" fill="#171a1f" />
    </svg>
  );
}
