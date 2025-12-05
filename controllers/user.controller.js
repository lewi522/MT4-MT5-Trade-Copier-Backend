const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const client = require("../config/db/db.js");
const getToken = require("../config/utils/getToken.js");
const {
  decryptData,
  encryptWithSymmetricKey,
} = require("../config/utils/encryptFunction.js");
const {
  emailExists,
  firstUser,
  matchPassword,
} = require("../config/helper.js");
const jwt = require("jsonwebtoken");
const emailjs = require("@emailjs/nodejs");
const config = require("../config/config.js");

//Register Endpoint
exports.register = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { email, password } = decryptedData.user_data;
    const aff_user_id = decryptedData.aff_user_id;
    console.log(email, password, aff_user_id);
    const userExists = await emailExists(email);
    const isFirstUser = await firstUser();
    const created_at = new Date();
    const formattedDate = created_at.toISOString();
    if (!userExists) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      const manageRole = isFirstUser ? "admin" : "user";
      const data = await client.query(
        `INSERT INTO users 
        (email, 
        password,
        first_name,
        last_name, 
        username, 
        created_at, 
        manage_role, 
        verify, 
        follow_account, 
        avatar, 
        balance,
        subscription,
        progress_subscription,
        country,
        description,
        active_affiliate,
        payout_amount,
        paid_amount,
        affiliate_user_id,
        remain_balance,
        total_earned,
        notification_setting) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) 
        RETURNING id, email, username`,
        [
          email,
          hash,
          "",
          "",
          "",
          formattedDate,
          manageRole,
          false,
          [],
          "",
          0,
          {
            isExist: false,
          },
          {
            isExist: false,
          },
          "select_country",
          "",
          false,
          0,
          0,
          aff_user_id ? parseInt(aff_user_id) : 0,
          0,
          0,
          {
            open_trade: false,
            close_trade: false,
            modify_trade: false,
          },
        ]
      );
      if (data.rowCount === 0)
        await res.status(201).send("Database Insert Error!");
      else {
        const token = getToken(data.rows[0]);
        const flag = await this.sendVerifyEmail(token, data.rows[0]);
        if (flag) {
          const encryptedResponse = encryptWithSymmetricKey({
            token: token,
            user: data.rows[0],
          });
          await res.status(200).send({ encrypted: encryptedResponse });
        } else await res.status(203).send("Email Send Error!");
      }
    } else await res.status(202).send("This user already exists!");
  } catch {
    await res.status(501).send("Server error");
  }
};

//Send Verify Email Function
exports.sendVerifyEmail = async (token, user) => {
  try {
    const st = token.split(".");
    const sendToken = `?firstpart=${st[0]}&secondpart=${st[1]}&thirdpart=${st[2]}`;
    const templateParams = {
      to_name: "dear",
      from_name: "TickSync",
      recipient: user.email,
      message: config.server_url + "/user/verify/token" + sendToken,
    };
    const serviceID = process.env.EMAILJS_SERVICE_ID;
    const templateID = process.env.EMAILJS_TEMPLATE_ID_VERIFY;
    const userID = {
      publicKey: process.env.EMAILJS_PUBLIC_KEY,
      privateKey: process.env.EMAILJS_PRIVATE_KEY,
    };
    const response = await emailjs.send(
      serviceID,
      templateID,
      templateParams,
      userID
    );
    console.log(
      user.email,
      "verify email send success",
      response.status,
      response.text
    );
    return true;
  } catch (err) {
    console.log(user.email, "verify email send failed", err);
    return false;
  }
};

//Send Email Endpoint
exports.sendEmail = async (req, res) => {
  try {
    const { token, user } = req.body;
    const decryptedUser = JSON.parse(decryptData(user));
    console.log(token, decryptedUser);
    const flag = await this.sendVerifyEmail(token, decryptedUser);
    if (flag) await res.status(200).send("ok");
  } catch {
    await res.status(501).send("failed");
  }
};

//Send Verify Code Endpoint
exports.sendVerifyCode = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { email } = decryptedData;
    const randomNumber = crypto.randomInt(100000, 1000000);
    const data = await client.query(
      `UPDATE users 
        SET verify_code = ${randomNumber} 
        WHERE email = '${email}' RETURNING *`
    );
    if (data.rowCount === 0)
      res
        .status(201)
        .send("You are not registered. Please sign up with your email.");
    else {
      const templateParams = {
        to_name: data.rows[0].first_name
          ? data.rows[0].first_name + data.rows[0].last_name
          : "dear",
        from_name: "TickSync",
        recipient: email,
        message: randomNumber,
      };
      const serviceID = process.env.EMAILJS_SERVICE_ID;
      const templateID = process.env.EMAILJS_TEMPLATE_ID_CODE;
      const userID = {
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
        privateKey: process.env.EMAILJS_PRIVATE_KEY,
      };
      const response = await emailjs.send(
        serviceID,
        templateID,
        templateParams,
        userID
      );
      console.log(
        email,
        "verify code send success",
        response.status,
        response.text
      );
      res.status(200).send("success");
    }
  } catch (err) {
    res.status(501).send("Server Error");
  }
};

//Check if Verify Code is correct Endpoint
exports.checkVerifyCode = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { email, verifyCode } = decryptedData;
    const data = await client.query(
      `SELECT * FROM users 
        WHERE email = '${email}'`
    );
    if (data.rowCount === 0) await res.status(201).send("Database Error");
    else {
      if (verifyCode === data.rows[0].verify_code) {
        await res.status(200).send("ok");
      } else await res.status(202).send("Verify Code Invalid");
    }
  } catch {
    await res.status(501).send("Server Error");
  }
};

//Change Password Endpoint
exports.changePassword = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { email, password } = decryptedData;
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const data = await client.query(
      `UPDATE users 
        SET password = '${hash}'  
        WHERE email = '${email}'`
    );
    if (data.rowCount === 0) await res.status(201).send("Database Error");
    else {
      await res.status(200).send("ok");
    }
  } catch {
    await res.status(501).send("Server Error");
  }
};

//Token Verify Endpoint
exports.tokenVerification = async (req, res) => {
  try {
    let { token } = req.body;
    jwt.verify(token, config.secret, async (err, payload) => {
      if (err) await res.status(401).send("Unauthorized.");
      else {
        const data = await client.query(
          `UPDATE users 
            SET verify = TRUE 
            WHERE id = ${payload.id} RETURNING *`
        );
        if (data.rowCount === 0) await res.status(201).send("Failed.");
        else {
          const price_list = await client.query(
            `SELECT * FROM price_list
            ORDER BY id`
          );
          const encryptedResponse = encryptWithSymmetricKey({
            token: getToken(data.rows[0]),
            user: data.rows[0],
            price_list: price_list.rows,
          });
          await res.status(200).send({ encrypted: encryptedResponse });
        }
      }
    });
  } catch {
    await res.status(501).send("Server error");
  }
};

//User Login Endpoint
exports.login = async (req, res) => {
  try {
    const data = await client.query(
      `SELECT * 
        FROM users 
        WHERE id = ${req.user.id}`
    );
    if (data.rows[0].verify) {
      const messages = await client.query(
        `SELECT * FROM notifications
        WHERE receiver_id = $1
        AND read = $2`,
        [req.user.id, false]
      );
      const price_list = await client.query(
        `SELECT * FROM price_list
        ORDER BY id`
      );
      await res.status(200).send({
        token: getToken(data.rows[0]),
        user: data.rows[0],
        messages: messages.rowCount > 0 ? messages.rows : [],
        price_list: price_list.rows,
      });
    } else {
      const token = getToken(data.rows[0]);
      const flag = await this.sendVerifyEmail(token, data.rows[0]);
      if (flag) {
        await res.status(201).send({
          token: token,
          user: data.rows[0],
        });
      }
    }
  } catch {
    await res.status(501).send("Server error");
  }
};

//Login with Token when refresh website Endpoint
exports.loginWithToken = async (req, res) => {
  try {
    let { token } = req.body;
    jwt.verify(token, config.secret, async (err, payload) => {
      if (err) return await res.status(401).send("Unauthorized.");
      else {
        const data = await client.query(
          `SELECT * 
            FROM users 
            WHERE id = ${payload.id}`
        );
        console.log("user id", payload.id);
        if (data.rowCount === 0) await res.status(201).send("No User Exist");
        else {
          const messages = await client.query(
            `SELECT * FROM notifications
            WHERE read = $1
            AND receiver_id = $2
            ORDER BY time DESC
            LIMIT 5`,
            [false, payload.id]
          );
          const price_list = await client.query(
            `SELECT * FROM price_list
            ORDER BY id`
          );
          const encryptedResponse = encryptWithSymmetricKey({
            token: getToken(data.rows[0]),
            user: data.rows[0],
            messages: messages.rowCount > 0 ? messages.rows : [],
            price_list: price_list.rows,
          });
          await res.status(200).send({ encrypted: encryptedResponse });
        }
      }
    });
  } catch {
    await res.send("Server error");
  }
};

exports.updateNotification = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { id, user_id } = decryptedData;
    await client.query(
      `UPDATE notifications
      SET read = $1
      WHERE id = $2`,
      [true, id]
    );
    const data = await client.query(
      `SELECT * FROM notifications
      WHERE read = $1
      AND receiver_id = $2
      ORDER BY time DESC
      LIMIT 5`,
      [false, user_id]
    );
    const encryptedResponse = encryptWithSymmetricKey(
      data.rowCount > 0 ? data.rows : []
    );
    await res.status(200).send({ encrypted: encryptedResponse });
  } catch {
    await res.status(501).send("Server error!");
  }
};

//Account Setting

exports.getNotificationList = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id } = decryptedData;
    const data = await client.query(
      `SELECT notification_setting FROM users
      WHERE id = $1`,
      [user_id]
    );
    const encryptedResponse = encryptWithSymmetricKey(
      data.rows[0].notification_setting
    );
    await res.status(200).send({ encrypted: encryptedResponse });
  } catch {
    await res.status(501).send("Server Error!");
  }
};

exports.updateNotificationSetting = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { notification, user_id } = decryptedData;
    await client.query(
      `UPDATE users
      SET notification_setting = $1
      WHERE id = $2`,
      [notification, user_id]
    );
    await res.status(200).send("ok");
  } catch {
    await res.status(501).send("Server Error!");
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    const { avatar } = req.body;
    await client.query(
      `UPDATE users
      SET avatar = $1
      WHERE id = $2`,
      [avatar, req.user.id]
    );
    await res.status(200).send("ok");
  } catch {
    await res.status(501).send("Server error!");
  }
};

exports.deleteAvatar = async (req, res) => {
  try {
    await client.query(
      `UPDATE users
      SET avatar = $1
      WHERE id = $2`,
      ["", req.user.id]
    );
    await res.status(200).send("ok");
  } catch {
    await res.status(501).send("Server error!");
  }
};

exports.savePersonalInformation = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const description = req.body.description;
    const { first_name, last_name, email, country } = decryptedData;
    await client.query(
      `UPDATE users SET
      first_name = $1,
      last_name = $2,
      country = $3,
      description = $4
      WHERE id = $5`,
      [first_name, last_name, country, description, req.user.id]
    );
    await res.status(200).send("ok");
  } catch {
    await res.status(501).send("Server Error!");
  }
};

exports.getTradeCount = async (req, res) => {
  try {
    const user_id = req.user.id;
    const accounts = await client.query(
      `SELECT id
      FROM accounts
      WHERE user_id = $1`,
      [user_id]
    );
    let tradeCount = 0;
    accounts.rows.map((account) => {
      const history_orders = account.history_orders;
      tradeCount += history_orders?.length > 0 ? history_orders?.length : 0;
    });
    const encryptedResponse = encryptWithSymmetricKey({
      account_count: accounts.rowCount,
      trade_count: tradeCount,
    });
    await res.status(200).send({ encrypted: encryptedResponse });
  } catch {
    await res.status(501).send("server error!");
  }
};

exports.getPersonalInformation = async (req, res) => {
  try {
    const user_id = req.user.id;
    const data = await client.query(
      `SELECT first_name,
      last_name,
      email,
      country,
      description FROM users
      WHERE id = $1`,
      [user_id]
    );
    const encryptedResponse = encryptWithSymmetricKey(data.rows[0]);
    await res.status(200).send({ encrypted: encryptedResponse });
  } catch {
    await res.status(501).send("Server Error!");
  }
};

exports.changePasswordSetting = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { new_password, old_password } = decryptedData;
    const user_id = req.user.id;
    const password = req.user.password;
    const match = await matchPassword(old_password, password);
    if (!match) {
      await res.status(201).send("password mismatch");
      return;
    }
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(new_password, salt);
    await client.query(
      `UPDATE users SET
      password = $1
      WHERE id = $2`,
      [hash, user_id]
    );
    await res.status(200).send("ok");
  } catch {
    await res.status(501).send("Server Error!");
  }
};

exports.setActiveAffiliateMarketing = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id } = decryptedData;
    const user = await client.query(
      `UPDATE users
      SET active_affiliate = $1
      WHERE id = $2
      RETURNING *`,
      [true, user_id]
    );
    const encryptedResponse = encryptWithSymmetricKey(user.rows[0]);
    await res.status(200).send({ encrypted: encryptedResponse });
  } catch {
    await res.status(501).send("Server Error!");
  }
};

exports.getAffiliateMarketingData = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id } = decryptedData;
    const total_earned = req.user.total_earned;
    const balance = req.user.balance;
    const total_payout = req.user.payout_amount;
    const affiliate_users = await client.query(
      `SELECT
      (SELECT SUM(paid_amount) FROM users WHERE affiliate_user_id = '${user_id}') AS total_paid_amount,
      (SELECT COUNT(*) FROM users WHERE affiliate_user_id = '${user_id}') AS total_count`
    );

    const registered_times = affiliate_users.rows[0].total_count;
    const total_paid_amount = affiliate_users.rows[0].total_paid_amount;
    const history_data = await client.query(
      `SELECT paid_at,
      affiliate_percentage,
      pay_amount
      FROM payment
      WHERE affiliate_user_id = $1`,
      [user_id]
    );
    const data = {
      registered_times: registered_times,
      total_paid_amount: total_paid_amount || 0,
      total_earned: total_earned,
      total_payout: total_payout,
      balance: balance,
    };
    const encryptedResponse = encryptWithSymmetricKey({
      general_data: data,
      history_data: history_data.rows,
    });
    await res.status(200).send({ encrypted: encryptedResponse });
  } catch {
    await res.status(501).send("Server Error!");
  }
};
