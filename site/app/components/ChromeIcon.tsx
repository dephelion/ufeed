export default function ChromeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M24 24 13 5A22 22 0 0 1 46 24Z" fill="#EA4335" />
      <path d="M24 24h22A22 22 0 0 1 13 43Z" fill="#34A853" />
      <path d="M24 24 13 43A22 22 0 0 1 13 5Z" fill="#FBBC05" />
      <circle cx="24" cy="24" r="10" fill="#fff" />
      <circle cx="24" cy="24" r="8" fill="#4285F4" />
    </svg>
  );
}
