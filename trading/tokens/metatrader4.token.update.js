const client = require("../../config/db/db.js");
const { metatrader4Axios } = require("../config/metatrader4.config.js");

//Update MT4 Token

const updateMetatrader4Token = async () => {
  const mt4_accounts = await client.query(
    `SELECT id,
      account_id, 
      account_password, 
      host, 
      port, 
      type 
      FROM accounts
      WHERE type = $1`,
      [
        "mt4"
      ]
  );
  if (mt4_accounts.rowCount > 0) {
    mt4_accounts.rows.map(async (account) => {
      await metatrader4Axios.get(`/Connect`, {
        params: {
          user: account.account_id,
          password: account.account_password,
          host: account.host,
          port: account.port
        }
      })
        .then(async (res) => {
          if (res.status === 200) {
            await client.query(
              `UPDATE accounts 
                SET token = '${res.data}' 
                WHERE id = '${account.id}'`
            )
            console.log("MT4 ----------------------------------------> Success Get Token", res.data);
          }
        })
        .catch(() => {
          console.log("MT4 Server Error Master");
        })
    })
  }
}

module.exports = { updateMetatrader4Token };

