const { getSocketInstance, socketUsers } = require("../../socket/socket.js");
const { tokenUpdate } = require("../tokens/index.token.update.js");

const { getMetatrader4MasterHistoryOrders,
  getMetatrader4OrderPair,
  runMetatrader4TradingFunction } = require("./metatrader4.master.trading.js");
const { getMetatrader5MasterHistoryOrders,
  getMetatrader5OrderPair,
  runMetatrader5TradingFunction } = require("./metatrader5.master.trading.js");

const { getMetatrader4CopiersPL } = require('../copiers/metatrader4.copier.trading');
const { getMetatrader5CopiersPL } = require('../copiers/metatrader5.copier.trading');

const startFunc = () => {
  const io = getSocketInstance();
  tokenUpdate(function () {
    getMetatrader5MasterHistoryOrders(function () {
      getMetatrader5OrderPair(function () {
        getMetatrader4MasterHistoryOrders(function () {
          getMetatrader4OrderPair(function () {
            setInterval(() => runMetatrader5TradingFunction(io, socketUsers), 5 * 1000);
            setInterval(getMetatrader5CopiersPL, 5 * 1000);
            setInterval(() => runMetatrader4TradingFunction(io, socketUsers), 5 * 1000);
            setInterval(getMetatrader4CopiersPL, 5 * 1000);
          });
        });
      });
    });
  })
}

module.exports = { startFunc }