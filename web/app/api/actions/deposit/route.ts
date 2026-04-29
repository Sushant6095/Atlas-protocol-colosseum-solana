// Solana Actions / Blinks endpoint for share-to-deposit viral loop.
// Phase 2 wires real tx building via @atlas/sdk + @solana/kit.

import {
  ActionGetResponse,
  ActionPostRequest,
  ActionPostResponse,
  ACTIONS_CORS_HEADERS,
} from "@solana/actions";

const ICON = "https://atlas.fyi/icon.png";

export async function GET(): Promise<Response> {
  const payload: ActionGetResponse = {
    icon: ICON,
    title: "Atlas Vault — Verified AI Yield",
    description:
      "Deposit USDC. AI rebalances across Kamino, Drift, Jupiter — every move zkML-proven onchain via SP1.",
    label: "Deposit",
    links: {
      actions: [
        { type: "transaction", label: "Deposit 10 USDC", href: "/api/actions/deposit?amount=10" },
        { type: "transaction", label: "Deposit 100 USDC", href: "/api/actions/deposit?amount=100" },
        {
          type: "transaction",
          label: "Custom",
          href: "/api/actions/deposit?amount={amount}",
          parameters: [{ name: "amount", label: "USDC amount", required: true }],
        },
      ],
    },
  };
  return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
}

export async function POST(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const amount = Number(url.searchParams.get("amount") ?? "0");
  const body = (await req.json()) as ActionPostRequest;
  void body.account;

  // Phase 2: build versioned tx invoking atlas_vault::deposit with `amount`.
  const tx = "PLACEHOLDER_BASE64_TX";
  const payload: ActionPostResponse = {
    type: "transaction",
    transaction: tx,
    message: `Depositing ${amount} USDC into Atlas Vault`,
  };
  return Response.json(payload, { headers: ACTIONS_CORS_HEADERS });
}

export const OPTIONS = GET;
