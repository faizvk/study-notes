import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { BookOpen, LogOut, PanelLeft, Search } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem("sn_sidebar") !== "0"
  );
  const [palette, setPalette] = useState<{ open: boolean; tag?: string }>({ open: false });

  useEffect(() => {
    localStorage.setItem("sn_sidebar", sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);

  useEffect(() => {
    function editing(): boolean {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette({ open: true });
      } else if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !editing()) {
        // Quick search when just reading (inside the editor "/" is the block menu).
        e.preventDefault();
        setPalette({ open: true });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = (tag?: string) => setPalette({ open: true, tag });
  const initial = (user?.full_name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="flex h-full text-zinc-200">
      {sidebarOpen && (
        <aside className="animate-fade-in flex w-64 shrink-0 flex-col bg-[var(--bg-side)]">
          {/* Brand + collapse */}
          <div className="flex items-center justify-between py-3 pl-4 pr-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]">
                <BookOpen size={14} strokeWidth={2} className="text-zinc-400" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-zinc-100">
                Study Notes
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              title="Hide sidebar"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-200 hover:bg-white/5 hover:text-zinc-200"
            >
              <PanelLeft size={15} strokeWidth={1.75} />
            </button>
          </div>

          {/* Library (new note · pinned · notes · tags) */}
          <div className="flex min-h-0 flex-1 flex-col">
            <Sidebar onOpenPalette={openPalette} />
          </div>

          {/* Bottom: search + account */}
          <div className="hairline space-y-1 border-t p-2">
            <button
              onClick={() => openPalette()}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] text-zinc-400 transition-colors duration-200 hover:bg-white/[0.05] hover:text-zinc-200"
            >
              <span className="flex items-center gap-2">
                <Search size={13} strokeWidth={2} className="opacity-70" />
                Search…
              </span>
              <kbd className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-sans text-[10px] text-zinc-500">
                Ctrl K
              </kbd>
            </button>
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-200 hover:bg-white/[0.04]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                {initial}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-300">
                {user?.full_name || user?.email}
              </span>
              <button
                onClick={logout}
                title="Sign out"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors duration-200 hover:bg-white/5 hover:text-zinc-200"
              >
                <LogOut size={13} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </aside>
      )}

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            title="Show sidebar"
            className="absolute left-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-[var(--bg-side)] text-zinc-400 transition-colors duration-200 hover:text-zinc-100"
          >
            <PanelLeft size={15} strokeWidth={1.75} />
          </button>
        )}
        <Outlet />
      </main>

      <CommandPalette
        open={palette.open}
        initialTag={palette.tag}
        onClose={() => setPalette({ open: false })}
      />
    </div>
  );
}
