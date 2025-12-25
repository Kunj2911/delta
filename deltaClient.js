require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");

const BASE_URL = "https://api.india.delta.exchange";

/* ------------------------------------------------
   SIGNATURE HELPER (INDIA DELTA FORMAT)
------------------------------------------------ */
function createSignature({ method, path, queryString = "", payload = "" }) {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const signaturePayload =
    method + timestamp + path + queryString + payload;

  const signature = crypto
    .createHmac("sha256", process.env.DELTA_API_SECRET)
    .update(signaturePayload)
    .digest("hex");

  return { signature, timestamp };
}

/* ------------------------------------------------
   GENERIC REQUEST HANDLER
------------------------------------------------ */
async function deltaRequest({
  method,
  path,
  queryString = "",
  payload = ""
}) {
  // 🔑 RULE: GET must have NO payload
  const isGet = method === "GET";
  const finalPayload = isGet ? "" : payload;

  const { signature, timestamp } = createSignature({
    method,
    path,
    queryString,
    payload: finalPayload
  });

  const url = BASE_URL + path + queryString;

  const axiosConfig = {
    method,
    url,
    headers: {
      "api-key": process.env.DELTA_API_KEY,
      "timestamp": timestamp,
      "signature": signature,
      "Accept": "application/json"
    }
  };

  // ❌ DO NOT attach body or Content-Type for GET
  if (!isGet) {
    axiosConfig.headers["Content-Type"] = "application/json";
    axiosConfig.data = finalPayload;
    axiosConfig.transformRequest = [(d) => d];
  }

  const response = await axios(axiosConfig);
  return response.data;
}


/* ------------------------------------------------
   PLACE ORDER
------------------------------------------------ */
async function placeOrder(orderPayload) {
  const payload = JSON.stringify(orderPayload);

  return deltaRequest({
    method: "POST",
    path: "/v2/orders",
    payload
  });
}

/* ------------------------------------------------
   GET ALL PRODUCTS
------------------------------------------------ */
async function getProducts() {
  return deltaRequest({
    method: "GET",
    path: "/v2/products"
  });
}

/* ------------------------------------------------
   AUTH TEST (POSITIONS)
------------------------------------------------ */
async function authTest() {
  return deltaRequest({
    method: "GET",
    path: "/v2/positions",
    queryString: "?underlying_asset_symbol=BTC"
  });
}

/* ------------------------------------------------
   EXPORTS
------------------------------------------------ */
module.exports = {
  placeOrder,
  getProducts,
  authTest,
};
