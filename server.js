require("dotenv").config();
const express = require("express");
const { placeOrder } = require("./deltaClient");
const connectDB = require("./db");

const app = express();
app.use(express.json());

/* ---------------------------------
   IN-MEMORY POSITION STATE
   (move to DB later)
---------------------------------- */
let currentPosition = {
  side: null,       // "buy" | "sell" | null
  size: null,
  entryPrice: null
};

let isProcessing = false;

connectDB();

app.get("/", async (req, res) => {
  return res.status(200).json({
    success: "Server is running"
  });
});

/* ---------------------------------
   WEBHOOK ENDPOINT
---------------------------------- */
app.post("/webhook", async (req, res) => {
  if (isProcessing) {
    return res.status(429).json({
      error: "Order already processing"
    });
  }

  try {
    isProcessing = true;

    const { symbol, side, size, entryPrice } = req.body;

    if (!symbol || !side || !entryPrice) {
      return res.status(400).json({
        error: "symbol, side, entryPrice are required"
      });
    }

    const signalSide = side.toLowerCase();
    if (!["buy", "sell"].includes(signalSide)) {
      return res.status(400).json({ error: "Invalid side" });
    }

    const orderSize = Number(size || 1);

    /* -------- SL / TP CONFIG -------- */
    const SL_PERCENT = 0.01; // 1%
    const TP_PERCENT = 0.02; // 2%

    /* ---------------------------------
       SAME SIDE → IGNORE
    ---------------------------------- */
    if (currentPosition.side === signalSide) {
      return res.json({
        status: "IGNORED",
        reason: "Same direction already open"
      });
    }

    /* ---------------------------------
       CLOSE EXISTING POSITION
    ---------------------------------- */
    if (currentPosition.side) {
      const closeSide =
        currentPosition.side === "buy" ? "sell" : "buy";

      console.log("🔁 CLOSING POSITION:", currentPosition.side);

      await placeOrder({
        product_symbol: symbol,
        side: closeSide,
        order_type: "market_order",
        size: currentPosition.size,
        reduce_only: true
      });

      currentPosition = {
        side: null,
        size: null,
        entryPrice: null
      };
    }

    /* ---------------------------------
       OPEN NEW POSITION
    ---------------------------------- */
    let sl, tp;

    if (signalSide === "buy") {
      sl = entryPrice * (1 - SL_PERCENT);
      tp = entryPrice * (1 + TP_PERCENT);
    } else {
      sl = entryPrice * (1 + SL_PERCENT);
      tp = entryPrice * (1 - TP_PERCENT);
    }
 
    const openPayload = {
      product_symbol: symbol,
      side: signalSide,
      order_type: "market_order",
      size: orderSize,
      bracket_stop_loss_price: sl.toFixed(2),
      bracket_take_profit_price: tp.toFixed(2),
      bracket_stop_trigger_method: "mark_price"
    };

    console.log("📩 OPEN ORDER:", openPayload);

    const btcPrice = await placeOrder(openPayload);
    console.log(btcPrice);

    currentPosition = {
      side: signalSide,
      size: orderSize,
      entryPrice
    };

    return res.json({
      status: currentPosition.side ? "FLIPPED" : "OPENED",
      side: signalSide,
      stopLoss: sl.toFixed(2),
      takeProfit: tp.toFixed(2)
    });

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  } finally {
    isProcessing = false;
  }
});

/* ---------------------------------
   SERVER START
---------------------------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
