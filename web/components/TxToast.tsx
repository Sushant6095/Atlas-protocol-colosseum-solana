"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { create } from "zustand";
import { explorerTxUrl } from "@/lib/atlas";

type Status = "pending" | "success" | "error";

interface ToastEntry {
  id: number;
  status: Status;
  title: string;
  detail?: string;
  signature?: string;
}

interface ToastStore {
  toasts: ToastEntry[];
  push: (t: Omit<ToastEntry, "id">) => number;
  update: (id: number, patch: Partial<ToastEntry>) => void;
  remove: (id: number) => void;
}

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, ...t }] }));
    return id;
  },
  update: (id, patch) =>
    set((s) => ({ toasts: s.toasts.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

export function TxToastHost() {
  const { toasts, remove } = useToasts();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-[360px] max-w-[92vw]">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="glass rounded-xl p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <Icon status={t.status} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{t.title}</div>
                {t.detail && (
                  <div className="text-xs text-[color:var(--color-muted)] mt-0.5">{t.detail}</div>
                )}
                {t.signature && (
                  <a
                    href={explorerTxUrl(t.signature)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-[color:var(--color-accent)] hover:underline"
                  >
                    View on Solana FM <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="text-[color:var(--color-muted)] hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Icon({ status }: { status: Status }) {
  if (status === "pending") {
    return <Loader2 className="h-5 w-5 text-[color:var(--color-accent-2)] animate-spin flex-shrink-0 mt-0.5" />;
  }
  if (status === "success") {
    return <CheckCircle2 className="h-5 w-5 text-[color:var(--color-success)] flex-shrink-0 mt-0.5" />;
  }
  return <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />;
}
