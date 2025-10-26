import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getWalletData } from "./api/solanaData.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Setup for serving frontend ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve all files in "public" folder (put your index.html, style.css, script.js there)
app.use(express.static(path.join(__dirname, "public")));

// Redirect root "/" to index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Route to fetch wallet score ---
app.post("/api/score", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

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
    const { wallet1, wallet2 } = req.body;
    if (!wallet1 || !wallet2) {
      return res.status(400).json({ error: "Both wallet addresses are required" });
    }

    const data1 = await getWalletData(wallet1);
    const data2 = await getWalletData(wallet2);

    // Determine winner based on score
    let winner = "Tie";
    if (data1.score > data2.score) winner = wallet1;
    else if (data2.score > data1.score) winner = wallet2;

    res.json({ wallet1: data1, wallet2: data2, winner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to compare wallets" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
