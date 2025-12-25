require("dotenv").config();
const { authTest } = require("./deltaClient");

authTest()
  .then(res => {
    console.log("✅ AUTH SUCCESS");
    console.log(res);
  })
  .catch(err => {
    console.error("❌ AUTH FAILED");
    console.error(err.response?.data || err.message);
  });
