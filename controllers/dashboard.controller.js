const client = require("../config/db/db.js");
const { decryptData, encryptWithSymmetricKey } = require("../config/utils/encryptFunction.js");
const moment = require("moment");

//Dashboard

const getChartBalanceByClusterId = async (id, days, deploy_date) => {
  const data = await client.query(
    `SELECT * FROM accounts
    WHERE cluster_id = $1`,
    [
      id
    ]
  );
  let tradeCount = [];
  let balance = 0;
  for (let j = 0; j < data.rowCount; j++) {
    const account = data.rows[j];
    const con_pl = account.con_pl;
    tradeCount[j] = con_pl?.length > 0 ? con_pl?.length - 1 : 0;
    balance += account.account_balance;
  }
  let win_rate = [];
  let process_balance = [];
  let maxVal = 5;
  let minVal = 0;
  const count = days < 90 ? days : 30;
  const interval = days === 90 ? 3 : 1;
  for (let d = 1; d <= count; d++) {
    let daysAgo = new Date(Date.now() - d * interval * 24 * 60 * 60 * 1000);
    if (daysAgo < deploy_date) daysAgo = deploy_date;
    let day_win_count = 0;
    let day_lose_count = 0;
    let isExist = new Array(data.rowCount).fill(false);
    for (let j = 0; j < data.rowCount; j++) {
      const account = data.rows[j];
      const pl = account.con_pl;
      const len = pl?.length > 0 ? pl.length - 1 : 0;
      if (len === 0) continue;
      for (; tradeCount[j] >= 0; tradeCount[j]--) {
        if (new Date(pl[tradeCount[j]].date) > daysAgo) {
          if (!isExist[j] && tradeCount[j] !== len) balance += (pl[tradeCount[j]].balance - pl[tradeCount[j] + 1].balance);
          isExist[j] = true;
          if (pl[tradeCount[j]].pl >= 0) day_win_count++;
          else day_lose_count++;
        }
        else break;
      }
    }
    const save_date = new Date(Date.now() - (d - 1) * interval * 24 * 60 * 60 * 1000);
    process_balance.push({
      date: moment(save_date),
      balance: balance
    });
    win_rate.push({
      date: moment(save_date),
      rate: (day_win_count + day_lose_count) > 0 ? (day_win_count * 100) / (day_win_count + day_lose_count) : 0
    });
    if (maxVal < balance) maxVal = balance;
    if (minVal > balance) minVal = balance;
    if (daysAgo === deploy_date) break;
  }
  return { win_rate, process_balance, maxVal, minVal }
}

const getChartPnlByClusterId = async (id, days, deploy_date) => {
  const data = await client.query(
    `SELECT * FROM accounts
    WHERE cluster_id = $1`,
    [
      id
    ]
  );
  let tradeCount = [];
  for (let j = 0; j < data.rowCount; j++) {
    const account = data.rows[j];
    const con_pl = account.con_pl;
    tradeCount[j] = con_pl?.length > 0 ? con_pl?.length - 1 : 0;
  }
  let process_pl = [];
  let plMaxVal = 5;
  let plMinVal = -5;
  const count = 3;
  const interval = days === 90 ? 30 : days === 21 ? 7 : 1;
  console.log(interval, days)
  for (let d = 1; d <= count; d++) {
    let daysAgo = new Date(Date.now() - d * interval * 24 * 60 * 60 * 1000);
    if (daysAgo < deploy_date) daysAgo = deploy_date;
    let day_pl = 0;
    for (let j = 0; j < data.rowCount; j++) {
      const account = data.rows[j];
      const pl = account.con_pl;
      if (!pl?.length) continue;
      console.log(pl?.length)
      for (; tradeCount[j] >= 0; tradeCount[j]--) {
        if (new Date(pl[tradeCount[j]].date) > daysAgo) {
          day_pl += pl[tradeCount[j]].pl;
        }
        else break;
      }
    }
    const save_date = new Date(Date.now() - (d - 1) * interval * 24 * 60 * 60 * 1000);
    process_pl.push({
      date: moment(save_date),
      pl: day_pl
    });
    if (plMaxVal < day_pl) plMaxVal = day_pl;
    if (plMinVal > day_pl) plMinVal = day_pl;
    if (daysAgo === deploy_date) break;
  }
  return { process_pl, plMaxVal, plMinVal }
}

const getTotalChartBalance = async (user_id) => {
  const data = await client.query(
    `SELECT * FROM accounts
    WHERE user_id = $1`,
    [
      user_id
    ]
  );
  let tradeCount = [];
  let balance = 0;
  const currentDate = new Date();
  let latest_date = currentDate;
  for (let j = 0; j < data.rowCount; j++) {
    const account = data.rows[j];
    const con_pl = account.con_pl;
    tradeCount[j] = con_pl?.length > 0 ? con_pl?.length - 1 : 0;
    balance += account.account_balance;
    if (latest_date > account.registered_at) latest_date = account.registered_at;
  }
  let process_balance = [];
  let daysTradeCount = [];
  let total_trade_count = 0;
  let current_balance = balance;
  const count = 30;
  const timestamp = currentDate - latest_date;
  const unit = 24 * 60 * 60 * 1000;
  const temp_days = Math.floor(timestamp / unit) + 1;
  const interval = Math.floor((temp_days - 1) / 30) + 1;
  for (let d = 1; d <= count; d++) {
    let daysAgo = new Date(Date.now() - d * interval * 24 * 60 * 60 * 1000);
    let day_win_count = 0;
    let day_lose_count = 0;
    let isExist = new Array(data.rowCount).fill(false);
    for (let j = 0; j < data.rowCount; j++) {
      const account = data.rows[j];
      const pl = account.con_pl;
      const len = pl?.length > 0 ? pl.length - 1 : 0;
      if (len === 0) continue;
      for (; tradeCount[j] >= 0; tradeCount[j]--) {
        if (new Date(pl[tradeCount[j]].date) > daysAgo) {
          if (!isExist[j] && tradeCount[j] !== len) balance += (pl[tradeCount[j]].balance - pl[tradeCount[j] + 1].balance);
          isExist[j] = true;
          if (pl[tradeCount[j]].pl >= 0) day_win_count++;
          else day_lose_count++;
        }
        else break;
      }
    }
    const save_date = new Date(Date.now() - (d - 1) * interval * 24 * 60 * 60 * 1000);
    process_balance.push({
      date: moment(save_date),
      balance: balance
    });
    daysTradeCount.push({
      date: moment(save_date),
      count: day_win_count + day_lose_count
    });
    total_trade_count += (day_win_count + day_lose_count);
  }
  return { daysTradeCount, total_trade_count, process_balance, current_balance }
}

const getNumberOfAccounts = async (user_id) => {
  const accounts = await client.query(
    `SELECT registered_at
    FROM accounts
    WHERE user_id = $1`,
    [
      user_id
    ]
  );
  let account_array = [];
  let account_count = accounts.rowCount;
  if (accounts.rowCount === 0) {
    for (let i = 0; i < 30; i++) {
      account_array.push({
        count: 0,
        date: moment(new Date(Date.now() - i * 60 * 60 * 1000))
      });
    }
  }
  else {
    const currentDate = new Date();
    let latest_date = currentDate;
    accounts.rows.map((account) => {
      if (latest_date > account.registered_at) latest_date = account.registered_at;
    });
    const timestamp = currentDate - latest_date;
    const unit = 60 * 60 * 1000;
    const temp_days = Math.floor(timestamp / unit) + 1;
    const interval = Math.floor((temp_days - 1) / 30) + 1;
    console.log(interval)
    const days = 30;
    for (let d = 1; d <= days; d++) {
      let temp_count = 0;
      const daysAgo = new Date(Date.now() - d * interval * 60 * 60 * 1000);
      const beforeDaysAgo = new Date(Date.now() - (d - 1) * interval * 60 * 60 * 1000);
      for (let i = 0; i < accounts.rowCount; i++) {
        const account = accounts.rows[i];
        if (account.registered_at > daysAgo && account.registered_at < beforeDaysAgo) temp_count++;
      }
      account_array.push({
        count: temp_count,
        date: moment(new Date(Date.now() - (d - 1) * interval * 60 * 60 * 1000))
      });
    }
  }
  return { account_array, account_count }
}

const getNumberOfClusters = async (user_id) => {
  const clusters = await client.query(
    `SELECT deploy_date
    FROM clusters
    WHERE user_id = $1`,
    [
      user_id
    ]
  );
  let cluster_array = [];
  let cluster_count = clusters.rowCount;
  if (clusters.rowCount === 0) {
    for (let i = 0; i < 30; i++) {
      cluster_array.push({
        count: 0,
        date: moment(new Date(Date.now() - i * 60 * 60 * 1000))
      })
    }
  }
  else {
    const currentDate = new Date();
    let latest_date = currentDate;
    clusters.rows.map((cluster) => {
      if (latest_date > cluster.deploy_date) latest_date = cluster.deploy_date;
    });
    const timestamp = currentDate - latest_date;
    const unit = 60 * 60 * 1000;
    const temp_days = Math.floor(timestamp / unit) + 1;
    const interval = Math.floor((temp_days - 1) / 30) + 1;
    for (let d = 1; d <= 30; d++) {
      let temp_count = 0;
      const daysAgo = new Date(Date.now() - d * interval * 60 * 60 * 1000);
      const beforeDaysAgo = new Date(Date.now() - (d - 1) * interval * 60 * 60 * 60);
      for (let i = 0; i < clusters.rowCount; i++) {
        const cluster = clusters.rows[i];
        if (cluster.deploy_date > daysAgo && cluster.deploy_date < beforeDaysAgo) temp_count++;
      };
      cluster_array.push({
        count: temp_count,
        date: moment(new Date(Date.now() - (d - 1) * interval * 60 * 60 * 1000))
      });
      // cluster_count += temp_count;
    }
  }
  return { cluster_array, cluster_count }
}

exports.getClustersWithInfo = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id, display_count, current_page } = decryptedData;
    const offset = display_count * current_page;
    const all_clusters = await client.query(
      `SELECT * FROM clusters
      WHERE user_id = $1`,
      [
        user_id
      ]
    );
    const clusters = await client.query(
      `SELECT * FROM clusters
      WHERE user_id = $1
      ORDER BY id
      LIMIT $2 OFFSET $3`,
      [
        user_id,
        display_count,
        offset
      ]
    );
    let temp = [];
    for (let i = 0; i < clusters.rowCount; i++) {
      const item = clusters.rows[i];
      const accounts = await client.query(
        `SELECT * FROM accounts
        WHERE cluster_id = $1`,
        [
          item.id
        ]
      );
      let pnl = 0;
      let win_count = 0;
      let lose_count = 0;
      let count = 0;
      accounts.rows?.map((account) => {
        pnl += account.total_pl_amount;
        win_count += parseInt(account.win_count);
        lose_count += parseInt(account.lose_count);
        count++;
      });
      temp.push({
        id: item.id,
        cluster_name: item.name,
        pnl: pnl,
        win_count: win_count,
        lose_count: lose_count,
        accounts: count
      });
    }
    const encryptedResponse = encryptWithSymmetricKey({ data: temp, total_count: all_clusters.rowCount });
    await res.status(200).send({ encrypted: encryptedResponse });
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.getDashboardBalanceChart = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id, days } = decryptedData;
    const clusters = await client.query(
      `SELECT deploy_date,
      id,
      name 
      FROM clusters
      WHERE user_id = $1
      ORDER BY id`,
      [
        user_id,
      ]
    );
    if (clusters.rowCount > 0) {
      const { win_rate, process_balance, maxVal, minVal } = await getChartBalanceByClusterId(clusters.rows[0].id, days, clusters.rows[0].deploy_date);
      const encryptedResponse = encryptWithSymmetricKey({
        cluster_list: clusters.rows,
        data: {
          win_rate: win_rate,
          balances: process_balance.reverse(),
          maxVal: Math.max(maxVal, 5),
          minVal: minVal
        }
      });
      await res.status(200).send({ encrypted: encryptedResponse });
    }
    else {
      const encryptedResponse = encryptWithSymmetricKey({
        cluster_list: [],
        data: {
          days_trade_count: [],
          win_rate: [],
          balances: [],
          maxVal: 5,
          minVal: 0
        }
      });
      await res.status(200).send({ encrypted: encryptedResponse });
    }
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.getDashboardBalanceChartByClusterId = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { cluster_id, days } = decryptedData;
    const cluster = await client.query(
      `SELECT deploy_date
      FROM clusters
      WHERE id = $1`,
      [
        cluster_id,
      ]
    );
    const { win_rate, process_balance, maxVal, minVal } = await getChartBalanceByClusterId(cluster_id, days, cluster.rows[0].deploy_date);
    const encryptedResponse = encryptWithSymmetricKey({
      win_rate: win_rate.reverse(),
      balances: process_balance.reverse(),
      maxVal: Math.max(maxVal, 5),
      minVal: minVal
    });
    await res.status(200).send({ encrypted: encryptedResponse });
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.getDashboardPlChart = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id, days } = decryptedData;
    const clusters = await client.query(
      `SELECT deploy_date,
      id,
      name
      FROM clusters
      WHERE user_id = $1
      ORDER BY id`,
      [
        user_id
      ]
    );
    if (clusters.rowCount > 0) {
      const { process_pl, plMaxVal, plMinVal } = await getChartPnlByClusterId(clusters.rows[0].id, days, clusters.rows[0].deploy_date);
      const encryptedResponse = encryptWithSymmetricKey({
        pl: process_pl.reverse(),
        plMaxVal: Math.max(plMaxVal, 5),
        plMinVal: Math.min(plMinVal, -5)
      });
      await res.status(200).send({ encrypted: encryptedResponse });
    }
    else {
      const encryptedResponse = encryptWithSymmetricKey({
        pl: [],
        plMaxVal: 5,
        plMinVal: -5
      });
      await res.status(200).send({ encrypted: encryptedResponse });
    }
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.getDashboardPlChartByClusterId = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { cluster_id, days } = decryptedData;
    console.log(days)
    const cluster = await client.query(
      `SELECT deploy_date
      FROM clusters
      WHERE id = $1`,
      [
        cluster_id
      ]
    );
    const { process_pl, plMaxVal, plMinVal } = await getChartPnlByClusterId(cluster_id, days, cluster.rows[0].deploy_date);
    console.log("get Pl Chart", process_pl, plMaxVal, plMinVal);
    await res.status(200).send({
      pl: process_pl.reverse(),
      plMaxVal: Math.max(plMaxVal, 5),
      plMinVal: Math.min(plMinVal, -5)
    });
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.getDashboardCardData = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id } = decryptedData;
    const { cluster_array, cluster_count } = await getNumberOfClusters(user_id);
    const { account_array, account_count } = await getNumberOfAccounts(user_id);
    const { daysTradeCount, total_trade_count, process_balance, current_balance } = await getTotalChartBalance(user_id);
    const encryptedResponse = encryptWithSymmetricKey({
      accounts: account_array,
      account_count: account_count,
      clusters: cluster_array,
      cluster_count: cluster_count,
      days_trade_count: daysTradeCount,
      total_trade_count: total_trade_count,
      balances: process_balance.reverse(),
      current_balance: current_balance
    });
    await res.status(200).send({ encrypted: encryptedResponse });
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

//Clusters

exports.getAvailableAccountList = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id } = decryptedData;
    const accounts = await client.query(
      `SELECT account_id,
      account_name,
      type,
      role
      FROM accounts
      WHERE user_id = $1
      AND role NOT IN ($2, $3)`,
      [
        user_id,
        "master",
        "copier"
      ]
    );
    const encryptedResponse = encryptWithSymmetricKey(accounts.rows);
    await res.status(200).send({ encrypted: encryptedResponse });
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.getAvailableCopierList = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id, copier_acc_id, copier_acc_type } = decryptedData;

    const accounts = await client.query(
      `SELECT account_id,
      account_name,
      type,
      role
      FROM accounts
      WHERE user_id = $1
      AND (role NOT IN ($2, $3) OR (account_id = $4 AND type = $5 AND role = $6))`,
      [
        user_id,
        "master",
        "copier",
        copier_acc_id,
        copier_acc_type,
        "copier"
      ]
    );
    const encryptedResponse = encryptWithSymmetricKey(accounts.rows);
    await res.status(200).send({ encrypted: encryptedResponse });
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.createCluster = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { cluster_name, master } = decryptedData;
    const user_id = req.user.id;
    const deploy_date = new Date();
    const formattedDate = deploy_date.toISOString();
    const cluster = await client.query(
      `INSERT INTO clusters (
      name,
      user_id,
      deploy_date,
      number_of_copier,
      master_account) 
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [
        cluster_name,
        user_id,
        formattedDate,
        0,
        {
          account_id: master.account_id,
          type: master.type,
          account_name: master.account_name
        }
      ]
    );
    await client.query(
      `UPDATE accounts 
      SET role = $1,
      cluster_id = $2
      WHERE account_id = $3
      AND type = $4`,
      [
        "master",
        cluster.rows[0].id,
        master.account_id,
        master.type
      ]
    );
    await res.status(200).send("ok");
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.deleteCluster = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { cluster_id } = decryptedData;
    const cluster = await client.query(
      `SELECT * FROM clusters
      WHERE id = $1`,
      [
        cluster_id
      ]
    );
    if (cluster.rowCount > 0) {
      const account_id = cluster.rows[0].master_account?.account_id;
      const type = cluster.rows[0].master_account?.type;
      await client.query(
        `UPDATE accounts SET role = $1
        WHERE account_id = $2
        AND type = $3`,
        [
          "",
          account_id,
          type
        ]
      );
      const data = await client.query(
        `SELECT copier_acc_id,
        copier_acc_type
        FROM contract
        WHERE master_acc_id = $1
        AND master_acc_type = $2`,
        [
          account_id,
          type
        ]
      );
      if (data.rowCount > 0) {
        data.rows.map(async (item) => {
          await client.query(
            `UPDATE accounts
            SET role = $1
            WHERE account_id = $2
            AND type = $3`,
            [
              "",
              item.copier_acc_id,
              item.copier_acc_type
            ]
          )
        })
      }
      await client.query(
        `DELETE FROM contract
      WHERE master_acc_id = $1
      AND master_acc_type = $2`,
        [
          account_id,
          type
        ]
      );
      await client.query(
        `DELETE FROM clusters
        WHERE id = $1`,
        [
          cluster_id
        ]
      );
      await res.status(200).send("ok");
    }
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.updateClusterName = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { cluster_id, cluster_name } = decryptedData;
    await client.query(
      `UPDATE clusters
      SET name = $1
      WHERE id = $2`,
      [
        cluster_name,
        cluster_id
      ]
    );
    await res.status(200).send("ok");
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.getClusters = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id } = decryptedData;
    const clusters = await client.query(
      `SELECT * FROM clusters
      WHERE user_id = $1`,
      [
        user_id
      ]
    );
    const encryptedResponse = encryptWithSymmetricKey(clusters.rows);
    await res.status(200).send({ encrypted: encryptedResponse });
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.createCopier = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { encrypted_clusterId,
      encrypted_copier_acc_name,
      encrypted_copier_acc_id,
      encrypted_copier_acc_type,
      encrypted_riskType,
      encrypted_riskSetting,
      encrypted_fixedMasterAccBalance,
      encrypted_isForceMax,
      encrypted_isForceMin,
      encrypted_forceMaxValue,
      encrypted_forceMinValue,
      encrypted_isLotRefine,
      encrypted_lotRefineSize,
    } = req.body;

    const clusterId = JSON.parse(decryptData(encrypted_clusterId));
    const copier_acc_name = JSON.parse(decryptData(encrypted_copier_acc_name));
    const copier_acc_id = JSON.parse(decryptData(encrypted_copier_acc_id));
    const copier_acc_type = JSON.parse(decryptData(encrypted_copier_acc_type));
    const riskType = JSON.parse(decryptData(encrypted_riskType));
    const riskSetting = JSON.parse(decryptData(encrypted_riskSetting));
    const fixedMasterAccBalance = JSON.parse(decryptData(encrypted_fixedMasterAccBalance));
    const isForceMax = JSON.parse(decryptData(encrypted_isForceMax));
    const isForceMin = JSON.parse(decryptData(encrypted_isForceMin));
    const forceMaxValue = JSON.parse(decryptData(encrypted_forceMaxValue));
    const forceMinValue = JSON.parse(decryptData(encrypted_forceMinValue));
    const isLotRefine = JSON.parse(decryptData(encrypted_isLotRefine));
    const lotRefineSize = JSON.parse(decryptData(encrypted_lotRefineSize));

    const forceMinMax = {
      force_max: isForceMax,
      force_min: isForceMin,
      force_max_value: parseFloat(forceMaxValue),
      force_min_value: parseFloat(forceMinValue),
      lot_refine: isLotRefine,
      lot_refine_size: parseFloat(lotRefineSize),
    }
    const master_account = await client.query(
      `SELECT master_account
      FROM clusters
      WHERE id = $1`,
      [
        clusterId
      ]
    );
    await client.query(
      `INSERT INTO contract
      (master_acc_name,
      master_acc_id,
      master_acc_type,
      copier_acc_name,
      copier_acc_id,
      copier_acc_type,
      status,
      force_min_max,
      follow_tp_st,
      risk_type,
      risk_setting,
      fixed_master_acc_balance,
      cluster_id,
      user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        master_account.rows[0].master_account.account_name,
        master_account.rows[0].master_account.account_id,
        master_account.rows[0].master_account.type,
        copier_acc_name,
        copier_acc_id,
        copier_acc_type,
        true,
        forceMinMax,
        {},
        riskType,
        riskSetting ? riskSetting : 0,
        fixedMasterAccBalance,
        clusterId,
        user_id
      ]
    );
    const account_data = await client.query(
      `UPDATE accounts
      SET role = $1,
      cluster_id = $2
      WHERE account_id = $3
      AND type = $4`,
      [
        "copier",
        clusterId,
        copier_acc_id,
        copier_acc_type
      ]
    );
    await client.query(
      `UPDATE clusters
      SET number_of_copier = number_of_copier + 1
      WHERE id = $1`,
      [
        clusterId
      ]
    );
    if (account_data.rowCount > 0) {
      await res.status(200).send("ok");
    }
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.getCopierByClusterId = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { cluster_id, user_id, display_count, current_page } = decryptedData;
    const offset = display_count * current_page;
    const all_data = await client.query(
      `SELECT id FROM contract
      WHERE cluster_id = $1
      AND user_id = $2`,
      [
        cluster_id,
        user_id
      ]
    );
    const data = await client.query(
      `SELECT *
      FROM contract
      WHERE cluster_id = $1
      AND user_id = $2
      ORDER BY id ASC
      LIMIT $3 OFFSET $4`,
      [
        cluster_id,
        user_id,
        display_count,
        offset
      ]
    );
    const clusterMaster = await client.query(
      `SELECT master_account
      FROM clusters
      WHERE id = $1`,
      [
        cluster_id
      ]
    );
    const encryptedResponse = encryptWithSymmetricKey({ copierData: data.rows, clusterMaster: clusterMaster.rows[0].master_account, total_count: all_data.rowCount });
    await res.status(200).send({ encrypted: encryptedResponse });
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.getContractById = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { contract_id } = decryptedData;
    const data = await client.query(
      `SELECT * FROM contract
      WHERE id = $1`,
      [
        contract_id
      ]
    );
    const encryptedResponse = encryptWithSymmetricKey(data.rows[0]);
    await res.status(200).send({ encrypted: encryptedResponse });
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.updateContractStatus = async (req, res) => {
  try {
    const subscription = req.user.subscription;
    if (subscription?.payment_status === "expired") {
      await res.status(201).send("Contract status is not allowed to change as your subscription is expired!");
    }
    else {
      const decryptedData = JSON.parse(decryptData(req.body.encrypted));
      const { id, status, cluster_id } = decryptedData;
      await client.query(
        `UPDATE contract
      SET status = $1
      WHERE id = $2`,
        [
          status,
          id
        ]
      );
      const data = await client.query(
        `SELECT id, 
      master_acc_name,
      master_acc_id,
      master_acc_type,
      copier_acc_name,
      copier_acc_id,
      copier_acc_type,
      risk_type,
      status
      FROM contract
      WHERE user_id = $1
      AND cluster_id = $2
      ORDER BY id ASC`,
        [
          req.user.id,
          cluster_id
        ]
      );
      const encryptedResponse = encryptWithSymmetricKey(data.rows);
      await res.status(200).send({ encrypted: encryptedResponse });
    }
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.updateContractCopierSetting = async (req, res) => {
  try {
    const subscription = req.user.subscription;
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { contract_id,
      copier_acc_id,
      copier_acc_type,
      copier_acc_name,
      status
    } = decryptedData;
    const contract_data = await client.query(
      `SELECT copier_acc_id,
       copier_acc_type,
       status
       FROM contract
       WHERE id = $1`,
      [
        contract_id
      ]
    );
    if (subscription?.payment_status === "expired" && contract_data.rows[0].status !== status) {
      await res.status(201).send("Contract status is not allowed to change as your subscription is expired!");
    }
    else {
      await client.query(
        `UPDATE accounts
        SET role = $1,
        cluster_id = $2
        WHERE account_id = $3
        AND type = $4`,
        [
          "",
          null,
          contract_data.rows[0].copier_acc_id,
          contract_data.rows[0].copier_acc_type
        ]
      );
      const contract = await client.query(
        `UPDATE contract
        SET copier_acc_id = $1,
        copier_acc_type = $2,
        copier_acc_name = $3,
        status = $4
        WHERE id = $5
        RETURNING cluster_id`,
        [
          copier_acc_id,
          copier_acc_type,
          copier_acc_name,
          status,
          contract_id
        ]
      );
      await client.query(
        `UPDATE accounts
        SET role = $1,
        cluster_id = $2
        WHERE account_id = $3
        AND type = $4`,
        [
          "copier",
          contract.rows[0].cluster_id,
          copier_acc_id,
          copier_acc_type
        ]
      );
      await res.status(200).send("ok");
    }
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.updateContractRiskSetting = async (req, res) => {
  try {
    const { encrypted_id,
      encrypted_riskType,
      encrypted_riskSetting,
      encrypted_fixedMasterAccBalance,
      encrypted_isForceMax,
      encrypted_isForceMin,
      encrypted_forceMaxValue,
      encrypted_forceMinValue,
      encrypted_isLotRefine,
      encrypted_lotRefineSize,
    } = req.body;
    const id = JSON.parse(decryptData(encrypted_id));
    const riskType = JSON.parse(decryptData(encrypted_riskType));
    const riskSetting = JSON.parse(decryptData(encrypted_riskSetting));
    const fixedMasterAccBalance = JSON.parse(decryptData(encrypted_fixedMasterAccBalance));
    const isForceMax = JSON.parse(decryptData(encrypted_isForceMax));
    const isForceMin = JSON.parse(decryptData(encrypted_isForceMin));
    const forceMaxValue = JSON.parse(decryptData(encrypted_forceMaxValue));
    const forceMinValue = JSON.parse(decryptData(encrypted_forceMinValue));
    const isLotRefine = JSON.parse(decryptData(encrypted_isLotRefine));
    const lotRefineSize = JSON.parse(decryptData(encrypted_lotRefineSize));
    const forceMinMax = {
      force_max: isForceMax,
      force_min: isForceMin,
      force_max_value: parseFloat(forceMaxValue),
      force_min_value: parseFloat(forceMinValue),
      lot_refine: isLotRefine,
      lot_refine_size: parseFloat(lotRefineSize),
    }
    await client.query(
      `UPDATE contract
      SET force_min_max = $1,
      risk_type =$2,
      risk_setting = $3,
      fixed_master_acc_balance = $4
      WHERE id = $5`,
      [
        forceMinMax,
        riskType,
        riskSetting,
        fixedMasterAccBalance,
        id
      ]
    );
    await res.status(200).send("ok");
  }
  catch {
    await res.status(501).send("Server Error");
  }
}

exports.updateContractPositionSetting = async (req, res) => {
  try {
    const {
      encrypted_id,
      encrypted_takeProfit,
      encrypted_stopLoss,
      encrypted_fixedStopLoss,
      encrypted_fixedTakeProfit,
      encrypted_fixedStopLossSize,
      encrypted_fixedTakeProfitSize,
      encrypted_stopLossRefinement,
      encrypted_takeProfitRefinement,
      encrypted_stopLossRefinementSize,
      encrypted_takeProfitRefinementSize
    } = req.body;
    const id = JSON.parse(decryptData(encrypted_id));
    const takeProfit = JSON.parse(decryptData(encrypted_takeProfit));
    const stopLoss = JSON.parse(decryptData(encrypted_stopLoss));
    const fixedStopLoss = JSON.parse(decryptData(encrypted_fixedStopLoss));
    const fixedTakeProfit = JSON.parse(decryptData(encrypted_fixedTakeProfit));
    const fixedStopLossSize = JSON.parse(decryptData(encrypted_fixedStopLossSize));
    const fixedTakeProfitSize = JSON.parse(decryptData(encrypted_fixedTakeProfitSize));
    const stopLossRefinement = JSON.parse(decryptData(encrypted_stopLossRefinement));
    const takeProfitRefinement = JSON.parse(decryptData(encrypted_takeProfitRefinement));
    const stopLossRefinementSize = JSON.parse(decryptData(encrypted_stopLossRefinementSize));
    const takeProfitRefinementSize = JSON.parse(decryptData(encrypted_takeProfitRefinementSize));
    const follow_tp_st = {
      stop_loss: stopLoss === 0 ? true : false,
      take_profit: takeProfit === 0 ? true : false,
      fixed_stop_loss: fixedStopLoss === 0 ? true : false,
      fixed_take_profit: fixedTakeProfit === 0 ? true : false,
      fixed_stop_loss_size: parseInt(fixedStopLossSize),
      fixed_take_profit_size: parseInt(fixedTakeProfitSize),
      stop_loss_refinement: stopLossRefinement === 0 ? true : false,
      take_profit_refinement: takeProfitRefinement === 0 ? true : false,
      stop_loss_refinement_size: parseInt(stopLossRefinementSize),
      take_profit_refinement_size: parseInt(takeProfitRefinementSize),
    }
    await client.query(
      `UPDATE contract
      SET follow_tp_st = $1
      WHERE id = $2`,
      [
        follow_tp_st,
        id
      ]
    );
    await res.status(200).send("ok");
  }
  catch {
    await res.staus(501).send("Server Error!");
  }
}

//Deploy Account

exports.deployAccount = async (req, res) => {
  try {
    const {
      encrypted_token,
      encrypted_acc_id,
      encrypted_acc_password,
      encrypted_acc_server_name,
      encrypted_acc_name,
      encrypted_host,
      encrypted_port,
      encrypted_type,
      encrypted_user_id
    } = req.body;
    const token = JSON.parse(decryptData(encrypted_token));
    const acc_id = JSON.parse(decryptData(encrypted_acc_id));
    const acc_password = JSON.parse(decryptData(encrypted_acc_password));
    const acc_server_name = JSON.parse(decryptData(encrypted_acc_server_name));
    const acc_name = JSON.parse(decryptData(encrypted_acc_name));
    const host = JSON.parse(decryptData(encrypted_host));
    const port = JSON.parse(decryptData(encrypted_port));
    const type = JSON.parse(decryptData(encrypted_type));
    const user_id = JSON.parse(decryptData(encrypted_user_id));
    const same_data = await client.query(
      `SELECT * FROM accounts 
      WHERE account_id=$1
      AND type=$2`,
      [
        acc_id,
        type
      ]);
    const data = await client.query(
      `SELECT * FROM accounts
      WHERE user_id = $1`,
      [
        user_id
      ]
    );
    const subscription = req.user.subscription;
    if (subscription?.isExist) {
      if (new Date(subscription?.next_billing_date) > new Date()) {
        if (subscription?.count + 2 > data.rowCount) {
          if (same_data.rowCount === 0) {
            const myDate = new Date();
            const formatedDate = myDate.toISOString();
            await client.query(
              `INSERT INTO accounts
              (account_id,
              type,
              account_name,
              token,
              registered_at,
              host,
              port,
              account_password,
              account_balance,
              total_pl_amount,
              win_count,
              lose_count,
              account_server_name,
              user_id,
              role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
              [
                acc_id,
                type,
                acc_name,
                token,
                formatedDate,
                host,
                port,
                acc_password,
                0,
                0,
                0,
                0,
                acc_server_name,
                user_id,
                ""
              ]
            );
            await res.status(200).send("ok");
          }
          else {
            const response = "This account had already been registered!";
            await res.status(201).send(response);
          }
        }
        else {
          const response = "The number of accounts is limited based on your current subscription. To deploy additional accounts, please upgrade your subscription plan.";
          await res.status(201).send(response);
        }
      }
      else {
        const response = "Subscription Expired. You need to pay for subscription.";
        await res.status(201).send(response);
      }
    }
    else {
      if (data.rowCount >= 2) {
        const response = "A subscription is required to deploy your account. Please note that you may deploy up to two accounts for free.";
        await res.status(201).send(response);
      }
      else {
        if (same_data.rowCount === 0) {
          const myDate = new Date();
          const formatedDate = myDate.toISOString();
          await client.query(
            `INSERT INTO accounts
              (account_id,
              type,
              account_name,
              token,
              registered_at,
              host,
              port,
              account_password,
              account_balance,
              total_pl_amount,
              win_count,
              lose_count,
              account_server_name,
              user_id,
              role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              acc_id,
              type,
              acc_name,
              token,
              formatedDate,
              host,
              port,
              acc_password,
              0,
              0,
              0,
              0,
              acc_server_name,
              user_id,
              ""
            ]
          );
          await res.status(200).send("ok");
        }
        else {
          const response = "This account had already been registered!";
          await res.status(201).send(response);
        }
      }
    }
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.deleteAccount = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { account_id, type } = decryptedData;
    const user_id = req.user.id;
    const account = await client.query(
      `SELECT role
      FROM accounts
      WHERE account_id = $1
      AND type = $2
      AND user_id = $3`,
      [
        account_id,
        type,
        user_id
      ]
    );
    if (account.rows[0].role === "master") {
      await res.status(201).send("This account cannot be removed as it is registered as a master account.");
      return;
    }
    if (account.rows[0].role === "copier") {
      const contract = await client.query(
        `DELETE FROM contract
        WHERE copier_acc_id = $1
        AND copier_acc_type = $2
        RETURNING cluster_id`,
        [
          account_id,
          type
        ]
      );
      await client.query(
        `UPDATE clusters
        SET number_of_copier = number_of_copier + $1
        WHERE id = $2`,
        [
          -1,
          contract.rows[0].cluster_id
        ]
      )
    }
    await client.query(
      `DELETE FROM accounts
      WHERE account_id = $1
      AND type = $2
      AND user_id = $3`,
      [
        account_id,
        type,
        user_id
      ]
    );
    await res.status(200).send("ok");
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

exports.getMyAccounts = async (req, res) => {
  try {
    const user_id = req.user.id;
    const data = await client.query(
      `SELECT account_name,
      account_id,
      account_balance,
      total_pl_amount,
      type,
      win_count,
      lose_count,
      registered_at
      FROM accounts
      WHERE user_id = $1`,
      [
        user_id
      ]
    );
    const encryptedResponse = encryptWithSymmetricKey(data.rows);
    await res.status(200).send({ encrypted: encryptedResponse });
  }
  catch {
    await res.status(501).send("Server Error!");
  }
}

