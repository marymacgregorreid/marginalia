import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface MainLayoutProps {
  editor: ReactNode;
  panel: ReactNode;
  hasDocument: boolean;
}

const MIN_PCT = 20;
const MAX_PCT = 80;
const DEFAULT_PCT = 65;

export function MainLayout({
  editor,
  panel,
  hasDocument,
}: MainLayoutProps) {
  const [splitPct, setSplitPct] = useState(DEFAULT_PCT);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setSplitPct(Math.min(MAX_PCT, Math.max(MIN_PCT, pct)));
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  if (!hasDocument) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        {editor}
      </main>
    );
  }

  return (
    <main ref={containerRef} className="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{ width: `${splitPct}%` }}
      >
        <div className="flex-1 overflow-hidden">{editor}</div>
      </div>

      {/* Drag handle */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        className="hidden lg:flex w-1.5 cursor-col-resize items-stretch group shrink-0"
        onMouseDown={handleMouseDown}
      >
        <div className="w-px bg-border/50 group-hover:bg-primary/50 group-active:bg-primary transition-colors mx-auto" />
      </div>

      <div
        className="h-72 lg:h-auto overflow-y-auto shrink-0"
        style={{ width: `${100 - splitPct}%` }}
      >
        {panel}
      </div>
    </main>
  );
}
