const axios = require('axios');

const METATRADER5_BASIC_URL = "https://metatrader5-apis.ngrok.app/";

const metatrader5Axios = axios.create({
  baseURL: METATRADER5_BASIC_URL
});

module.exports = { metatrader5Axios };