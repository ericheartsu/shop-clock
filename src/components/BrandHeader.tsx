import Link from 'next/link';

interface Props {
  crumbs?: string[];
}

export function BrandHeader({ crumbs }: Props) {
  return (
    <header className="bg-craft-black text-white px-4 py-3 flex items-center gap-3 shadow-md">
      <Link href="/" className="flex items-center gap-2 active:opacity-60">
        <span
          aria-hidden
          className="inline-block w-4 h-6"
          style={{
            background: '#00B5D8',
            clipPath: 'path("M8 0 C8 8, 16 14, 8 24 C0 14, 8 8, 8 0 Z")',
          }}
        />
        <span className="font-extrabold tracking-wide text-lg">SHOP CLOCK</span>
      </Link>
      {crumbs && crumbs.length > 0 && (
        <div className="flex-1 text-right text-xs text-white/70 truncate">
          {crumbs.join(' / ')}
        </div>
      )}
    </header>
  );
}
