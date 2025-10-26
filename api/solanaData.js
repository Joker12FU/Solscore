// api/solanaData.js - fetches wallet data from Helius
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

async function getWalletData(walletAddress) {
  const apiKey = process.env.HELIUS_API_KEY;
  const url = `https://mainnet.helius-rpc.com/?api-key=${apiKey}`;

  const payload = {
    jsonrpc: "2.0",
    id: "solscore",
    method: "getSignaturesForAddress",
    params: [walletAddress, { limit: 50 }] // last 50 transactions
  };

  try {
    const response = await axios.post(url, payload, {
      headers: { "Content-Type": "application/json" }
    });

    const txs = response.data.result || [];
    const score = Math.min(txs.length * 5, 100); // simple scoring: 1 tx = 5 points, max 100

    return {
      wallet: walletAddress,
      transactionCount: txs.length,
      score
    };
  } catch (err) {
    console.error("Helius error:", err.message);
    throw new Error("Failed to fetch wallet data");
  }
}

module.exports = { getWalletData };
