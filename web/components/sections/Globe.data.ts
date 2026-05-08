// Atlas integration partner regions (RPC + oracle datacenter approx locations)
// Format: [latitude, longitude]
export const HIGHLIGHT_MARKERS: { location: [number, number]; size: number; label: string }[] = [
  { location: [37.7749,  -122.4194], size: 0.10, label: "Helius US-West" },
  { location: [40.7128,  -74.0060],  size: 0.10, label: "Triton US-East" },
  { location: [51.5074,  -0.1278],   size: 0.10, label: "QuickNode EU" },
  { location: [50.1109,  8.6821],    size: 0.10, label: "Pyth Frankfurt" },
  { location: [1.3521,   103.8198],  size: 0.10, label: "RPC Fast APAC" },
  { location: [35.6762,  139.6503],  size: 0.10, label: "Switchboard Tokyo" },
];

// Smaller scattered dots representing active treasury signals / global reach
export const SCATTER_MARKERS: { location: [number, number]; size: number }[] = [
  // North America
  { location: [34.0522,  -118.2437], size: 0.03 },
  { location: [47.6062,  -122.3321], size: 0.03 },
  { location: [41.8781,  -87.6298],  size: 0.03 },
  { location: [29.7604,  -95.3698],  size: 0.03 },
  { location: [25.7617,  -80.1918],  size: 0.03 },
  { location: [43.6532,  -79.3832],  size: 0.03 },
  { location: [49.2827,  -123.1207], size: 0.03 },
  { location: [19.4326,  -99.1332],  size: 0.03 },
  // Europe
  { location: [48.8566,  2.3522],    size: 0.03 },
  { location: [52.5200,  13.4050],   size: 0.03 },
  { location: [55.7558,  37.6173],   size: 0.03 },
  { location: [41.9028,  12.4964],   size: 0.03 },
  { location: [40.4168,  -3.7038],   size: 0.03 },
  { location: [52.3676,  4.9041],    size: 0.03 },
  { location: [59.3293,  18.0686],   size: 0.03 },
  { location: [55.6761,  12.5683],   size: 0.03 },
  { location: [60.1699,  24.9384],   size: 0.03 },
  { location: [50.0755,  14.4378],   size: 0.03 },
  { location: [47.4979,  19.0402],   size: 0.03 },
  { location: [38.7223,  -9.1393],   size: 0.03 },
  // Asia
  { location: [22.3193,  114.1694],  size: 0.03 },
  { location: [37.5665,  126.9780],  size: 0.03 },
  { location: [25.0330,  121.5654],  size: 0.03 },
  { location: [13.7563,  100.5018],  size: 0.03 },
  { location: [3.1390,   101.6869],  size: 0.03 },
  { location: [-6.2088,  106.8456],  size: 0.03 },
  { location: [28.6139,  77.2090],   size: 0.03 },
  { location: [19.0760,  72.8777],   size: 0.03 },
  { location: [12.9716,  77.5946],   size: 0.03 },
  { location: [31.2304,  121.4737],  size: 0.03 },
  { location: [39.9042,  116.4074],  size: 0.03 },
  { location: [25.2048,  55.2708],   size: 0.03 },
  { location: [24.7136,  46.6753],   size: 0.03 },
  // South America
  { location: [-23.5505, -46.6333],  size: 0.03 },
  { location: [-34.6037, -58.3816],  size: 0.03 },
  { location: [-33.4489, -70.6693],  size: 0.03 },
  { location: [4.7110,   -74.0721],  size: 0.03 },
  { location: [-12.0464, -77.0428],  size: 0.03 },
  // Oceania + Africa
  { location: [-33.8688, 151.2093],  size: 0.03 },
  { location: [-37.8136, 144.9631],  size: 0.03 },
  { location: [-26.2041, 28.0473],   size: 0.03 },
  { location: [-1.2921,  36.8219],   size: 0.03 },
  { location: [30.0444,  31.2357],   size: 0.03 },
  { location: [6.5244,   3.3792],    size: 0.03 },
];

// Static fallback for stats — replaced by /api/v1/infra at runtime
export type LiveStat = {
  label: string;
  value: string;
  position: "tl" | "tr" | "bl" | "br";  // corner placement
  accent: "electric" | "zk" | "proof" | "execute";
};

export const STAT_FALLBACKS: LiveStat[] = [
  { label: "VERIFIED REBALANCES",   value: "142",        position: "tl", accent: "electric" },
  { label: "PROOFS VERIFIED · 24H", value: "142",        position: "tr", accent: "zk" },
  { label: "ACTIVE INTEGRATIONS",   value: "27",         position: "bl", accent: "proof" },
  { label: "LAST REBALANCE",        value: "1s ago",     position: "br", accent: "execute" },
];
