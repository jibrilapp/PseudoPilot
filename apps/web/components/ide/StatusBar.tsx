export function StatusBar() {
  return (
    <footer className="relative z-20 flex h-6 shrink-0 items-center gap-3 border-t border-pp-line bg-pp-shell px-3 text-[11px] text-pp-muted">
      <span className="font-medium tracking-[-0.01em] text-pp-ink/80">PseudoPilot</span>
      <span className="hidden text-pp-faint sm:inline">main.pseudo</span>
      <span className="hidden text-pp-faint md:inline">UTF-8</span>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden sm:inline text-pp-faint">Ln 12, Col 1</span>
        <span className="tracking-[-0.01em]">ClientLocal</span>
        <span className="inline-flex items-center gap-1.5 text-pp-ink/80">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/90" />
          Ready
        </span>
      </div>
    </footer>
  );
}
