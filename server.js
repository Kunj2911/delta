require("dotenv").config();
const express = require("express");
const { placeOrder, authTest } = require("./deltaClient");

const app = express();
app.use(express.json());

/* ---------------------------------
   BOT STATE
---------------------------------- */
let isProcessing = false;

/* ---------------------------------
   CONFIG
---------------------------------- */
const SYMBOL = "BTCUSD";

/* ---------------------------------
   HEALTH CHECK
---------------------------------- */
app.get("/", (req, res) => {
  res.json({ success: true, message: "Delta flip bot running" });
});

/* ---------------------------------
   WEBHOOK (TradingView)
---------------------------------- */
app.post("/webhook", async (req, res) => {
  if (isProcessing) {
    return res.status(429).json({ error: "Already processing" });
  }

  try {
    isProcessing = true;

    const { side, size } = req.body;
    const signalSide = side?.toLowerCase();
    const orderSize = Number(size || 1);

    if (!["buy", "sell"].includes(signalSide)) {
      return res.status(400).json({ error: "Invalid side" });
    }

    /* ---------------------------------
       CHECK LIVE POSITION
    ---------------------------------- */
    const posRes = await authTest();

    if (posRes.result.length > 0) {
      const pos = posRes.result[0];
      const liveSide = pos.size > 0 ? "buy" : "sell";
      const liveSize = Math.abs(pos.size);

      // SAME SIDE → IGNORE
      if (liveSide === signalSide) {
        return res.json({
          status: "IGNORED",
          reason: "Same direction already open"
        });
      }

      // OPPOSITE SIDE → CLOSE POSITION
      console.log("🔁 Closing position:", liveSide);

      await placeOrder({
        product_symbol: SYMBOL,
        side: liveSide === "buy" ? "sell" : "buy",
        order_type: "market_order",
        size: liveSize,
        reduce_only: true
      });
    }

    /* ---------------------------------
       OPEN NEW POSITION
    ---------------------------------- */
    console.log("📩 Opening:", signalSide);

    await placeOrder({
      product_symbol: SYMBOL,
      side: signalSide,
      order_type: "market_order",
      size: orderSize
    });

    return res.json({
      success: true,
      status: "FLIPPED",
      side: signalSide,
      size: orderSize
    });

  } catch (err) {
    console.error("❌ ERROR:", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  } finally {
    isProcessing = false;
  }
});

/* ---------------------------------
   START SERVER
---------------------------------- */
app.listen(4000, () => {
  console.log("🚀 Delta Flip Bot LIVE on port 4000");
});
