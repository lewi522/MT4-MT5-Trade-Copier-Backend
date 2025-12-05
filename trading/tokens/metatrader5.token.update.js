const client = require("../../config/db/db.js");
const { metatrader5Axios } = require("../config/metatrader5.config.js");

//Update Masters Token

const updateMetatrader5Token = async () => {

  const mt5_accounts = await client.query(
    `SELECT id, 
      account_id, 
      account_password, 
      host, 
      port, 
      type 
      FROM accounts
      WHERE type = $1`,
      [
        "mt5"
      ]
  );
  if (mt5_accounts.rowCount > 0) {
    mt5_accounts.rows.map(async (account) => {
      await metatrader5Axios.get(`/Connect`, {
        params: {
          user: account.account_id,
          password: account.account_password,
          host: account.host,
          port: account.port
        }
      })
        .then(async (res) => {
          console.log(res.data)
          if (res.status === 200) {
            await client.query(
              `UPDATE accounts 
                SET token = '${res.data}' 
                WHERE id = '${account.id}'`
            )
            console.log("MT5 ----------------------------------------> Success Get Token", res.data);
          }
        })
        .catch(() => {
          console.log("MT5 Server Error Master");
        })
    })
  }
}


module.exports = { updateMetatrader5Token };
