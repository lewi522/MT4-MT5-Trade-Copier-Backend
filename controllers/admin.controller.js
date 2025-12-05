const client = require("../config/db/db.js");
const { encryptWithSymmetricKey, decryptData } = require("../config/utils/encryptFunction.js");

const getNumberOfClusters = async () => {
  const clusters = await client.query(
    `SELECT deploy_date FROM clusters`
  );
  return clusters.rowCount;
}

const getNumberOfAccounts = async () => {
  const accounts = await client.query(
    `SELECT * FROM accounts`
  );
  return accounts.rowCount;
}

const getNumberOfTrades = async () => {
  const data = await client.query(
    `SELECT * FROM accounts`
  );
  let tradeCount = 0;
  for (let j = 0; j < data.rowCount; j++) {
    const account = data.rows[j];
    const con_pl = account.con_pl;
    tradeCount += (con_pl?.length > 0 ? con_pl?.length : 0);
  }
  return tradeCount;
}

const getNumberOfUsers = async () => {
  const users = await client.query(
    `SELECT id 
    FROM users
    WHERE manage_role = $1
    AND verify = $2`,
    [
      'user',
      true
    ]
  );
  return users.rowCount;
}

const getPortfolioValue = async () => {
  const data = await client.query(
    `SELECT * FROM accounts`
  );
  let balance = 0;
  for (let j = 0; j < data.rowCount; j++) {
    const account = data.rows[j];
    balance += account.account_balance;
  }
  return balance;
}

exports.getAllData = async (req, res) => {
  try {
    if (req.user && req.user.manage_role === 'admin') {
      const number_of_cluster = await getNumberOfClusters();
      const number_of_accounts = await getNumberOfAccounts();
      const number_of_trades = await getNumberOfTrades();
      const number_of_users = await getNumberOfUsers();
      const portfolio_value = await getPortfolioValue();
      const encryptedResponse = encryptWithSymmetricKey({
        cluster_count: number_of_cluster,
        accounts_count: number_of_accounts,
        trade_count: number_of_trades,
        user_count: number_of_users,
        portfolio_value: portfolio_value,
      });
      await res.status(200).send({ encrypted: encryptedResponse });
    }
    else await res.status(201);
  }
  catch {
    await res.sendStatus(501);
  }
}

exports.getCodeData = async (req, res) => {
  try {
    if (req.user && req.user.manage_role === 'admin') {
      const decryptedData = JSON.parse(decryptData(req.body.encrypted));
      const { displayCount, currentPage } = decryptedData;
      const affiliate_codes = await client.query(
        `SELECT * FROM affiliate_code`
      );
      const filtered_codes = await client.query(
        `SELECT * 
        FROM affiliate_code
        LIMIT ${displayCount}
        OFFSET ${currentPage * displayCount}`
      );
      const encryptedResponse = encryptWithSymmetricKey({ data: filtered_codes.rows, count: affiliate_codes.rowCount });
      await res.status(200).send({ encrypted: encryptedResponse });
    }
    else await res.sendStatus(201);
  }
  catch {
    await res.sendStatus(501);
  }
}

exports.addAffiliateCode = async (req, res) => {
  try {
    if (req.user && req.user.manage_role === 'admin') {
      const decryptedData = JSON.parse(decryptData(req.body.encrypted));
      console.log(decryptedData);
      const today = new Date();
      const formattedDate = today.toISOString();
      await client.query(
        `INSERT INTO affiliate_code
        (discount_percentage,
        discount_period,
        package,
        max_number_of_users,
        discount_code,
        current_number_of_users,
        created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          decryptedData.discount_percentage,
          decryptedData.discount_period,
          decryptedData.package,
          decryptedData.max_number_of_users,
          decryptedData.discount_code,
          0,
          formattedDate
        ]
      );
      const all_data = await client.query(
        `SELECT * FROM affiliate_code`
      );
      const filtered_codes = await client.query(
        `SELECT * 
        FROM affiliate_code
        ORDER BY id
        LIMIT ${decryptedData.displayCount}
        OFFSET ${decryptedData.currentPage * decryptedData.displayCount}`
      );
      const encryptedResponse = encryptWithSymmetricKey({ data: filtered_codes.rows, count: all_data.rowCount });
      await res.status(200).send({ encrypted: encryptedResponse });
    }
    else await res.sendStatus(201);
  }
  catch {
    await res.sendStatus(501);
  }
}

exports.deleteAffiliateCode = async (req, res) => {
  try {
    if (req.user && req.user.manage_role === 'admin') {
      const decryptedData = JSON.parse(decryptData(req.body.encrypted));
      const { discount_code_id, 
        currentPage, 
        displayCount } = decryptedData;
      await client.query(
        `DELETE FROM affiliate_code
        WHERE id = $1`,
        [
          discount_code_id
        ]
      );
      const all_data = await client.query(
        `SELECT COUNT(*) AS total_count FROM affiliate_code`
      );
      const total_count = all_data.rows[0].total_count; 
      const filtered_codes = await client.query(
        `SELECT * 
        FROM affiliate_code
        LIMIT ${displayCount}
        OFFSET ${currentPage * displayCount}`
      );
      const encryptedResponse = encryptWithSymmetricKey({ data: filtered_codes.rows, count: total_count });
      await res.status(200).send({ encrypted: encryptedResponse });
    }
    else await res.sendStatus(201);
  }
  catch {
    await res.sendStatus(501);
  }
}

exports.updateAffiliateCode = async (req, res) => {
  try {
    if (req.user && req.user.manage_role === 'admin') {
      const decryptedData = JSON.parse(decryptData(req.body.encrypted));
      const { discount_code_id, 
        currentPage, 
        displayCount,
        discount_percentage, 
        discount_period,
        package,
        discount_code,
        max_number_of_users } = decryptedData;
        console.log(decryptedData);
      const data = await client.query(
        `UPDATE affiliate_code
        SET discount_percentage = $1,
        discount_period = $2,
        package = $3,
        max_number_of_users = $4,
        discount_code = $5
        WHERE id = $6
        RETURNING *`,
        [
          discount_percentage,
          discount_period,
          package,
          max_number_of_users,
          discount_code,
          discount_code_id
        ]
      );
      const all_data = await client.query(
        `SELECT COUNT(*) AS total_count FROM affiliate_code`
      );
      const total_count = all_data.rows[0].total_count; 
      const filtered_codes = await client.query(
        `SELECT * 
        FROM affiliate_code
        ORDER BY id
        LIMIT ${displayCount}
        OFFSET ${currentPage * displayCount}`
      );
      const encryptedResponse = encryptWithSymmetricKey({ data: filtered_codes.rows, count: total_count });
      await res.status(200).send({ encrypted: encryptedResponse });
    }
    else await res.sendStatus(201);
  }
  catch {
    await res.sendStatus(501);
  }
}