import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-[#03040a]/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="font-title text-[0.72rem] uppercase tracking-[0.28em] text-[#d9bd78]">
          Lore Studio
        </Link>
        <nav className="flex items-center gap-4 text-[0.68rem] uppercase tracking-[0.22em]">
          <Link href="/" className="text-[#9baabd] transition hover:text-[#f7ebce]">
            Create Your Legend
          </Link>
          <Link
            href="/daily-mystery"
            className="rounded-full border border-[#d9bd78]/25 px-3 py-1.5 text-[#f7ebce] transition hover:border-[#d9bd78]/45 hover:bg-[#d9bd78]/8"
          >
            Daily Mystery
          </Link>
        </nav>
      </div>
    </header>
  );
}
