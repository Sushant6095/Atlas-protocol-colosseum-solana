// Full Kamino-quality docs chrome.
//
// Layout columns:
//   1. Top nav (logo + search + tabs + Open App)            — sticky
//   2. Sidebar (categorized, expandable)  280px              — sticky on lg+
//   3. Main column (max-w 768px, breadcrumb + h1 + body)     — centred
//   4. Right rail "On this page"          240px              — sticky on xl+
//
// On <1024px the sidebar collapses into a drawer (MobileSidebar);
// the right rail hides entirely below xl.

import type { ReactNode } from "react";
import {
  DocsTopNav, DocsSidebar, DocsTocRail, MobileSidebar,
} from "@/components/docs";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--color-surface-base)" }}
    >
      <DocsTopNav />

      <div className="mx-auto w-full max-w-[1440px] flex-1 flex">
        <aside
          className="hidden lg:flex w-[280px] shrink-0 border-r sticky top-[112px] self-start
                     h-[calc(100vh-112px)]"
          style={{ borderColor: "var(--color-line-soft)" }}
        >
          <DocsSidebar className="w-full" />
        </aside>

        <main className="flex-1 min-w-0 px-4 lg:px-10 py-10 flex justify-center">
          <div className="w-full max-w-[768px] flex flex-col">
            <div className="lg:hidden mb-4">
              <MobileSidebar />
            </div>
            {children}
          </div>
        </main>

        <div
          className="hidden xl:block w-[240px] shrink-0 px-4 self-start sticky top-[112px]"
        >
          <DocsTocRail />
        </div>
      </div>
    </div>
  );
}
