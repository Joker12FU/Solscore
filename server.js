// server.js - CommonJS
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const { getWalletData } = require("./api/solanaData.js");

const app = express();
app.use(cors());
app.use(express.json());

// --- Simple route test ---
app.get("/", (req, res) => {
  res.send("SolScore backend is running 🚀");
});

// --- Route to fetch wallet score ---
app.post("/api/score", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: "Wallet address is required" });

    const walletInfo = await getWalletData(walletAddress);
    res.json(walletInfo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch wallet data" });
  }
});

// --- Route to compare two wallets ---
app.post("/api/compare", async (req, res) => {
  try {
    const { walletA, walletB } = req.body;
    if (!walletA || !walletB) return res.status(400).json({ error: "Both wallet addresses are required" });

    const [dataA, dataB] = await Promise.all([
      getWalletData(walletA),
      getWalletData(walletB)
    ]);

    let winner = "tie";
    if (dataA.score > dataB.score) winner = walletA;
    else if (dataB.score > dataA.score) winner = walletB;

    res.json({ walletA: dataA, walletB: dataB, winner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch wallet data for comparison" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
