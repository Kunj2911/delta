require("dotenv").config();
const express = require("express");
const {
  placeOrder,
  getIndexPriceBySymbol
} = require("./deltaClient");

const app = express();
app.use(express.json());

app.post("/webhook", async (req, res) => {
  try {
    const { symbol, side, size,entryPrice } = req.body;

    if (!symbol || !side) {
      return res.status(400).json({
        error: "symbol and side are required"
      });
    }

    const orderSide = side.toLowerCase();
    const orderSize = Number(size || 1);


    // % CONFIG
    const SL_PERCENT = 0.01;   // 1%
    const TP_PERCENT = 0.02;   // 2%

    let sl, tp;

    if (orderSide === "buy") {
      sl = entryPrice * (1 - SL_PERCENT);
      tp = entryPrice * (1 + TP_PERCENT);
    } else if (orderSide === "sell") {
      sl = entryPrice * (1 + SL_PERCENT);
      tp = entryPrice * (1 - TP_PERCENT);
    } else {
      return res.status(400).json({ error: "Invalid side" });
    }

    const orderPayload = {
      product_symbol: symbol,
      side: orderSide,
      order_type: "market_order",
      size: orderSize,
      bracket_stop_loss_price: sl.toFixed(2),
      bracket_take_profit_price: tp.toFixed(2),
      bracket_stop_trigger_method: "mark_price"
    };

    console.log("📩 ORDER PAYLOAD:", orderPayload);

    // 🔒 Uncomment when ready for LIVE orders
    
    // const result = await placeOrder(orderPayload);

    return res.json({
      success: true,
      entryPrice,
      stopLoss: sl.toFixed(2),
      takeProfit: tp.toFixed(2),
      orderPayload
    });

  } catch (err) {
    console.error("❌ ERROR:", err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
