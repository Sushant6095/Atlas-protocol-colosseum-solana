"use client";

// HeaderNav — demo-quality navbar. One PRODUCT mega-menu (20 surfaces
// grouped into 4 columns) + 5 direct pills. Replaces the GSAP PillNav
// on every marketing route. Mobile collapses into a hamburger Sheet
// with the PRODUCT mega-menu rendered as expandable groups.
//
// All 20 mega-menu hrefs have been verified to map to real files on
// disk via the route-group convention (paren-wrapped dirs are stripped
// from the URL).

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ELECTRIC = "#3F8CFF";

interface DirectItem {
  label: string;
  href: string;
}

interface MenuItem {
  label: string;
  href: string;
  description: string;
}

interface MenuColumn {
  heading: string;
  items: MenuItem[];
}

const DIRECT_ITEMS: DirectItem[] = [
  { label: "Home",            href: "/" },
  { label: "Decision Engine", href: "/decision-engine" },
  { label: "Proofs",          href: "/proofs" },
  { label: "Vaults",          href: "/vaults" },
  { label: "Docs",            href: "/docs" },
];

const PRODUCT_COLUMNS: MenuColumn[] = [
  {
    heading: "Public",
    items: [
      { label: "Decision Engine",     href: "/decision-engine",     description: "7-agent brain — live cascade" },
      { label: "Live Proofs",         href: "/proofs/live",         description: "Streaming receipts" },
      { label: "Infrastructure",      href: "/infra",               description: "Slot freshness + RPC health" },
      { label: "Architecture",        href: "/architecture",        description: "16-stage pipeline" },
      { label: "Security",            href: "/security",            description: "26 invariants enforced" },
    ],
  },
  {
    heading: "Product",
    items: [
      { label: "Vaults",              href: "/vaults",              description: "12 PUSD strategies" },
      { label: "Markets",             href: "/markets",             description: "Live DeFi yields" },
      { label: "Proofs",              href: "/proofs",              description: "zk receipt feed" },
      { label: "Wallet Intelligence", href: "/wallet-intelligence", description: "Counterparty scoring" },
      { label: "Risk Dashboard",      href: "/risk",                description: "Exposure + anomaly" },
    ],
  },
  {
    heading: "Treasury OS",
    items: [
      { label: "Treasury",            href: "/treasury",            description: "Treasury dashboard" },
      { label: "Recurring Payments",  href: "/recurring",           description: "Scheduled disbursements" },
      { label: "Triggers",            href: "/triggers",            description: "Conditional execution" },
      { label: "Hedging",             href: "/hedging",             description: "Risk-off positions" },
      { label: "Governance",          href: "/governance",          description: "Multisig + agents" },
    ],
  },
  {
    heading: "Developers",
    items: [
      { label: "Documentation",       href: "/docs",                description: "Full developer docs" },
      { label: "SDK · Rust + TS",     href: "/docs/sdk",            description: "@atlas/sdk + atlas-sdk-rs" },
      { label: "Integrations",        href: "/docs/integrations",   description: "27 audited partners" },
      { label: "Widgets",             href: "/docs/widgets",        description: "Embeddable components" },
      { label: "Playground",          href: "/docs/playground",     description: "Live API tester" },
    ],
  },
];

const MENU_FOOTER = { label: "View all surfaces", href: "/docs/api" };

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function HeaderNav(): JSX.Element {
  const pathname = usePathname() ?? "/";

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{
        borderColor: "color-mix(in oklab, #ffffff 8%, transparent)",
        background: "color-mix(in oklab, #0F1117 90%, transparent)",
      }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:px-6">
        {/* logo */}
        <Link
          href="/"
          aria-label="Atlas home"
          className="inline-flex items-center gap-2"
        >
          <Image
            src="/brand/atlas-mark.svg"
            alt=""
            width={22}
            height={22}
            priority
          />
          <span className="hidden font-display text-[15px] font-semibold tracking-tight text-white md:inline">
            Atlas
          </span>
        </Link>

        {/* desktop nav */}
        <nav className="ml-4 hidden flex-1 md:flex">
          <NavigationMenu viewport={false} className="max-w-none justify-start">
            <NavigationMenuList className="gap-1.5">
              {/* PRODUCT mega-menu */}
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    "h-9 rounded-full bg-transparent px-4 font-mono text-[11px] uppercase tracking-[0.16em] text-white/85 hover:bg-white/8 hover:text-white",
                    "data-[state=open]:bg-white/8 data-[state=open]:text-white",
                    "focus:bg-white/8 focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent-electric)]",
                  )}
                >
                  Product
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ProductMegaMenu />
                </NavigationMenuContent>
              </NavigationMenuItem>

              {/* direct pills */}
              {DIRECT_ITEMS.map((it) => {
                const active = isActive(pathname, it.href);
                return (
                  <NavigationMenuItem key={it.href}>
                    <NavigationMenuLink asChild>
                      <Link
                        href={it.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative inline-flex h-9 items-center rounded-full px-4 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
                          active
                            ? "bg-white/8 text-white"
                            : "text-white/75 hover:bg-white/8 hover:text-white",
                        )}
                        style={
                          active
                            ? { boxShadow: `inset 0 -2px 0 0 ${ELECTRIC}` }
                            : undefined
                        }
                      >
                        {it.label}
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                );
              })}
            </NavigationMenuList>
          </NavigationMenu>
        </nav>

        <div className="flex-1 md:hidden" />

        {/* mobile hamburger */}
        <MobileMenu pathname={pathname} />
      </div>
    </header>
  );
}

function ProductMegaMenu(): JSX.Element {
  return (
    <div
      className="rounded-2xl border p-8 shadow-2xl"
      style={{
        background: "color-mix(in oklab, #0B0D12 95%, transparent)",
        backdropFilter: "blur(16px)",
        borderColor: "color-mix(in oklab, #ffffff 10%, transparent)",
        width: 920,
      }}
    >
      <div className="grid grid-cols-4 gap-x-8 gap-y-2">
        {PRODUCT_COLUMNS.map((col) => (
          <div key={col.heading}>
            <p
              className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              {col.heading}
            </p>
            <ul className="space-y-1">
              {col.items.map((it) => (
                <li key={it.href}>
                  <NavigationMenuLink asChild>
                    <Link
                      href={it.href}
                      className="group block rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                    >
                      <p
                        className="font-display text-sm font-semibold tracking-[-0.01em] leading-tight"
                        style={{ color: "#FFFFFF" }}
                      >
                        {it.label}
                      </p>
                      <p
                        className="mt-0.5 text-[11px] leading-tight"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        {it.description}
                      </p>
                    </Link>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        className="mt-6 flex items-center border-t pt-4"
        style={{ borderColor: "color-mix(in oklab, #ffffff 10%, transparent)" }}
      >
        <NavigationMenuLink asChild>
          <Link
            href={MENU_FOOTER.href}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] hover:opacity-90"
            style={{ color: ELECTRIC }}
          >
            {MENU_FOOTER.label}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </NavigationMenuLink>
      </div>
    </div>
  );
}

function MobileMenu({ pathname }: { pathname: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open menu"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/85 hover:bg-white/8 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-[360px] border-l p-0"
        style={{
          background: "#0B0D12",
          color: "#FFFFFF",
          borderColor: "color-mix(in oklab, #ffffff 10%, transparent)",
        }}
      >
        <SheetTitle className="sr-only">Atlas navigation</SheetTitle>
        <div className="flex items-center justify-between px-5 py-4">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-2"
          >
            <Image src="/brand/atlas-mark.svg" alt="" width={20} height={20} />
            <span className="font-display text-[14px] font-semibold">Atlas</span>
          </Link>
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/8"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1 px-3 pb-6">
          {/* direct pills first */}
          {DIRECT_ITEMS.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2 font-mono text-[12px] uppercase tracking-[0.16em] transition-colors",
                  active
                    ? "bg-white/8 text-white"
                    : "text-white/85 hover:bg-white/8",
                )}
              >
                {it.label}
              </Link>
            );
          })}

          {/* product expandable */}
          <button
            onClick={() => setProductOpen((v) => !v)}
            aria-expanded={productOpen}
            className="mt-3 flex w-full items-center justify-between rounded-md px-3 py-2 font-mono text-[12px] uppercase tracking-[0.16em] text-white/85 hover:bg-white/8"
          >
            Product
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                productOpen && "rotate-180",
              )}
            />
          </button>

          {productOpen && (
            <div className="mt-1 space-y-4 pl-3">
              {PRODUCT_COLUMNS.map((col) => (
                <section key={col.heading}>
                  <p
                    className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.22em]"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    {col.heading}
                  </p>
                  <ul className="space-y-0.5">
                    {col.items.map((it) => (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          onClick={() => setOpen(false)}
                          className="block rounded-md px-3 py-1.5 transition-colors hover:bg-white/[0.04]"
                        >
                          <p
                            className="font-display text-[13px] font-semibold leading-tight"
                            style={{ color: "#FFFFFF" }}
                          >
                            {it.label}
                          </p>
                          <p
                            className="mt-0.5 text-[10px] leading-tight"
                            style={{ color: "rgba(255,255,255,0.5)" }}
                          >
                            {it.description}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <Link
                href={MENU_FOOTER.href}
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex items-center gap-1.5 px-3 font-mono text-[11px] uppercase tracking-[0.18em]"
                style={{ color: ELECTRIC }}
              >
                {MENU_FOOTER.label}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
