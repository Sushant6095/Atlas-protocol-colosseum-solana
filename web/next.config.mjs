import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  images: {
    // Brand assets in /public/brand/protocols/ are SVG/PNG vendored
    // from each partner's official site. We trust them; allow SVG.
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  webpack: (config) => {
    // `@atlas/qvac` is a workspace TS package (sdk/qvac). Until it's
    // wired into pnpm workspaces, alias it directly to the source so
    // the components that import it compile in this app.
    config.resolve.alias["@atlas/qvac"] = path.resolve(
      __dirname,
      "../sdk/qvac/src/index.ts",
    );
    return config;
  },
  async redirects() {
    // 301 the marketing app's /docs routes to docs.atlasfi.in only
    // when explicitly enabled. Local dev keeps the existing
    // (docs) route group reachable so we don't break /docs/widgets
    // before the docs subdomain is live.
    if (process.env.NEXT_PUBLIC_DOCS_SUBDOMAIN_LIVE !== "1") return [];

    return [
      {
        source: "/docs",
        destination: "https://docs.atlasfi.in",
        permanent: true,
      },
      {
        source: "/docs/:path*",
        destination: "https://docs.atlasfi.in/docs/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
