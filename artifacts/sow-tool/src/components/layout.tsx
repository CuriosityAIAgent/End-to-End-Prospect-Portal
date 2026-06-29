import { ReactNode } from "react";
import { Link } from "wouter";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md print:hidden">
        <div className="container mx-auto px-6 h-16 flex items-center">
          {/* The wordmark is the only nav — it links home. With a single page,
              a separate "Pipeline" tab was redundant. */}
          <Link href="/" className="flex flex-col leading-none">
            <span className="font-serif text-xl tracking-tight text-foreground">Source of Wealth</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mt-1">
              Private Banking Workspace
            </span>
          </Link>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-6 py-12 overflow-x-clip">
        {children}
      </main>
    </div>
  );
}
