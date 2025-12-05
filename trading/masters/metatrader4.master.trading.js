const client = require("../../config/db/db.js");
const { v5: uuidv5 } = require('uuid');
const { metatrader4Axios } = require("../config/metatrader4.config.js");
const { metatrader5Axios } = require("../config/metatrader5.config.js");
const moment = require("moment");

const MY_NAMESPACE = uuidv5("https://dash.ticksync.io/", uuidv5.DNS);

//This function is to initialize the previous positions (history_positions) of metatrader_masters in database before start trading

const getMetatrader4MasterHistoryOrders = async (callback) => {
  console.log("getMetatrader4MasterHistoryOrders ---------> Start", performance.now());
  const masterData = await client.query(
    `SELECT * FROM accounts
    WHERE role = $1
    AND type = $2`,
    [
      "master",
      "mt4"
    ]
  );
  const getMasterHistoryP = masterData.rows?.map(async (master) => {
    await metatrader4Axios.get('/OpenedOrders', {
      params: {
        id: master.token
      }
    }).then(async (res) => {
      if (res.status !== 200) {
        console.log("getMetatrader4MasterHistoryOrders -------------> get Opened Orders Request Error", res.data);
        return;
      }

      await client.query(
        `UPDATE accounts 
            SET history_orders = $1
            WHERE id = '${master.id}'`,
        [
          res.data,
        ]
      );
      console.log("getMetatrader4MasterHistoryOrders ------------> get Opened Orders Success", performance.now());
    }).catch((err) => {
      console.log("getMetatrader4MasterHistoryOrders -------------> get Opened Orders Error", err);
    })
  })
  await Promise.all(getMasterHistoryP);
  callback();
}

//This function is to initialize the order_pair of copiers in database before start trading

const getMetatrader4OrderPair = async (callback) => {
  console.log("getMetatrader4OrderPair --------> Start get Order Pair", performance.now());
  const contractData = await client.query(
    `SELECT id,
      order_pair, 
      copier_acc_id,
      copier_acc_type, 
      master_acc_id, 
      master_acc_type
      FROM contract
      WHERE copier_acc_type = $1`,
    [
      "mt4"
    ]
  );
  for (let i = 0; i < contractData.rowCount; i++) {
    const contract = contractData.rows[i];
    const copier = await client.query(
      `SELECT token
      FROM accounts
      WHERE account_id = $1
      AND type = $2
      AND role = $3`,
      [
        contract.copier_acc_id,
        contract.copier_acc_type,
        "copier"
      ]
    );
    if (contract.master_acc_type === 'mt4') {
      const master = await client.query(
        `SELECT token 
          FROM accounts 
          WHERE account_id = $1
          AND type = $2
          AND role = $3`,
        [
          contract.master_acc_id,
          contract.master_acc_type,
          "master"
        ]
      );
      if (master.rowCount === 0) {
        console.log("getMetatrader4OrderPair ---------> Get Master Data from MT4 database Error!");
        return;
      }
      await metatrader4Axios.get(`/OpenedOrders`, {
        params: {
          id: copier.rows[0].token
        }
      }).then(async (response) => {
        if (response.status !== 200) {
          console.log("getMetatrader4OrderPair ------> Get Copier Opened Orders Request Error!");
          return;
        }
        await metatrader4Axios.get(`/OpenedOrders`, {
          params: {
            id: master.rows[0].token
          }
        }).then(async (master_response) => {
          if (master_response.status !== 200) {
            console.log("getMetatrader4OrderPair ------> Get Master Opened Orders Request Error!");
            return;
          }

          await contract.order_pair?.map(async (pair) => {
            const exist_copier_order = await response.data?.find(item => item.ticket === pair.copier_order_id);
            const exist_master_order = await master_response.data?.find(item => item.ticket === pair.master_order_id);
            if (!exist_copier_order || !exist_master_order) {
              await client.query(
                `UPDATE contract 
                  SET order_pair = array_remove(order_pair, $1) 
                  WHERE id = '${contract.id}'`,
                [
                  pair
                ]
              )
            }
          });
          console.log("Get Metatrader4 Order Pair success", performance.now());
        })
      }).catch(() => {
        console.log("!!!!!!!!!!Get Metatrader4 Opened Order Error.");
      })
    }
    if (contract.master_acc_type === 'mt5') {
      const master = await client.query(
        `SELECT token 
          FROM accounts
          WHERE account_id = $1
          AND type = $2
          AND role = $3`,
        [
          contract.master_acc_id,
          contract.master_acc_type,
          "master"
        ]
      );
      if (master.rowCount === 0) {
        console.log("getMetatrader4OrderPair ---------> Get Master Data from mt5 database Error!");
        return;
      }
      await metatrader4Axios.get(`/OpenedOrders`, {
        params: {
          id: copier.rows[0].token
        }
      }).then(async (response) => {
        if (response.status !== 200) {
          console.log("getMetatrader4OrderPair ------> Get Copier Opened Orders Request Error!");
        }
        await metatrader5Axios.get(`/OpenedOrders`, {
          params: {
            id: master.rows[0].token
          }
        }).then(async (master_response) => {
          if (master_response.status !== 200) {
            console.log("getMetatrader4OrderPair ------> Get Master Opened Orders Request Error!");
            return;
          }

          await contract.order_pair?.map(async (pair) => {
            const exist_copier_order = await response.data.find(item => item.ticket === pair.copier_order_id);
            const exist_master_order = await master_response.data.find(item => item.ticket === pair.master_order_id);
            if (!exist_copier_order || !exist_master_order) {
              await client.query(
                `UPDATE accounts 
                  SET order_pair = array_remove(order_pair, $1) 
                  WHERE id = '${contract.id}'`,
                [
                  pair
                ]
              )
            }
          });
          console.log("Get Metatrader4 Order Pair success", performance.now());
        })
      }).catch(() => {
        console.log("!!!!!!!!!!Get Metatrader4 Opened Order Error.");
      })
    }
  }
  callback();
}

let indexNum = 0;
//This function is the main function that trade by interval
//First, get all masters data from masters table of database and get all copiers corresponding to each master from tData table of database

//this function is to get random number for takeProfit and stopLoss
// function getRandomNumber(min, max, criteria) {
//   console.log(max - min, criteria);
//   return (max - min) > criteria ? Math.floor(Math.random() * criteria * 1000) / 1000 : Math.floor(Math.random() * (max - min) * 1000) / 1000 + min;
// }

/* functions being used when trading */

//this function is for risk setting when order position

const risk_setting_func = (master_account_balance, contract, copier_account_balance, opened_order, pip_value) => {
  const risk_type = contract.risk_type;
  const follow_tp_st = contract.follow_tp_st;
  const force_min_max = contract.force_min_max;
  const risk_setting = contract.risk_setting;
  const fixed_master_acc_balance = contract.fixed_master_acc_balance;
  let volume = opened_order.lots;
  switch (risk_type) {
    case 'fixed_lot':
      volume = risk_setting;
      break;
    case 'balance_multiplier':
      volume = Math.round(((copier_account_balance * 100) / (master_account_balance * 100)) * opened_order.lots * risk_setting) / 100;
      // volume = opened_order.lots;
      break;
    case 'lot_multiplier':
      volume = risk_setting === 100 ? opened_order.lots : Math.round(opened_order.lots * risk_setting) / 100;
      break;
    case 'fixed_balance_multiplier':
      volume = Math.round((copier_account_balance * 100) / (fixed_master_acc_balance * 100) * opened_order.lots * risk_setting) / 100;
      break;
  }
  if (force_min_max?.lot_refine) volume = volume + parseFloat(force_min_max?.lot_refine_size);
  if (force_min_max?.force_max && force_min_max?.force_max_value < volume) volume = parseFloat(force_min_max?.force_max_value);
  if (force_min_max?.force_min && force_min_max?.force_min_value > volume) volume = parseFloat(force_min_max?.force_min_value);
  let stopLoss = 0;
  let takeProfit = 0;
  if (volume === 0) return { volume, stopLoss, takeProfit };
  if (follow_tp_st?.stop_loss) {
    if (follow_tp_st?.fixed_stop_loss) {
      if (opened_order.type === 'Sell') stopLoss = opened_order.closePrice + parseFloat(follow_tp_st?.fixed_stop_loss_size) * pip_value;
      else stopLoss = opened_order.closePrice - parseFloat(follow_tp_st?.fixed_stop_loss_size) * pip_value;
    }
    else {
      stopLoss = opened_order.stopLoss > 0 ? (follow_tp_st?.stop_loss_refinement ? (opened_order.stopLoss + parseFloat(follow_tp_st?.stop_loss_refinement_size) * pip_value) : opened_order.stopLoss) : 0;
      // if (risk_type !== "balance_multiplier") stopLoss = opened_order.stopLoss > 0 ? (follow_tp_st?.stop_loss_refinement ? (opened_order.stopLoss + parseFloat(follow_tp_st?.stop_loss_refinement_size) * pip_value) : opened_order.stopLoss) : 0;
      // else {
      //   if (opened_order.type === 'Sell') {
      //     const diff = opened_order.stopLoss - opened_order.closePrice;
      //     const master_risk = master_account_balance !== 0 ? (diff / master_account_balance) : 0;
      //     const copier_risk = master_risk * risk_setting / 100;
      //     const copier_diff = copier_risk * copier_account_balance;
      //     const temp_stop_loss = opened_order.closePrice + copier_diff;
      //     stopLoss = opened_order.stopLoss > 0 ? (follow_tp_st?.stop_loss_refinement ?
      //       (temp_stop_loss + parseFloat(follow_tp_st?.stop_loss_refinement_size) * pip_value) : temp_stop_loss) : 0;
      //   }
      //   else {
      //     const diff = opened_order.closePrice - opened_order.stopLoss;
      //     const master_risk = master_account_balance !== 0 ? (diff / master_account_balance) : 0;
      //     const copier_risk = master_risk * risk_setting / 100;
      //     const copier_diff = copier_risk * copier_account_balance;
      //     const temp_stop_loss = opened_order.closePrice - copier_diff;
      //     stopLoss = opened_order.stopLoss > 0 ? (follow_tp_st?.stop_loss_refinement ?
      //       (temp_stop_loss + parseFloat(follow_tp_st?.stop_loss_refinement_size) * pip_value) : temp_stop_loss) : 0;
      //   }
      // }
    }
  }
  if (follow_tp_st?.take_profit) {
    if (follow_tp_st?.fixed_take_profit) {
      if (opened_order.type === 'Sell') takeProfit = opened_order.openPrice - parseFloat(follow_tp_st?.fixed_take_profit_size) * pip_value;
      else takeProfit = opened_order.openPrice + parseFloat(follow_tp_st?.fixed_take_profit_size) * pip_value;
    }
    else {
      takeProfit = opened_order.takeProfit > 0 ? (follow_tp_st?.take_profit_refinement ? (opened_order.takeProfit + parseFloat(follow_tp_st?.take_profit_refinement_size) * pip_value) : opened_order.takeProfit) : 0;
      // if (risk_type !== "balance_multiplier") takeProfit = opened_order.takeProfit > 0 ? (follow_tp_st?.take_profit_refinement ? (opened_order.takeProfit + parseFloat(follow_tp_st?.take_profit_refinement_size) * pip_value) : opened_order.takeProfit) : 0;
      // else {
      //   if (opened_order.type === 'Sell') {
      //     const diff = opened_order.openPrice - opened_order.takeProfit;
      //     const master_risk = master_account_balance !== 0 ? (diff / master_account_balance) : 0;
      //     const copier_risk = master_risk * risk_setting / 100;
      //     const copier_diff = copier_risk * copier_account_balance;
      //     const temp_take_profit = opened_order.openPrice - copier_diff;
      //     takeProfit = opened_order.takeProfit > 0 ? (follow_tp_st?.take_profit_refinement ?
      //       (temp_take_profit + parseFloat(follow_tp_st?.take_profit_refinement_size) * pip_value) : temp_take_profit) : 0;
      //   }
      //   else {
      //     const diff = opened_order.takeProfit - opened_order.openPrice;
      //     const master_risk = master_account_balance !== 0 ? (diff / master_account_balance) : 0;
      //     const copier_risk = master_risk * risk_setting / 100;
      //     const copier_diff = copier_risk * copier_account_balance;
      //     const temp_take_profit = opened_order.openPrice + copier_diff;
      //     takeProfit = opened_order.takeProfit > 0 ? (follow_tp_st?.take_profit_refinement ?
      //       (temp_take_profit + parseFloat(follow_tp_st?.take_profit_refinement_size) * pip_value) : temp_take_profit) : 0;
      //   }
      // }
    }
  }
  return { volume, stopLoss, takeProfit };
}

const calc_tp_st = (master_account_balance, contract, copier_account_balance, follow_tp_st, exist_order, pip_value) => {
  const risk_type = contract.risk_type;
  const risk_setting = contract.risk_setting;
  let stopLoss = 0;
  let takeProfit = 0;
  if (follow_tp_st?.stop_loss) {
    if (follow_tp_st?.fixed_stop_loss) {
      if (exist_order.type === 'Sell') stopLoss = exist_order.closePrice + parseFloat(follow_tp_st?.fixed_stop_loss_size) * pip_value;
      else stopLoss = exist_order.closePrice - parseFloat(follow_tp_st?.fixed_stop_loss_size) * pip_value;
    }
    else {
      stopLoss = exist_order.stopLoss > 0 ? (follow_tp_st?.stop_loss_refinement ? (exist_order.stopLoss + parseFloat(follow_tp_st?.stop_loss_refinement_size) * pip_value) : exist_order.stopLoss) : 0;
      // if (risk_type !== "balance_multiplier") stopLoss = exist_order.stopLoss > 0 ? (follow_tp_st?.stop_loss_refinement ? (exist_order.stopLoss + parseFloat(follow_tp_st?.stop_loss_refinement_size) * pip_value) : exist_order.stopLoss) : 0;
      // else {
      //   if (exist_order.type === 'Sell') {
      //     const diff = exist_order.stopLoss - exist_order.closePrice;
      //     const master_risk = master_account_balance !== 0 ? (diff / master_account_balance) : 0;
      //     const copier_risk = master_risk * risk_setting / 100;
      //     const copier_diff = copier_risk * copier_account_balance;
      //     const temp_stop_loss = exist_order.closePrice + copier_diff;
      //     stopLoss = exist_order.stopLoss > 0 ? (follow_tp_st?.stop_loss_refinement ?
      //       (temp_stop_loss + parseFloat(follow_tp_st?.stop_loss_refinement_size) * pip_value) : temp_stop_loss) : 0;
      //   }
      //   else {
      //     const diff = exist_order.closePrice - exist_order.stopLoss;
      //     const master_risk = master_account_balance !== 0 ? (diff / master_account_balance) : 0;
      //     const copier_risk = master_risk * risk_setting / 100;
      //     const copier_diff = copier_risk * copier_account_balance;
      //     const temp_stop_loss = exist_order.closePrice - copier_diff;
      //     stopLoss = exist_order.stopLoss > 0 ? (follow_tp_st?.stop_loss_refinement ?
      //       (temp_stop_loss + parseFloat(follow_tp_st?.stop_loss_refinement_size) * pip_value) : temp_stop_loss) : 0;
      //   }
      // }
    }
  };
  if (follow_tp_st?.take_profit) {
    if (follow_tp_st?.fixed_take_profit) {
      if (exist_order.type === 'Sell') takeProfit = exist_order.openPrice - parseFloat(follow_tp_st?.fixed_take_profit_size) * pip_value;
      else takeProfit = exist_order.openPrice + parseFloat(follow_tp_st?.fixed_take_profit_size) * pip_value;
    }
    else {
      takeProfit = exist_order.takeProfit > 0 ? (follow_tp_st?.take_profit_refinement ? (exist_order.takeProfit + parseFloat(follow_tp_st?.take_profit_refinement_size) * pip_value) : exist_order.takeProfit) : 0;
      // if (risk_type !== "balance_multiplier") takeProfit = exist_order.takeProfit > 0 ? (follow_tp_st?.take_profit_refinement ? (exist_order.takeProfit + parseFloat(follow_tp_st?.take_profit_refinement_size) * pip_value) : exist_order.takeProfit) : 0;
      // else {
      //   if (exist_order.type === 'Sell') {
      //     const diff = exist_order.openPrice - exist_order.takeProfit;
      //     const master_risk = master_account_balance !== 0 ? (diff / master_account_balance) : 0;
      //     const copier_risk = master_risk * risk_setting / 100;
      //     const copier_diff = copier_risk * copier_account_balance;
      //     const temp_take_profit = exist_order.openPrice - copier_diff;
      //     takeProfit = exist_order.takeProfit > 0 ? (follow_tp_st?.take_profit_refinement ?
      //       (temp_take_profit + parseFloat(follow_tp_st?.take_profit_refinement_size) * pip_value) : temp_take_profit) : 0;
      //   }
      //   else {
      //     const diff = exist_order.takeProfit - exist_order.openPrice;
      //     const master_risk = master_account_balance !== 0 ? (diff / master_account_balance) : 0;
      //     const copier_risk = master_risk * risk_setting / 100;
      //     const copier_diff = copier_risk * copier_account_balance;
      //     const temp_take_profit = exist_order.openPrice + copier_diff;
      //     takeProfit = exist_order.takeProfit > 0 ? (follow_tp_st?.take_profit_refinement ?
      //       (temp_take_profit + parseFloat(follow_tp_st?.take_profit_refinement_size) * pip_value) : temp_take_profit) : 0;
      //   }
      // }
    }
  };
  return { stopLoss, takeProfit };
}

const calc_volume = (fixed_master_acc_balance, master_account_balance, copier_account_balance, copier_lot_size, risk_type, risk_setting, history_order_lot, exist_order_lot) => {
  console.log("risk_type", risk_type, "risk_setting", risk_setting, "history_order_lot", history_order_lot, "exist_order_lot", exist_order_lot);
  let volume = 0;
  switch (risk_type) {
    case 'fixed_lot':
      volume = Math.round(copier_lot_size * exist_order_lot / history_order_lot * 100) / 100;
      break;
    case 'balance_multiplier':
      volume = Math.round((risk_setting * (copier_account_balance * 100) / (master_account_balance * 100)) * exist_order_lot) / 100;
      // volume = exist_order_lot;
      break;
    case 'lot_multiplier':
      volume = risk_setting === 100 ? exist_order_lot : Math.round(exist_order_lot * risk_setting) / 100;
      break;
    case 'fixed_balance_multiplier':
      volume = Math.round(copier_account_balance / fixed_master_acc_balance * risk_setting * exist_order_lot) / 100;
      break;
  }
  return volume;
}

const runMetatrader4TradingFunction = async (io, socketUsers) => {
  indexNum++;
  //get all masters data
  const masterData = await client.query(
    `SELECT * FROM accounts 
    WHERE role = $1
    AND type = $2`,
    [
      "master",
      "mt4"
    ]
  );

  //for each master
  const promises = masterData.rows.map(async (master) => {
    const contractData = await client.query(
      `SELECT * FROM contract 
        WHERE master_acc_id = $1 
        AND master_acc_type = $2`,
      [
        master.account_id,
        master.type
      ]
    );
    await metatrader4Axios.get('/CheckConnect', {
      params: {
        id: master.token
      }
    }).then(async (isConnected) => {
      if (isConnected.status !== 200) {
        console.log("metatrader4-master ----------> connection to server error");
        return;
      }
      await metatrader4Axios.get('/AccountSummary', {
        params: {
          id: master.token
        }
      }).then(async (summary) => {
        if (summary.status !== 200) {
          console.log("metatrader4-master ----------> get Account Summary Request Error");
          return;
        }
        await client.query(
          `UPDATE accounts 
            SET account_balance = $1,
            account_profit = $2,
            account_margin = $3,
            prev_account_margin = account_margin
            WHERE id = '${master.id}'`,
          [
            summary.data.balance,
            summary.data.profit,
            summary.data.margin
          ]
        );
      }).catch(() => {
        console.log("metatrader4-master ----------> get Account Summary Time out error");
      });
      if (master.follows === 0) return;
      await metatrader4Axios.get('/OpenedOrders', {
        params: {
          id: master.token
        }
      }).then(async (response) => {
        if (response.status !== 200) {
          console.log("metatrader4-master ----------> get Opened Orders Error!");
          return;
        }

        const master_opened_orders = response.data;
        const history_orders = master.history_orders;

        //this is the main part that can add, modify or remove orders
        const add_remove_requests = async (callback) => {
          //remove or modify part
          history_orders?.map(async (history_order) => {
            const exist_order = master_opened_orders.find(item => item.ticket === history_order.ticket);
            if (
              exist_order &&
              exist_order.takeProfit === history_order.takeProfit &&
              exist_order.stopLoss === history_order.stopLoss &&
              exist_order.lots === history_order.lots
            ) return;

            const master_database_set = async (isExist, exist_order_lot) => {
              const myDate = new Date();
              const formattedDate = myDate.toISOString();
              const pair_data = await client.query(
                `SELECT account_balance, 
                  total_pl_amount, 
                  win_count, 
                  lose_count,
                  prev_account_margin
                  FROM accounts 
                  WHERE id = '${master.id}'`
              );
              const pl = history_order.profit;
              const account_balance = pair_data.rows[0].account_balance;
              const lot_size = isExist ? history_order.lots - exist_order_lot : history_order.lots;
              const real_pl = isExist ? (lot_size * 100) / (history_order.lots * 100) * pl : pl;
              const margin = pair_data.rows[0].prev_account_margin;
              const total_pl = pair_data.rows[0].total_pl_amount + real_pl;
              const cur_pl = {
                balance: account_balance,
                margin: margin,
                pl: real_pl,
                date: formattedDate
              }
              await client.query(
                `UPDATE accounts
                  SET con_pl = array_append(con_pl, $1),                  
                  total_pl_amount = $2,
                  win_count = $3,
                  lose_count = $4
                  WHERE id = '${master.id}'`,
                [
                  cur_pl,
                  total_pl,
                  real_pl >= 0 ? parseInt(pair_data.rows[0].win_count) + 1 : parseInt(pair_data.rows[0].win_count),
                  real_pl < 0 ? parseInt(pair_data.rows[0].lose_count) + 1 : parseInt(pair_data.rows[0].lose_count)
                ]
              )
            }

            const order_remove = async () => {
              contractData.rows.map(async (contract) => {
                const copier_acc_id = contract.copier_acc_id;
                const copier_acc_type = contract.copier_acc_type;
                if (copier_acc_type === "mt4") {
                  const mt4_copier_account = await client.query(
                    `SELECT * FROM accounts 
                      WHERE account_id = $1
                      AND type = $2
                      AND role = $3`,
                    [
                      copier_acc_id,
                      copier_acc_type,
                      "copier"
                    ]
                  );
                  if (mt4_copier_account.rowCount === 0) return;
                  const order_pairs = contract.order_pair;
                  const pair = order_pairs?.find(item => item.master_order_id === history_order.ticket);
                  if (exist_order && (exist_order.takeProfit !== history_order.takeProfit || exist_order.stopLoss !== history_order.stopLoss)) {
                    if (!contract.status || !pair) return;
                    await metatrader4Axios.get(`/SymbolParams`, {
                      params: {
                        id: mt4_copier_account.rows[0].token,
                        symbol: exist_order.symbol
                      }
                    }).then(async (info) => {
                      if (info.statusText === "OK") {
                        const { stopLoss, takeProfit } = calc_tp_st(master.account_balance, contract, mt4_copier_account.rows[0].account_balance, contract.follow_tp_st, exist_order, info.data.symbol.point);

                        await metatrader4Axios.get('/OrderModify', {
                          params: {
                            id: mt4_copier_account.rows[0].token,
                            ticket: pair.copier_order_id,
                            stoploss: stopLoss,
                            takeprofit: takeProfit,
                          }
                        }).then(async (modify_response) => {
                          if (modify_response.status === 200) {
                            console.log("metatrader4-master ----------> metatrader4 modify success", performance.now());
                            const user = await client.query(
                              `SELECT notification_setting
                              FROM users
                              WHERE id = $1`,
                              [
                                mt4_copier_account.rows[0].user_id
                              ]
                            );
                            if (user.rowCount > 0 && user.rows[0].notification_setting?.modify_trade) {
                              const myDate = new Date();
                              const formattedDate = myDate.toISOString();
                              const my_secret_name = JSON.stringify({
                                time: moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                                type: "modify_trade",
                                user_id: mt4_copier_account.rows[0].user_id,
                                account_id: mt4_copier_account.rows[0].account_id
                              });
                              const uniqueId = uuidv5(my_secret_name, MY_NAMESPACE);
                              const messages = await client.query(
                                `INSERT INTO notifications
                                  (id, receiver_id, message, read, time, type)
                                  VALUES ($1, $2, $3, $4, $5, $6)
                                  RETURNING *`,
                                [
                                  uniqueId,
                                  mt4_copier_account.rows[0].user_id,
                                  "MT4 account " + mt4_copier_account.rows[0].account_id + " modified stop loss or take profit of order " + pair.copier_order_id + " at " + moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                                  false,
                                  formattedDate,
                                  "modify_trade"
                                ]
                              );
                              if (socketUsers[mt4_copier_account.rows[0].user_id]) {
                                io.to(mt4_copier_account.rows[0].user_id).emit('notification', messages.rowCount > 0 ? messages.rows[0] : {});
                              }
                            }
                          }
                        }).catch(() => {
                          console.log("metatrader4-master ----------> metatrader4 modify error");
                        })
                      }
                    })
                  }
                  if (!exist_order) {
                    const master_orders_history = await metatrader4Axios.get(`/OrderHistory`, {
                      params: {
                        id: master.token,
                        from: new Date(new Date(history_order.openTime) - 5000000)
                      }
                    });
                    let real_lot_size;
                    let volume = -1;
                    let one_exist_order;
                    if (master_orders_history.status === 200) {
                      const master_orders_history_data = master_orders_history.data;
                      one_exist_order = master_orders_history_data.reverse().find(item => item.openTime === history_order.openTime);
                      if (one_exist_order.lots === history_order.lots) {
                        real_lot_size = 0;
                        master_database_set(false, one_exist_order.lots);
                        if (!contract.status && pair) {
                          await client.query(
                            `UPDATE contract
                              SET order_pair = array_remove(order_pair, $1)
                              WHERE id = '${contract.id}'`,
                            [
                              pair
                            ]
                          );
                        }
                      }
                      else {
                        if (!pair) return;
                        master_database_set(true, one_exist_order.lots);
                        const copier_order = mt4_copier_account.rows[0].history_orders?.find(item => item.ticket === pair.copier_order_id);
                        const fixed_master_acc_balance = contract.risk_type === "fixed_balance_multiplier" ? contract.fixed_master_acc_balance : master.account_balance;
                        const volume = calc_volume(fixed_master_acc_balance, master.account_balance, mt4_copier_account.rows[0].account_balance, copier_order.lots, contract.risk_type, contract.risk_setting, history_order.lots, one_exist_order.lots);
                        real_lot_size = (copier_order && copier_order.lots <= volume) ? 0 : volume;
                        console.log(real_lot_size, volume);
                      }
                    }
                    if (!pair) return;
                    const master_order_comment = one_exist_order.comment;
                    const master_split = master_order_comment.split("#");
                    const master_new_order_id = parseInt(master_split[1]);
                    if (real_lot_size === 0 && volume === 0) {
                      await client.query(
                        `UPDATE contract
                          SET order_pair = array_remove(order_pair, $1)
                          WHERE id = '${contract.id}'`,
                        [
                          pair
                        ]
                      );
                      const update_pair = {
                        ...pair,
                        master_order_id: master_new_order_id
                      }
                      await client.query(
                        `UPDATE contract
                          SET order_pair = array_append(order_pair, $1)
                          WHERE id = '${contract.id}'`,
                        [
                          update_pair
                        ]
                      );
                      return;
                    }
                    if (!contract.status) return;
                    await metatrader4Axios.get('/OrderClose', {
                      params: {
                        id: mt4_copier_account.rows[0].token,
                        ticket: pair.copier_order_id,
                        lots: real_lot_size
                      }
                    }).then(async (closed_order) => {
                      if (closed_order.status !== 200) return;
                      const user = await client.query(
                        `SELECT notification_setting
                        FROM users
                        WHERE id = $1`,
                        [
                          mt4_copier_account.rows[0].user_id
                        ]
                      );
                      if (user.rowCount > 0 && user.rows[0].notification_setting?.close_trade) {
                        const myDate = new Date();
                        const formattedDate = myDate.toISOString();
                        const my_secret_name = JSON.stringify({
                          time: moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                          type: "close_trade",
                          user_id: mt4_copier_account.rows[0].user_id,
                          account_id: mt4_copier_account.rows[0].account_id
                        });
                        const uniqueId = uuidv5(my_secret_name, MY_NAMESPACE);
                        const messages = await client.query(
                          `INSERT INTO notifications
                          (id, receiver_id, message, read, time, type)
                          VALUES ($1, $2, $3, $4, $5, $6)
                          RETURNING *`,
                          [
                            uniqueId,
                            mt4_copier_account.rows[0].user_id,
                            "MT4 account " + mt4_copier_account.rows[0].account_id + " closed " + (real_lot_size > 0 ? real_lot_size : "all" + " lots of order ") + pair.copier_order_id + " at " + moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                            false,
                            formattedDate,
                            "close_trade"
                          ]
                        );
                        if (socketUsers[mt4_copier_account.rows[0].user_id]) {
                          io.to(mt4_copier_account.rows[0].user_id).emit('notification', messages.rowCount > 0 ? messages.rows[0] : {});
                        }
                        const closed_order_comment = closed_order.data.comment;
                        if (real_lot_size > 0 && closed_order_comment.includes("to")) {
                          const temp_split = closed_order_comment.split("#");
                          const new_order_id = parseInt(temp_split[1]);
                          await client.query(
                            `UPDATE contract
                            SET order_pair = array_remove(order_pair, $1)
                            WHERE id = '${contract.id}'`,
                            [
                              pair
                            ]
                          );
                          const update_pair = {
                            master_order_id: master_new_order_id,
                            copier_order_id: new_order_id,
                            old_copier_order_id: pair.copier_order_id,
                            lot_size: real_lot_size,
                          }
                          await client.query(
                            `UPDATE contract
                            SET order_pair = array_append(order_pair, $1)
                            WHERE id = '${contract.id}'`,
                            [
                              update_pair
                            ]
                          );
                        }
                      }
                      console.log("metatrader4-master ----------> close metatrader4 success", performance.now())
                    }).catch((err) => {
                      console.log("metatrader4-master ----------> metatrader4 order close error", err);
                    });
                  }
                }
                if (copier_acc_type === "mt5") {
                  const mt5_copier_account = await client.query(
                    `SELECT * FROM accounts 
                      WHERE account_id = $1 
                      AND type = $2
                      AND role = $3`,
                    [
                      copier_acc_id,
                      copier_acc_type,
                      "copier"
                    ]
                  );
                  if (mt5_copier_account.rowCount === 0) return;
                  const order_pairs = contract.order_pair;
                  const pair = order_pairs?.find(item => item.master_order_id === history_order.ticket);
                  if (exist_order && (exist_order.takeProfit !== history_order.takeProfit || exist_order.stopLoss !== history_order.stopLoss)) {
                    if (!contract.status || !pair) return;
                    await metatrader5Axios.get(`/SymbolParams`, {
                      params: {
                        id: mt5_copier_account.rows[0].token,
                        symbol: exist_order.symbol
                      }
                    }).then(async (info) => {
                      if (info.statusText === "OK") {
                        console.log(info.data.symbolInfo.points);
                        const { stopLoss, takeProfit } = calc_tp_st(master.account_balance, contract, mt5_copier_account.rows[0].account_balance, contract.follow_tp_st, exist_order, info.data.symbolInfo.points);
                        await metatrader5Axios.get('/OrderModify', {
                          params: {
                            id: mt5_copier_account.rows[0].token,
                            ticket: pair.copier_order_id,
                            stoploss: stopLoss,
                            takeprofit: takeProfit,
                          }
                        }).then(async (modify_response) => {
                          if (modify_response.status === 200) {
                            console.log("metatrader4-master ----------> metatrader5 modify success", performance.now());
                            const user = await client.query(
                              `SELECT notification_setting
                              FROM users
                              WHERE id = $1`,
                              [
                                mt5_copier_account.rows[0].user_id
                              ]
                            );
                            if (user.rowCount > 0 && user.rows[0].notification_setting?.modify_trade) {
                              const myDate = new Date();
                              const formattedDate = myDate.toISOString();
                              const my_secret_name = JSON.stringify({
                                time: moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                                type: "modify_trade",
                                user_id: mt5_copier_account.rows[0].user_id,
                                account_id: mt5_copier_account.rows[0].account_id
                              });
                              const uniqueId = uuidv5(my_secret_name, MY_NAMESPACE);
                              const messages = await client.query(
                                `INSERT INTO notifications
                                (id, receiver_id, message, read, time, type)
                                VALUES ($1, $2, $3, $4, $5, $6)
                                RETURNING *`,
                                [
                                  uniqueId,
                                  mt5_copier_account.rows[0].user_id,
                                  "MT5 account " + mt5_copier_account.rows[0].account_id + " modified stop loss or take profit of order " + pair.copier_order_id + " at " + moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                                  false,
                                  formattedDate,
                                  "modify_trade"
                                ]
                              );
                              if (socketUsers[mt5_copier_account.rows[0].user_id]) {
                                io.to(mt5_copier_account.rows[0].user_id).emit('notification', messages.rowCount > 0 ? messages.rows[0] : {});
                              }
                            }
                          }
                        }).catch((err) => {
                          console.log("metatrader4-master ----------> metatrader5 modify error", err);
                        })
                      }
                    })
                  }
                  if (!exist_order) {
                    const master_orders_history = await metatrader4Axios.get(`/OrderHistory`, {
                      params: {
                        id: master.token,
                        from: new Date(new Date(history_order.openTime) - 5000000)
                      }
                    });
                    let real_lot_size;
                    let volume = -1;
                    let one_exist_order;
                    if (master_orders_history.status === 200) {
                      const master_orders_history_data = master_orders_history.data;
                      one_exist_order = master_orders_history_data.reverse().find(item => item.openTime === history_order.openTime);
                      if (one_exist_order.lots === history_order.lots) {
                        real_lot_size = 0;
                        master_database_set();
                        if (!contract.status && pair) {
                          await client.query(
                            `UPDATE contract
                              SET order_pair = array_remove(order_pair, $1)
                              WHERE id = '${contract.id}'`,
                            [
                              pair
                            ]
                          );
                        }
                      }
                      else {
                        if (!pair) return;
                        const copier_order = mt5_copier_account.rows[0].history_orders?.find(item => item.ticket === pair.copier_order_id);
                        const fixed_master_acc_balance = contract.risk_type === "fixed_balance_multiplier" ? contract.fixed_master_acc_balance : master.account_balance;
                        const volume = calc_volume(fixed_master_acc_balance, master.account_balance, mt5_copier_account.rows[0].account_balance, copier_order.lots, contract.risk_type, contract.risk_setting, history_order.lots, one_exist_order.lots);
                        real_lot_size = (copier_order && copier_order.lots <= volume) ? 0 : volume;
                      }
                    }
                    if (!pair) return;
                    const master_order_comment = one_exist_order.comment;
                    console.log(indexNum, "master_order_comment", master_order_comment, performance.now());
                    const master_split = master_order_comment.split("#");
                    const master_new_order_id = parseInt(master_split[1]);
                    if (real_lot_size === 0 && volume === 0) {
                      await client.query(
                        `UPDATE contract
                          SET order_pair = array_remove(order_pair, $1)
                          WHERE id = '${contract.id}'`,
                        [
                          pair
                        ]
                      );
                      const update_pair = {
                        ...pair,
                        master_order_id: master_new_order_id
                      }
                      await client.query(
                        `UPDATE contract
                          SET order_pair = array_append(order_pair, $1)
                          WHERE id = '${contract.id}'`,
                        [
                          update_pair
                        ]
                      );
                      return;
                    }
                    if (!contract.status) return;
                    await metatrader5Axios.get('/OrderClose', {
                      params: {
                        id: mt5_copier_account.rows[0].token,
                        ticket: pair.copier_order_id,
                        lots: real_lot_size
                      }
                    }).then(async (closed_order) => {
                      if (closed_order.status !== 200) return;
                      const user = await client.query(
                        `SELECT notification_setting
                        FROM users
                        WHERE id = $1`,
                        [
                          mt5_copier_account.rows[0].user_id
                        ]
                      );
                      if (user.rowCount > 0 && user.rows[0].notification_setting?.close_trade) {
                        const myDate = new Date();
                        const formattedDate = myDate.toISOString();
                        const my_secret_name = JSON.stringify({
                          time: moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                          type: "close_trade",
                          user_id: mt5_copier_account.rows[0].user_id,
                          account_id: mt5_copier_account.rows[0].account_id
                        });
                        const uniqueId = uuidv5(my_secret_name, MY_NAMESPACE);
                        const messages = await client.query(
                          `INSERT INTO notifications
                          (id, receiver_id, message, read, time, type)
                          VALUES ($1, $2, $3, $4, $5, $6)
                          RETURNING *`,
                          [
                            uniqueId,
                            mt5_copier_account.rows[0].user_id,
                            "MT5 account " + mt5_copier_account.rows[0].account_id + " closed " + (real_lot_size > 0 ? real_lot_size : "all" + " lots of order ") + pair.copier_order_id + " at " + moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                            false,
                            formattedDate,
                            "close_trade"
                          ]
                        );
                        if (socketUsers[mt5_copier_account.rows[0].user_id]) {
                          io.to(mt5_copier_account.rows[0].user_id).emit('notification', messages.rowCount > 0 ? messages.rows[0] : {});
                        }
                        if (real_lot_size > 0) {
                          await client.query(
                            `UPDATE contract
                            SET order_pair = array_remove(order_pair, $1)
                            WHERE id = '${contract.id}'`,
                            [
                              pair
                            ]
                          );
                          const update_pair = {
                            ...pair,
                            master_order_id: master_new_order_id,
                          }
                          await client.query(
                            `UPDATE contract
                            SET order_pair = array_append(order_pair, $1)
                            WHERE id = '${contract.id}'`,
                            [
                              update_pair
                            ]
                          );
                        }
                      }
                      console.log("metatrader4-master ----------> close metatrader4 success", performance.now())
                    }).catch(() => {
                      console.log("metatrader4-master ----------> metatrader4 order close error");
                    });
                  }
                }
              });
              callback();
            };

            order_remove();
          });

          //add order part
          master_opened_orders?.map(async (opened_order) => {
            const exist_order = history_orders?.find(item => item.ticket === opened_order.ticket);
            if (exist_order) return;

            const comment = opened_order.comment;
            let old_account_id;
            if (comment.includes("from")) {
              const temp_list = comment.split("#");
              old_account_id = parseInt(temp_list[1]);
              console.log(old_account_id);
            }
            //order
            console.log("start order function");
            const order_function = async () => {
              contractData.rows.map(async (contract) => {
                const copier_acc_id = contract.copier_acc_id;
                const copier_acc_type = contract.copier_acc_type;
                if (contract.status) {
                  if (copier_acc_type === "mt4") {
                    const mt4_copier_account = await client.query(
                      `SELECT * FROM accounts 
                        WHERE account_id = $1
                        AND type = $2
                        ANd role = $3`,
                      [
                        copier_acc_id,
                        copier_acc_type,
                        "copier"
                      ]
                    );
                    if (mt4_copier_account.rowCount === 0) {
                      console.log("metatrader4-master ----------> get copier account token from database error!");
                      return;
                    }
                    console.log("metatrader4-master ---------->  get data success and order start", performance.now());
                    if (comment.includes("from")) return;
                    await metatrader4Axios.get(`/SymbolParams`, {
                      params: {
                        id: mt4_copier_account.rows[0].token,
                        symbol: opened_order.symbol
                      }
                    }).then(async (info) => {
                      if (info.statusText === "OK") {
                        console.log(info.data.symbol.point);
                        const { volume, stopLoss, takeProfit } = risk_setting_func(master.account_balance, contract, mt4_copier_account.rows[0].account_balance, opened_order, info.data.symbol.point);
                        console.log(volume, stopLoss, takeProfit)
                        if (volume === 0) return;
                        await metatrader4Axios.get('/OrderSend', {
                          params: {
                            id: mt4_copier_account.rows[0].token,
                            symbol: opened_order.symbol,
                            operation: opened_order.type,
                            volume: volume,
                            stoploss: stopLoss,
                            takeprofit: takeProfit,
                          }
                        }).then(async (order_response) => {
                          if (order_response.status === 200) {
                            const user = await client.query(
                              `SELECT notification_setting
                              FROM users
                              WHERE id = $1`,
                              [
                                mt4_copier_account.rows[0].user_id
                              ]
                            );
                            if (user.rowCount > 0 && user.rows[0].notification_setting?.open_trade) {
                              const myDate = new Date();
                              const formattedDate = myDate.toISOString();
                              const my_secret_name = JSON.stringify({
                                time: moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                                type: "open_trade",
                                user_id: mt4_copier_account.rows[0].user_id,
                                account_id: mt4_copier_account.rows[0].account_id
                              });
                              const uniqueId = uuidv5(my_secret_name, MY_NAMESPACE);
                              const messages = await client.query(
                                `INSERT INTO notifications
                                (id, receiver_id, message, read, time, type)
                                VALUES ($1, $2, $3, $4, $5, $6)
                                RETURNING *`,
                                [
                                  uniqueId,
                                  mt4_copier_account.rows[0].user_id,
                                  "MT4 account " + mt4_copier_account.rows[0].account_id + " opened a trade of id " + order_response.data.ticket + " at " + moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                                  false,
                                  formattedDate,
                                  "open_trade"
                                ]
                              );
                              if (socketUsers[mt4_copier_account.rows[0].user_id]) {
                                io.to(mt4_copier_account.rows[0].user_id).emit('notification', messages.rowCount > 0 ? messages.rows[0] : {});
                              }
                              await client.query(
                                `UPDATE contract
                              SET order_pair = array_append(order_pair, $1)
                              WHERE id = '${contract.id}'`,
                                [
                                  {
                                    copier_order_id: order_response.data.ticket,
                                    master_order_id: opened_order.ticket
                                  }
                                ]
                              );
                            }
                            console.log("metatrader4-master ----------> metatrader4 order success", performance.now())
                          }
                        }).catch((err) => {
                          console.log("metatrader4-master ----------> metatrader4 order send error", err);
                        });
                      }
                    })
                  }
                  if (copier_acc_type === "mt5") {

                    const mt5_copier_account = await client.query(
                      `SELECT * FROM accounts 
                        WHERE account_id = $1
                        AND type = $2
                        AND role = $3`,
                      [
                        copier_acc_id,
                        copier_acc_type,
                        "copier"
                      ]
                    );
                    if (mt5_copier_account.rowCount === 0) {
                      console.log("metatrader4-master ----------> get copier account token from database error!");
                      return;
                    }
                    console.log("metatrader4-master ---------->  get data success and order start", performance.now());

                    if (comment.includes("from")) return;
                    await metatrader5Axios.get(`/SymbolParams`, {
                      params: {
                        id: mt5_copier_account.rows[0].token,
                        symbol: opened_order.symbol
                      }
                    }).then(async (info) => {
                      if (info.statusText === "OK") {
                        const { volume, stopLoss, takeProfit } = risk_setting_func(master.account_balance, contract, mt5_copier_account.rows[0].account_balance, opened_order, info.data.symbolInfo.points);
                        if (volume === 0) return;
                        await metatrader5Axios.get('/OrderSend', {
                          params: {
                            id: mt5_copier_account.rows[0].token,
                            symbol: opened_order.symbol,
                            operation: opened_order.type,
                            volume: volume,
                            stoploss: stopLoss,
                            takeprofit: takeProfit,
                          }
                        }).then(async (order_response) => {
                          if (order_response.status === 200) {
                            const user = await client.query(
                              `SELECT notification_setting
                              FROM users
                              WHERE id = $1`,
                              [
                                mt5_copier_account.rows[0].user_id
                              ]
                            );
                            if (user.rowCount > 0 && user.rows[0].notification_setting?.open_trade) {
                              const myDate = new Date();
                              const formattedDate = myDate.toISOString();
                              const my_secret_name = JSON.stringify({
                                time: moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                                type: "open_trade",
                                user_id: mt5_copier_account.rows[0].user_id,
                                account_id: mt5_copier_account.rows[0].account_id
                              });
                              const uniqueId = uuidv5(my_secret_name, MY_NAMESPACE);
                              const messages = await client.query(
                                `INSERT INTO notifications
                                (id, receiver_id, message, read, time, type)
                                VALUES ($1, $2, $3, $4, $5, $6)
                                RETURNING *`,
                                [
                                  uniqueId,
                                  mt5_copier_account.rows[0].user_id,
                                  "MT5 account " + mt5_copier_account.rows[0].account_id + " opened a trade of id " + order_response.data.ticket + " at " + moment(formattedDate).format('YYYY/MM/DD hh:mm:ss A'),
                                  false,
                                  formattedDate,
                                  "open_trade"
                                ]
                              );
                              if (socketUsers[mt5_copier_account.rows[0].user_id]) {
                                io.to(mt5_copier_account.rows[0].user_id).emit('notification', messages.rowCount > 0 ? messages.rows[0] : {});
                              }

                              await client.query(
                                `UPDATE contract
                                SET order_pair = array_append(order_pair, $1)
                                WHERE id = '${contract.id}'`,
                                [
                                  {
                                    copier_order_id: order_response.data.ticket,
                                    master_order_id: opened_order.ticket
                                  }
                                ]
                              );
                            }
                            console.log("metatrader4-master ----------> metatrader5 order success", performance.now())
                          }
                        }).catch((err) => {
                          console.log("metatrader4-master ----------> metatrader5 order send error", err);
                        });
                      }
                    })
                  }
                }
                else {
                  const master_order_history = await metatrader4Axios.get(`/OrderHistory`, {
                    params: {
                      id: master.token,
                      from: new Date(new Date(opened_order.openTime) - 5000000)
                    }
                  });
                  if (master_order_history.status !== 200) return;
                  const master_order_history_data = master_order_history.data;
                  if (copier_acc_type === "mt4") {
                    const copier_data = await client.query(
                      `SELECT * FROM accounts
                        WHERE account_id = $1
                        AND type = $2
                        AND role = $3`,
                      [
                        copier_acc_id,
                        copier_acc_type,
                        "copier"
                      ]
                    );
                    if (copier_data.rowCount === 0) return;
                    const exist_one = master_order_history_data.reverse().find(item => item.openTime === opened_order.openTime);
                    if (!exist_one) return;
                    const order_pair = contract.order_pair;
                    const remove_pair = order_pair.find(item => item.master_order_id === exist_one.ticket);
                    if (!remove_pair) return;
                    const update_pair = {
                      copier_order_id: remove_pair.copier_order_id,
                      master_order_id: opened_order.ticket
                    }
                    await client.query(
                      `UPDATE contract
                        SET order_pair = array_remove(order_pair, $1)
                        WHERE id = '${contract.id}'`,
                      [
                        remove_pair
                      ]
                    );
                    await client.query(
                      `UPDATE contract
                        SET order_pair = array_append(order_pair, $1)
                        WHERE id = '${contract.id}'`,
                      [
                        update_pair
                      ]
                    );
                  }
                  if (copier_acc_type === "mt5") {
                    const copier_data = await client.query(
                      `SELECT * FROM accounts
                        WHERE account_id = $1
                        AND type = $2
                        AND role = $3`,
                      [
                        copier_acc_id,
                        copier_acc_type,
                        "copier"
                      ]
                    );
                    if (copier_data.rowCount === 0) return;
                    const exist_one = master_order_history_data.reverse().find(item => item.openTime === opened_order.openTime);
                    if (!exist_one) return;
                    const order_pair = copier_data.rows[0].order_pair;
                    const remove_pair = order_pair.find(item => item.master_order_id === exist_one.ticket);
                    if (!remove_pair) return;
                    const update_pair = {
                      copier_order_id: remove_pair.copier_order_id,
                      master_order_id: opened_order.ticket
                    }
                    await client.query(
                      `UPDATE contract
                        SET order_pair = array_remove(order_pair, $1)
                        WHERE id = '${contract.id}'`,
                      [
                        remove_pair
                      ]
                    );
                    await client.query(
                      `UPDATE contract
                        SET order_pair = array_append(order_pair, $1)
                        WHERE id = '${contract.id}'`,
                      [
                        update_pair
                      ]
                    );
                  }
                }
              });
            }
            order_function();
          });
          callback();
        }

        const history_orders_set = async () => {
          await client.query(
            `UPDATE accounts 
              SET history_orders = $1
              WHERE id = '${master.id}'`,
            [
              master_opened_orders,
            ]
          );
        }

        add_remove_requests(function () {
          history_orders_set();
        })
      }).catch(() => {
        console.log("metatrader4-master ----------> Opened Orders Time out error");
      })

    }).catch(() => {
      console.log("metatrader4-master ----------> Check Connect Time out error")
    })
  });
  await Promise.all(promises);
}

// getMetatrader4MasterHistoryOrders(function () {
//   getMetatrader4OrderPair();
// });

// setTimeout(function () {
//   setInterval(runMetatrader4TradingFunction, 3 * 1000);
// }, 10 * 1000);

module.exports = { getMetatrader4MasterHistoryOrders, getMetatrader4OrderPair, runMetatrader4TradingFunction }