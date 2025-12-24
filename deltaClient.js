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
  const { signature, timestamp } = createSignature({
    method,
    path,
    queryString,
    payload
  });

  const url = BASE_URL + path + queryString;

  const response = await axios({
    method,
    url,
    headers: {
      "api-key": process.env.DELTA_API_KEY,
      "timestamp": timestamp,
      "signature": signature,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    data: payload || undefined,
    transformRequest: [(d) => d], // 🚫 prevent axios mutation
    maxBodyLength: Infinity
  });

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
async function authTest(productId = 1) {
  return deltaRequest({
    method: "GET",
    path: "/v2/positions",
    queryString: `?product_id=${productId}`
  });
}


/*----------------------------------------------
--------------------------------------------- */



/* ------------------------------------------------
   EXPORTS
------------------------------------------------ */
module.exports = {
  placeOrder,
  getProducts,
  authTest,
};
