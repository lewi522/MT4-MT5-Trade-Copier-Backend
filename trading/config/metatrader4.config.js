const axios = require('axios');

const METATRADER4_BASIC_URL = "https://metatrader4-apis.ngrok.app/";

const metatrader4Axios = axios.create({
  baseURL: METATRADER4_BASIC_URL
});

module.exports = { metatrader4Axios };