const { updateMetatrader4Token } = require("./metatrader4.token.update");
const { updateMetatrader5Token } = require("./metatrader5.token.update");

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const tokenUpdate = async (callback) => {

  await updateMetatrader4Token();

  await updateMetatrader5Token();

  setInterval(updateMetatrader4Token, 1 * 60 * 60 * 1000);

  setInterval(updateMetatrader5Token, 1 * 60 * 60 * 1000);

  await delay(5000);
  callback();
}

module.exports = { tokenUpdate }