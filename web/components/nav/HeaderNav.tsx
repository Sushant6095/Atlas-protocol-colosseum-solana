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
import {
  ArrowUpRight, ChevronDown, Menu, X,
  Brain, Activity, Server, GitBranch, ShieldCheck,
  Vault, TrendingUp, FileCheck, Wallet, AlertTriangle,
  Banknote, CalendarClock, Zap, Scale, Users,
  BookOpen, Code, Plug, LayoutGrid, Terminal,
  type LucideIcon,
} from "lucide-react";
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
  /** Last word of label rendered in column accent colour. */
  featureWord: string;
  href: string;
  description: string;
  icon: LucideIcon;
}

interface MenuColumn {
  heading: string;
  /** Hex used for heading underline, icon tile, and accent word. */
  accentColor: string;
  items: MenuItem[];
}

interface FeaturedItem {
  label: string;
  featureWord: string;
  description: string;
  href: string;
  iconSrc: string;
}

interface DirectItemX extends DirectItem {
  /** Hide below the xl breakpoint (1280px) — overflow protection. */
  collapseBelowXl?: boolean;
}

const DIRECT_ITEMS: DirectItemX[] = [
  { label: "Home",            href: "/" },
  { label: "Decision Engine", href: "/decision-engine" },
  { label: "Proofs",          href: "/proofs" },
  { label: "Vaults",          href: "/vaults" },
  { label: "Treasury",        href: "/treasury" },
  { label: "Markets",         href: "/markets", collapseBelowXl: true },
  { label: "Security",        href: "/security", collapseBelowXl: true },
  { label: "Docs",            href: "/docs" },
];

const PRODUCT_COLUMNS: MenuColumn[] = [
  {
    heading: "Public",
    accentColor: "#3F8CFF", // accent.electric
    items: [
      { label: "Decision Engine",     featureWord: "Engine",         description: "7-agent brain — live cascade",       href: "/decision-engine",     icon: Brain },
      { label: "Live Proofs",         featureWord: "Proofs",         description: "Streaming receipts",                 href: "/proofs/live",         icon: Activity },
      { label: "Infrastructure",      featureWord: "Infrastructure", description: "Slot freshness + RPC health",        href: "/infra",               icon: Server },
      { label: "Architecture",        featureWord: "Architecture",   description: "16-stage pipeline",                  href: "/architecture",        icon: GitBranch },
      { label: "Security",            featureWord: "Security",       description: "26 invariants enforced",             href: "/security",            icon: ShieldCheck },
    ],
  },
  {
    heading: "Product",
    accentColor: "#A682FF", // accent.zk
    items: [
      { label: "Vaults",              featureWord: "Vaults",         description: "12 PUSD strategies",                 href: "/vaults",              icon: Vault },
      { label: "Markets",             featureWord: "Markets",        description: "Live DeFi yields",                   href: "/markets",             icon: TrendingUp },
      { label: "Proofs",              featureWord: "Proofs",         description: "zk receipt feed",                    href: "/proofs",              icon: FileCheck },
      { label: "Wallet Intelligence", featureWord: "Intelligence",   description: "Counterparty scoring",               href: "/wallet-intelligence", icon: Wallet },
      { label: "Risk Dashboard",      featureWord: "Dashboard",      description: "Exposure + anomaly",                 href: "/risk",                icon: AlertTriangle },
    ],
  },
  {
    heading: "Treasury OS",
    accentColor: "#3CE39A", // accent.execute
    items: [
      { label: "Treasury",            featureWord: "Treasury",       description: "Treasury dashboard",                 href: "/treasury",            icon: Banknote },
      { label: "Recurring Payments",  featureWord: "Payments",       description: "Scheduled disbursements",            href: "/recurring",           icon: CalendarClock },
      { label: "Triggers",            featureWord: "Triggers",       description: "Conditional execution",              href: "/triggers",            icon: Zap },
      { label: "Hedging",             featureWord: "Hedging",        description: "Risk-off positions",                 href: "/hedging",             icon: Scale },
      { label: "Governance",          featureWord: "Governance",     description: "Multisig + agents",                  href: "/governance",          icon: Users },
    ],
  },
  {
    heading: "Developers",
    accentColor: "#F478C6", // accent.proof
    items: [
      { label: "Documentation",       featureWord: "Documentation",  description: "Full developer docs",                href: "/docs",                icon: BookOpen },
      { label: "SDK · Rust + TS",     featureWord: "SDK",            description: "@atlas/sdk + atlas-sdk-rs",          href: "/docs/sdk",            icon: Code },
      { label: "Integrations",        featureWord: "Integrations",   description: "27 audited partners",                href: "/docs/integrations",   icon: Plug },
      { label: "Widgets",             featureWord: "Widgets",        description: "Embeddable components",              href: "/docs/widgets",        icon: LayoutGrid },
      { label: "Playground",          featureWord: "Playground",     description: "Live API tester",                    href: "/docs/playground",     icon: Terminal },
    ],
  },
];

/** Footer link used in the mobile sheet PRODUCT section. Desktop
 *  uses the FEATURED row instead. */
const MENU_FOOTER = { label: "View all surfaces", href: "/docs/api" };

const FEATURED: FeaturedItem = {
  label: "Atlas Core Platform",
  featureWord: "Core Platform",
  description:
    "26 hard invariants · Squads multisig from day one · SP1 Groth16 proven on Solana. The trust root for everything above.",
  href: "/architecture",
  iconSrc: "/brand/atlas-pleiades-light.svg",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export interface HeaderNavProps {
  /** Default true. Set false on the docs route so the docs chrome's
   *  own sticky top-nav can keep ownership of the viewport top edge. */
  sticky?: boolean;
}

export function HeaderNav({ sticky = true }: HeaderNavProps = {}): JSX.Element {
  const pathname = usePathname() ?? "/";

  return (
    <header
      className={cn(
        "z-40 border-b backdrop-blur",
        sticky && "sticky top-0",
      )}
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
              {/* PRODUCT mega-menu — built-in shadcn chevron rotates
                  180° on open (group-data-open/navigation-menu-trigger). */}
              <NavigationMenuItem>
                <NavigationMenuTrigger
                  className={cn(
                    "h-8 rounded-full bg-transparent px-3 py-1.5 font-mono text-[13px] uppercase tracking-[0.14em] text-white/85 hover:bg-white/8 hover:text-white",
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

              {/* direct pills — tighter density to fit 8 + dropdown */}
              {DIRECT_ITEMS.map((it) => {
                const active = isActive(pathname, it.href);
                return (
                  <NavigationMenuItem
                    key={it.href}
                    className={cn(it.collapseBelowXl && "hidden xl:flex")}
                  >
                    <NavigationMenuLink asChild>
                      <Link
                        href={it.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative inline-flex h-8 items-center rounded-full px-3 py-1.5 font-mono text-[13px] uppercase tracking-[0.14em] transition-colors whitespace-nowrap",
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
    <div className="w-[1080px] max-w-[calc(100vw-32px)] rounded-2xl bg-[#0B0D12]/[0.96] p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.02)] ring-1 ring-white/[0.08] backdrop-blur-xl">
      <div className="grid grid-cols-4 gap-x-8">
        {PRODUCT_COLUMNS.map((col) => (
          <div key={col.heading} className="flex flex-col">
            <h3
              className="mb-3 border-b pb-3 font-mono text-[10px] font-medium uppercase tracking-[0.28em]"
              style={{
                color: `${col.accentColor}99`,
                borderColor: `${col.accentColor}1f`,
              }}
            >
              {col.heading}
            </h3>
            {col.items.map((it) => (
              <ItemRow key={it.href} item={it} accentColor={col.accentColor} />
            ))}
          </div>
        ))}
      </div>

      <FeaturedRow data={FEATURED} />
    </div>
  );
}

function ItemRow({
  item, accentColor,
}: { item: MenuItem; accentColor: string }): JSX.Element {
  const Icon = item.icon;
  const prefix = item.label.endsWith(item.featureWord)
    ? item.label.slice(0, item.label.length - item.featureWord.length).trim()
    : item.label.replace(item.featureWord, "").trim();

  return (
    <NavigationMenuLink asChild>
      <Link
        href={item.href}
        className="group -mx-3 flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none"
      >
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
          style={{
            backgroundColor: `${accentColor}14`,
            color: accentColor,
            boxShadow: `inset 0 0 0 1px ${accentColor}33`,
          }}
        >
          <Icon className="size-[18px]" strokeWidth={1.75} />
        </span>

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="whitespace-nowrap font-display text-[14.5px] font-semibold leading-tight tracking-[-0.01em]">
            {prefix && (
              <span className="text-[color:var(--color-ink-tertiary)]">{prefix} </span>
            )}
            <span style={{ color: accentColor }}>{item.featureWord}</span>
          </span>
          <span className="font-sans text-[12.5px] font-normal leading-snug text-[color:var(--color-ink-tertiary)]">
            {item.description}
          </span>
        </span>
      </Link>
    </NavigationMenuLink>
  );
}

function FeaturedRow({ data }: { data: FeaturedItem }): JSX.Element {
  return (
    <NavigationMenuLink asChild>
      <Link
        href={data.href}
        className="group -mx-3 mt-6 flex items-start gap-4 rounded-lg border-t border-white/[0.08] px-3 pb-3 pt-5 transition-colors duration-200 hover:bg-white/[0.03]"
      >
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/10 transition-transform duration-200 group-hover:scale-105"
          style={{
            background:
              "linear-gradient(135deg, rgba(63,140,255,0.15) 0%, rgba(166,130,255,0.15) 50%, rgba(244,120,198,0.15) 100%)",
          }}
        >
          <Image
            src={data.iconSrc}
            alt=""
            width={28}
            height={28}
            className="opacity-90"
          />
        </span>

        <span className="flex min-w-0 flex-col gap-1">
          <span className="font-display text-[15px] font-semibold leading-tight tracking-[-0.01em]">
            <span className="text-[color:var(--color-ink-tertiary)]">Atlas </span>
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #3F8CFF 0%, #A682FF 50%, #F478C6 100%)",
              }}
            >
              {data.featureWord}
            </span>
          </span>
          <span className="max-w-[640px] font-sans text-[12.5px] font-normal leading-snug text-[color:var(--color-ink-tertiary)]">
            {data.description}
          </span>
        </span>

        <ArrowUpRight
          className="ml-auto mt-1 size-4 shrink-0 text-[color:var(--color-ink-tertiary)] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white"
        />
      </Link>
    </NavigationMenuLink>
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
