// api/solanaData.js
import axios from "axios";

const HELIUS_KEY = process.env.HELIUS_API_KEY;
if (!HELIUS_KEY) {
  console.warn("HELIUS_API_KEY not set in env. Live data will fail without it.");
}

const HELIUS_BASE = "https://api.helius.xyz/v0";

/**
 * Basic Base58-ish validation for a Solana address.
 * It's not perfect but will filter obvious invalid inputs.
 */
function isLikelySolanaAddress(a) {
  if (!a || typeof a !== "string") return false;
  // typical solana addresses are 32-44 chars, base58 chars (no 0,O,l,I)
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
}

/**
 * Convert UNIX timestamp to days old from now
 */
function daysOld(unixSeconds) {
  if (!unixSeconds) return null;
  const now = Date.now() / 1000;
  return Math.floor((now - unixSeconds) / (60 * 60 * 24));
}

/**
 * Main exported function — returns live data + computed score
 */
export async function getWalletData(walletAddress) {
  try {
    if (!isLikelySolanaAddress(walletAddress)) {
      return { error: "Invalid Solana address format." };
    }

    if (!HELIUS_KEY) {
      return { error: "Helius API key missing on server." };
    }

    // ENDPOINTS
    const balancesUrl = `${HELIUS_BASE}/addresses/${walletAddress}/balances?api-key=${HELIUS_KEY}`;
    const txsUrl = `${HELIUS_BASE}/addresses/${walletAddress}/transactions?api-key=${HELIUS_KEY}&limit=50`;

    // parallel fetch
    const [balancesRes, txsRes] = await Promise.allSettled([
      axios.get(balancesUrl),
      axios.get(txsUrl),
    ]);

    // parse balances
    let tokens = [];
    let nfts = [];
    if (balancesRes.status === "fulfilled" && balancesRes.value.data) {
      const b = balancesRes.value.data;
      if (Array.isArray(b.tokens)) tokens = b.tokens;
      if (Array.isArray(b.nfts)) nfts = b.nfts;
    }

    // parse transactions
    let txs = [];
    if (txsRes.status === "fulfilled" && txsRes.value.data) {
      txs = txsRes.value.data; // Helius returns an array of transaction summaries
    }

    // compute basic metrics
    const transactionCount = txs.length;
    const tokenCount = tokens.length;
    const nftCount = nfts.length || 0;

    // compute wallet age using earliest tx blockTime if available
    let walletAgeDays = null;
    if (txs.length > 0) {
      // find earliest tx (smallest blockTime)
      const times = txs
        .map((t) => (t.blockTime ? t.blockTime : null))
        .filter(Boolean);
      if (times.length > 0) {
        const earliest = Math.min(...times);
        walletAgeDays = daysOld(earliest);
      }
    }

    // find top tokens (by amount) — Helius tokens include amount + tokenSymbol if available
    const topTokens = tokens
      .slice(0, 10)
      .map((tk) => ({
        symbol: tk.symbol || tk.mint || "UNKNOWN",
        amount: tk.uiAmountString ?? tk.amount ?? null,
        mint: tk.mint,
      }));

    // scan transactions to count unique programs interacted with (simple signal)
    const programs = new Set();
    txs.forEach((t) => {
      if (Array.isArray(t.instructions)) {
        t.instructions.forEach((ins) => {
          if (ins.programId) programs.add(ins.programId);
          if (ins.program) programs.add(ins.program);
        });
      }
    });
    const programInteractions = programs.size;

    // recent txs summary (limit 5)
    const recentTxs = txs.slice(0, 5).map((t) => ({
      signature: t.signature,
      slot: t.slot,
      blockTime: t.blockTime || null,
      // provide a tiny description if Helius gives it
      description: t.type || t.description || null,
    }));

    // --- Scoring formula (weighted, tunable)
    // tx score (0-40)
    const txScore = Math.min(40, Math.floor(transactionCount / 3));
    // token diversity (0-20)
    const diversityScore = Math.min(20, tokenCount * 2);
    // age score (0-20)
    let ageScore = 0;
    if (walletAgeDays === null) ageScore = 0;
    else if (walletAgeDays >= 365) ageScore = 20;
    else ageScore = Math.floor((walletAgeDays / 365) * 20);
    // program interactions (0-20)
    const progScore = Math.min(20, programInteractions * 2);

    let score = txScore + diversityScore + ageScore + progScore;
    score = Math.max(0, Math.min(100, Math.round(score)));

    // risk flags (basic)
    const riskFlags = [];
    // example: if no txs and no tokens -> brand new
    if (transactionCount === 0 && tokenCount === 0) riskFlags.push("New/empty wallet");
    // suspicious quick patterns could be added later

    return {
      wallet: walletAddress,
      score,
      transactionCount,
      tokenCount,
      nftCount,
      walletAgeDays,
      programInteractions,
      topTokens,
      recentTxs,
      riskFlags,
    };
  } catch (err) {
    console.error("getWalletData error:", err?.response?.data || err.message || err);
    return { error: "Failed to fetch live wallet data." };
  }
}
