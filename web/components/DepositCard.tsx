"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletPicker } from "@/components/WalletPickerModal";
import { useQueryClient } from "@tanstack/react-query";
import { buildDepositTransaction, ATLAS_TREASURY, fmtSol, CLUSTER } from "@/lib/atlas";
import { useSolBalance } from "@/hooks/useSolBalance";
import { useToasts } from "@/components/TxToast";

const PRESETS = [0.01, 0.05, 0.1, 0.5];

export function DepositCard({ mode }: { mode: "deposit" | "withdraw" }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const setPickerOpen = useWalletPicker((s) => s.setOpen);
  const { data: balance } = useSolBalance();
  const qc = useQueryClient();
  const toasts = useToasts();

  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!connected || !publicKey) {
      setPickerOpen(true);
      return;
    }
    if (mode === "withdraw") {
      toasts.push({
        status: "error",
        title: "Withdraw needs deployed vault program",
        detail: "atlas_vault::withdraw lands in Phase 2. For now, the deposit pipeline is wired to devnet.",
      });
      return;
    }
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) return;

    setBusy(true);
    const tid = toasts.push({
      status: "pending",
      title: `Submitting ${num} SOL deposit…`,
      detail: ATLAS_TREASURY ? "Routing to Atlas treasury" : "Demo: self-transfer (only network fee paid)",
    });

    try {
      const tx = await buildDepositTransaction(connection, publicKey, num);
      const sig = await sendTransaction(tx, connection);
      toasts.update(tid, { detail: "Awaiting confirmation…", signature: sig });
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed",
      );
      toasts.update(tid, {
        status: "success",
        title: `Deposit confirmed`,
        detail: `${num} SOL · ${CLUSTER}`,
        signature: sig,
      });
      setAmount("");
      qc.invalidateQueries({ queryKey: ["sol-balance"] });
    } catch (e) {
      toasts.update(tid, {
        status: "error",
        title: "Transaction failed",
        detail: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  };

  const max = balance ? Math.max(0, balance / 1e9 - 0.005) : 0;
  const symbol = mode === "deposit" ? "SOL" : "atUSDC";

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-[color:var(--color-muted)] mb-2 flex justify-between">
          <span>{mode === "deposit" ? "Amount" : "Shares to redeem"}</span>
          <button
            className="hover:text-white transition"
            type="button"
            onClick={() => connected && setAmount(max.toFixed(4))}
          >
            Balance: {connected ? fmtSol(balance, 4) : "—"} {symbol}
          </button>
        </div>
        <div className="flex gap-2 rounded-xl border border-[color:var(--color-border)] bg-black/40 p-4 focus-within:border-[color:var(--color-accent)] transition">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            inputMode="decimal"
            disabled={busy}
            className="flex-1 bg-transparent outline-none text-3xl font-semibold tracking-tight disabled:opacity-50"
          />
          <span className="text-sm font-medium text-[color:var(--color-muted)] self-center px-2 py-1 rounded-md bg-white/5">
            {symbol}
          </span>
        </div>
      </div>

      {mode === "deposit" && (
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              disabled={busy}
              className="text-xs py-2 rounded-lg border border-[color:var(--color-border)] hover:bg-white/5 hover:border-[color:var(--color-accent)] transition disabled:opacity-50"
            >
              {p} SOL
            </button>
          ))}
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={submit}
        disabled={busy || (connected && !amount)}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#29d3ff] text-white font-medium glow-accent hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {!connected
          ? "Connect Wallet"
          : busy
          ? "Submitting…"
          : mode === "deposit"
          ? `Deposit ${amount || ""} SOL`.trim()
          : "Withdraw"}
      </motion.button>

      {mode === "deposit" && (
        <div className="text-[11px] leading-relaxed pt-3 text-[color:var(--color-muted)] flex items-start gap-2">
          <span className="mt-0.5 text-[color:var(--color-accent-2)]">▲</span>
          <span>
            <strong className="text-white">{CLUSTER === "devnet" ? "Devnet demo" : "Mainnet"}</strong> ·{" "}
            {ATLAS_TREASURY
              ? "deposits route to the Atlas treasury."
              : "deposits self-transfer (no funds lost; only network fee paid). Mainnet vault launches with Token-2022 USDC + SP1 proof gating."}
          </span>
        </div>
      )}
    </div>
  );
}
