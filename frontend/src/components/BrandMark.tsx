export function BrandMark({ className = "" }: { className?: string }) {
  return <img className={`brand-mark ${className}`.trim()} src="/branding/icon-192.png" width={192} height={192} alt="" aria-hidden="true" draggable={false} />;
}
