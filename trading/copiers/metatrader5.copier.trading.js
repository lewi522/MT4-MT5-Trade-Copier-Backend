const client = require("../../config/db/db.js");
const { metatrader5Axios } = require("../config/metatrader5.config.js");

//Catch the change event of Metatrader5 Copier Account get information Function
const getMetatrader5CopiersPL = async () => {
  const copierData = await client.query(
    `SELECT * FROM accounts
    WHERE role = $1
    AND type = $2`,
    [
      "copier",
      "mt5"
    ]
  );
  if (copierData.rowCount === 0) {
    console.log("getCopiersPL -----------> get copierData from database Empty!");
    return;
  }
  const promises = copierData.rows.map(async (copier) => {
    await metatrader5Axios.get(`/AccountSummary`, {
      params: {
        id: copier.token
      }
    }).then(async (res) => {      
      await client.query(
        `UPDATE accounts
          SET account_balance = $1,
          account_profit = $2,
          account_margin = $3,
          prev_account_margin = account_margin
          WHERE id = '${copier.id}'`,
        [
          res.data.balance,
          res.data.profit,
          res.data.margin
        ]
      );
    }).catch(() => {
      console.log("mt5 getCopiersPL ----------> Get Copiers PL Account Summary Request Error!", copier.account_id);
    });

    await metatrader5Axios.get(`/OpenedOrders`, {
      params: {
        id: copier.token
      }
    }).then(async (copier_orders_res) => {
      if (copier_orders_res.status !== 200) {
        console.log("getCopiersPL ----------> Get Opened Orders Request Error!");
        return;
      }
      const copier_orders = copier_orders_res.data;
      const history_orders = copier.history_orders;

      const add_remove_requests = (callback) => {
        history_orders?.map(async (history_order) => {
          const cur_order = copier_orders?.find(order => history_order.ticket === order.ticket)
          if (!cur_order || history_order.lots !== cur_order.lots) {
            const myDate = new Date();
            const formattedDate = myDate.toISOString();
            const account_pl = await client.query(
              `SELECT account_balance, 
              total_pl_amount,
              prev_account_margin
              FROM accounts 
              WHERE id = '${copier.id}'`
            );
            const contract = await client.query(
              `SELECT id,
              order_pair
              FROM contract
              WHERE copier_acc_id = $1
              AND copier_acc_type = $2`,
              [
                copier.account_id,
                copier.type
              ]
            );
            const order_pair = contract.rows[0].order_pair;
            const exist_one = order_pair?.find(item => item.copier_order_id === history_order.ticket);
            if (!exist_one) return;
            const pl = history_order.profit;
            const account_balance = account_pl.rows[0].account_balance;
            const lot_size = cur_order ? history_order.lots - cur_order.lots : history_order.lots;
            const real_pl = cur_order ? (lot_size * 100) / (history_order.lots * 100) * pl : pl;
            const margin = account_pl.rows[0].prev_account_margin;
            const total_pl = account_pl.rows[0].total_pl_amount + real_pl;
            if (real_pl > 0) {
              await client.query(
                `UPDATE accounts 
                  SET win_count = win_count + 1 
                  WHERE id = '${copier.id}'`
              )
            }
            else {
              await client.query(
                `UPDATE accounts 
                  SET lose_count = lose_count + 1 
                  WHERE id = '${copier.id}'`
              )
            }
            const cur_pl = {
              date: formattedDate,
              balance: account_balance,
              pl: real_pl,
              margin: margin
            }
            await client.query(
              `UPDATE accounts 
                SET con_pl = array_append(con_pl, $1),
                total_pl_amount = $2
                WHERE id = '${copier.id}'`,
              [
                cur_pl,
                total_pl
              ]
            );
            
            if (!cur_order) {
              await client.query(
                `UPDATE contract
                  SET order_pair = array_remove(order_pair, $1)
                  WHERE id = '${contract.rows[0].id}'`,
                [
                  exist_one
                ]
              )
            }
          }
        });
        callback();
      }
      const set_history_orders = async () => {
        await client.query(
          `UPDATE accounts 
            SET history_orders = $1 
            WHERE id = '${copier.id}'`,
          [
            copier_orders
          ]
        )
      }
      add_remove_requests(function () {
        set_history_orders();
      })
    }).catch(() => {
      console.log("mt5 getCopiersPL ----------> Get Opened Orders Request Error")
    })
  });
  await Promise.all(promises);
}

module.exports = { getMetatrader5CopiersPL };