"use client";

export function LogoBadge({ size = 36 }: { size?: number }) {
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#29d3ff] glow-accent"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#29d3ff] blur-md opacity-50" />
      <span className="relative font-bold text-white" style={{ fontSize: size * 0.5 }}>A</span>
    </span>
  );
}
