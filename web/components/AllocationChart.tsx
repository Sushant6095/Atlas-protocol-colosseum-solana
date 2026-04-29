"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";

const data = [
  { name: "Kamino", value: 40, color: "#7c5cff", apy: 9.2 },
  { name: "Drift", value: 25, color: "#29d3ff", apy: 14.1 },
  { name: "Jupiter", value: 20, color: "#f7c948", apy: 12.6 },
  { name: "Marginfi", value: 10, color: "#ff7a59", apy: 7.4 },
  { name: "Idle", value: 5, color: "#6b7280", apy: 0 },
];

export function AllocationChart() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
      <div className="h-56 relative">
        <ResponsiveContainer>
          <PieChart>
            <defs>
              {data.map((d, i) => (
                <radialGradient key={d.name} id={`grad-${i}`}>
                  <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={d.color} stopOpacity={0.6} />
                </radialGradient>
              ))}
            </defs>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              startAngle={90}
              endAngle={-270}
              animationDuration={1400}
            >
              {data.map((d, i) => <Cell key={d.name} fill={`url(#grad-${i})`} stroke="none" />)}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "rgba(20,20,26,0.9)",
                border: "1px solid rgba(124,92,255,0.3)",
                borderRadius: 12,
                backdropFilter: "blur(20px)",
              }}
              labelStyle={{ color: "#fff" }}
              itemStyle={{ color: "#fff" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="text-center">
            <div className="text-xs text-[color:var(--color-muted)]">Blended APY</div>
            <div className="text-2xl font-bold text-[color:var(--color-success)]">11.84%</div>
          </div>
        </div>
      </div>

      <ul className="space-y-2.5">
        {data.map((d, i) => (
          <motion.li
            key={d.name}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 * i, duration: 0.5 }}
            className="flex items-center justify-between text-sm rounded-lg px-3 py-2 hover:bg-white/5 transition"
          >
            <span className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color, boxShadow: `0 0 12px ${d.color}` }} />
              <span className="font-medium">{d.name}</span>
            </span>
            <span className="flex items-center gap-3 text-xs">
              <span className="text-[color:var(--color-muted)]">{d.apy.toFixed(1)}% APY</span>
              <span className="font-mono font-semibold w-10 text-right">{d.value}%</span>
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
