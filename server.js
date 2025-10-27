// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getWalletData } from "./api/solanaData.js";

// ✅ Load environment variables
dotenv.config();

if (!process.env.HELIUS_API_KEY) {
  console.warn("⚠️  No Helius API key found! Make sure .env exists and has HELIUS_API_KEY=");
} else {
  console.log("✅ Helius API key loaded successfully.");
}

const app = express();
app.use(cors());
app.use(express.json());

// serve static frontend from /public
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// root -> index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API: single wallet
app.post("/api/score", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Wallet address required" });

    const data = await getWalletData(walletAddress);
    if (data?.error) return res.status(400).json({ error: data.error });

    res.json(data);
  } catch (err) {
    console.error("/api/score error:", err);
    res.status(500).json({ error: "Server failed to fetch wallet data" });
  }
});

// API: compare two wallets
app.post("/api/compare", async (req, res) => {
  try {
    const { walletA, walletB } = req.body;
    if (!walletA || !walletB)
      return res.status(400).json({ error: "Both wallet addresses are required" });

    const [aData, bData] = await Promise.all([
      getWalletData(walletA),
      getWalletData(walletB),
    ]);

    if (aData?.error) return res.status(400).json({ error: `Wallet A: ${aData.error}` });
    if (bData?.error) return res.status(400).json({ error: `Wallet B: ${bData.error}` });

    let winner = "Draw";
    if (aData.score > bData.score) winner = "Wallet A";
    else if (bData.score > aData.score) winner = "Wallet B";

    res.json({ walletA: aData, walletB: bData, winner });
  } catch (err) {
    console.error("/api/compare error:", err);
    res.status(500).json({ error: "Server failed to compare wallets" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
