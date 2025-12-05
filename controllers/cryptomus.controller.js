const axios = require("axios");
const qs = require("qs");
const crypto = require("crypto");
const client = require("../config/db/db.js");
const { v5: uuidv5 } = require("uuid");
const moment = require("moment");
const { getSocketInstance, socketUsers } = require("../socket/socket");
const {
  createOrderId,
  createPayoutOrderId,
} = require("../config/utils/createOrderId");
const {
  decryptData,
  encryptWithSymmetricKey,
} = require("../config/utils/encryptFunction.js");

const MY_NAMESPACE = uuidv5("https://dash.ticksync.io/", uuidv5.DNS);
const SERVER_URL = process.env.SERVER_URL;
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY;
const PAYOUT_API_KEY = process.env.PAYOUT_API_KEY;
const MERCHANT_ID = process.env.MERCHANT_ID;

function generateSign(data, apiKey) {
  const jsonData = JSON.stringify(data);
  const base64Data = Buffer.from(jsonData).toString("base64");
  const sign = crypto
    .createHash("md5")
    .update(base64Data + apiKey)
    .digest("hex");
  return sign;
}

const updateSubscription = async (user_id, value) => {
  await client.query(
    `UPDATE users
      SET subscription = $1
      WHERE id = $2`,
    [value, user_id]
  );
};

const updateProgressSubscription = async (user_id, value) => {
  const user = await client.query(
    `UPDATE users
    SET progress_subscription = $1
    WHERE id = $2
    RETURNING *`,
    [value, user_id]
  );
  return user.rows[0];
};

const updateUserRemainBalanceAndPaidAmount = async (
  user_id,
  payment_type,
  value,
  paid_amount,
  affiliate_user_id,
  percentage
) => {
  if (payment_type === "new" || payment_type === "customize") {
    await client.query(
      `UPDATE users
      SET remain_balance = $1,
      paid_amount = paid_amount + $2
      WHERE id = $3`,
      [parseFloat(value.toFixed(1)), paid_amount, user_id]
    );
  }
  await client.query(
    `UPDATE users
    SET balance = balance + $1,
    total_earned = total_earned + $2
    WHERE id = $3`,
    [
      (paid_amount * percentage) / 100,
      (paid_amount * percentage) / 100,
      affiliate_user_id,
    ]
  );
};

const insertPayment = async (
  user_id,
  plan,
  count,
  formattedDate,
  data,
  promoCode,
  payment_type
) => {
  await client.query(
    `INSERT INTO payment
    ( uuid,
    order_id,
    pay_amount,
    payment_status,
    status_description,
    plan,
    count,
    user_id,
    invoice_url,
    created_at,
    promo_code,
    payment_type)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      data.uuid,
      data.order_id,
      data.amount,
      "Created",
      data.payment_status,
      plan,
      count,
      user_id,
      data.url,
      formattedDate,
      promoCode,
      payment_type,
    ]
  );
};

const deletePayment = async (order_id) => {
  await client.query(
    `DELETE FROM payment
      WHERE order_id = $1`,
    [order_id]
  );
};

const updateUserWithdraws = async (user_id, value) => {
  const user = await client.query(
    `UPDATE users
    SET payout_amount = payout_amount + $1,
    balance = $2
    WHERE id = $3
    RETURNING *`,
    [value, 0, user_id]
  );
  return user.rowCount > 0 ? user.rowCount[0] : {};
};

const sendExpiredSocketMessage = async (
  user_id,
  order_id,
  formattedDate,
  data,
  updated_user
) => {
  const io = getSocketInstance();
  const secret_name = JSON.stringify({
    time: moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
    type: "payment_expired",
    order_id: order_id,
  });
  const uniqueId2 = uuidv5(secret_name, MY_NAMESPACE);
  const message = await client.query(
    `INSERT INTO notifications
      (id, receiver_id, message, read, time, type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
    [
      uniqueId2,
      user_id,
      "Payment order " +
        order_id +
        " expired at " +
        moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
      false,
      formattedDate,
      "payment_expired",
    ]
  );
  if (socketUsers[user_id]) {
    data.payment_status = "expired";
    const encryptedResponse = encryptWithSymmetricKey({
      message: message.rows[0],
      data: data,
      user: updated_user,
    });
    io.to(user_id).emit("payment_expired", { encrypted: encryptedResponse });
  }
};

const sendFailSocketMessage = async (
  user_id,
  order_id,
  formattedDate,
  data,
  updated_user
) => {
  const io = getSocketInstance();
  const secret_name = JSON.stringify({
    time: moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
    type: "payment_fail",
    order_id: order_id,
  });
  const uniqueId2 = uuidv5(secret_name, MY_NAMESPACE);
  const message = await client.query(
    `INSERT INTO notifications
      (id, receiver_id, message, read, time, type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
    [
      uniqueId2,
      user_id,
      "Payment order " +
        order_id +
        " failed at " +
        moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
      false,
      formattedDate,
      "payment_fail",
    ]
  );
  if (socketUsers[user_id]) {
    data.payment_status = "fail";
    const encryptedResponse = encryptWithSymmetricKey({
      message: message.rows[0],
      data: data,
      user: updated_user,
    });
    io.to(user_id).emit("payment_fail", { encrypted: encryptedResponse });
  }
};

const sendPaidSocketMessage = async (
  user_id,
  order_id,
  formattedDate,
  data,
  updated_user
) => {
  const io = getSocketInstance();
  const secret_name = JSON.stringify({
    time: moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
    type: "payment_paid",
    order_id: order_id,
  });
  const uniqueId = uuidv5(secret_name, MY_NAMESPACE);
  const messages = await client.query(
    `INSERT INTO notifications
      (id, receiver_id, message, read, time, type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
    [
      uniqueId,
      user_id,
      "Payment order " +
        order_id +
        " finished at " +
        moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
      false,
      formattedDate,
      "payment_paid",
    ]
  );
  if (socketUsers[user_id]) {
    const encryptedResponse = encryptWithSymmetricKey({
      data: data,
      message: messages.rows[0],
      user: updated_user,
    });
    io.to(user_id).emit("payment_paid", { encrypted: encryptedResponse });
  }
};

const sendPaidPayoutSocketMessage = async (
  user_id,
  order_id,
  formattedDate,
  data,
  updated_user
) => {
  const io = getSocketInstance();
  const secret_name = JSON.stringify({
    time: moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
    type: "payout_paid",
    order_id: order_id,
  });
  const uniqueId = uuidv5(secret_name, MY_NAMESPACE);
  const messages = await client.query(
    `INSERT INTO notifications
      (id, receiver_id, message, read, time, type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
    [
      uniqueId,
      user_id,
      "Payout order " +
        order_id +
        " finished at " +
        moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
      false,
      formattedDate,
      "payout_paid",
    ]
  );

  if (socketUsers[user_id]) {
    const encryptedResponse = encryptWithSymmetricKey({
      data: data,
      message: messages.rows[0],
      user: updated_user,
    });
    io.to(user_id).emit("payout_paid", { encrypted: encryptedResponse });
  }
};

exports.checkPromoCode = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { promoCode } = decryptedData;
    const affiliate_code = await client.query(
      `SELECT * FROM affiliate_code
      WHERE discount_code = $1`,
      [promoCode]
    );
    if (affiliate_code.rowCount > 0) {
      const code_info = affiliate_code.rows[0];
      const created_at = code_info.created_at;
      const unit_time = 24 * 60 * 60 * 1000;
      const discount_period = code_info.discount_period;
      const difference_time =
        new Date(created_at).getTime() +
        discount_period * unit_time -
        new Date().getTime();
      const current_number_of_users = parseInt(
        code_info.current_number_of_users
      );
      const max_number_of_users = parseInt(code_info.max_number_of_users);
      if (difference_time < 0) {
        await res.status(202).send("This promo code has been expired.");
        return;
      }
      if (current_number_of_users + 1 > max_number_of_users) {
        await res
          .status(202)
          .send(
            "The maximum number of users who can utilize the promo code has been exceeded."
          );
        return;
      }
      const encryptedResponse = encryptWithSymmetricKey(affiliate_code.rows[0]);
      await res.status(200).send({ encrypted: encryptedResponse });
    } else {
      await res.status(202).send("Invalid Promo Code.");
    }
  } catch {
    await res.sendStatus(501);
  }
};

exports.makeSubscription = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { count, plan, promoCode } = decryptedData;
    const price_list = await client.query(
      `SELECT * FROM price_list
      ORDER BY id`
    );
    let percentage = 1;
    if (promoCode) {
      const code_info = await client.query(
        `SELECT * FROM affiliate_code
        WHERE discount_code = $1`,
        [promoCode]
      );
      if (code_info.rowCount > 0) {
        percentage = 1 - code_info.rows[0].discount_percentage / 100;
      }
    }
    const price =
      plan === 0
        ? count * price_list.rows[0].price * percentage
        : count * price_list.rows[1].price * 12 * percentage;
    if (parseFloat(price.toFixed(1)) === 0) {
      const nowDate = new Date();
      const formattedDate = nowDate.toISOString();
      const futureDate = nowDate;
      const subscription_price =
        plan === 0
          ? count * price_list.rows[0].price
          : count * price_list.rows[1].price * 12;
      if (plan === 0) futureDate.setDate(futureDate.getDate() + 30);
      if (plan === 1) futureDate.setFullYear(futureDate.getFullYear() + 1);
      const value = {
        isExist: true,
        count: count,
        plan: plan === 0 ? "monthly" : "annually",
        amount: parseFloat(subscription_price.toFixed(1)),
        next_billing_date: futureDate,
        paid_at: formattedDate,
        payment_status: "paid",
      };
      await updateSubscription(req.user.id, value);
      const updated_user = await updateProgressSubscription(req.user.id, value);
      await client.query(
        `INSERT INTO payment
        ( uuid,
        order_id,
        pay_amount,
        payment_status,
        status_description,
        plan,
        count,
        user_id,
        payer_currency,
        created_at,
        promo_code,
        payment_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          "",
          createOrderId(req.user.id, count),
          0,
          "Paid",
          "paid",
          plan === 0 ? "monthly" : "annually",
          count,
          req.user.id,
          "BALANCE",
          formattedDate,
          promoCode,
          "new",
        ]
      );
      await client.query(
        `UPDATE affiliate_code
      SET current_number_of_users = current_number_of_users + 1
      WHERE discount_code = $1`,
        [promoCode]
      );
      const encryptedResponse = encryptWithSymmetricKey({ user: updated_user });
      await res.status(201).send({ encrypted: encryptedResponse });
    } else {
      const subscription = req.user.subscription;
      const requestData = {
        amount: price.toFixed(1),
        currency: "USD",
        name: "Subscription Payment",
        period: plan === 0 ? "monthly" : "annually",
        order_id: createOrderId(req.user.id, count),
        subtract: "100",
        url_callback: `${SERVER_URL}/api/cryptomus/webhook`,
        url_success: `${SERVER_URL}`,
        is_payment_multiple: true,
        lifetime: 360,
        additional_data: JSON.stringify({
          user_id: req.user.id,
          promo_code: promoCode,
        }),
      };
      const SIGN_KEY = generateSign(requestData, PAYMENT_API_KEY);
      await axios
        .post(`https://api.cryptomus.com/v1/payment`, requestData, {
          headers: {
            "Content-Type": "application/json",
            merchant: MERCHANT_ID,
            sign: SIGN_KEY,
          },
        })
        .then(async (response) => {
          if (response.status === 200) {
            const nowDate = new Date();
            const formattedDate = nowDate.toISOString();
            await insertPayment(
              req.user.id,
              plan === 0 ? "monthly" : "annually",
              count,
              formattedDate,
              response.data.result,
              promoCode,
              "new"
            );
            if (!subscription.isExist) {
              const subscription_value = {
                isExist: false,
                payment_status: "created",
              };
              await updateSubscription(req.user.id, subscription_value);
            }
            const progress_value = {
              isExist: false,
              payment_status: "created",
            };
            const user = await updateProgressSubscription(
              req.user.id,
              progress_value
            );
            const encryptedResponse = encryptWithSymmetricKey({
              invoice_url: response.data.result.url,
              user: user,
            });
            await res.status(200).send({ encrypted: encryptedResponse });
          }
        });
    }
  } catch {
    await res.status(501).send("Server Error!");
  }
};

exports.webhook = async (req, res) => {
  try {
    const response_data = req.body;
    const nowDate = new Date();
    const formattedDate = nowDate.toISOString();
    const price_list = await client.query(
      `SELECT * FROM price_list
      ORDER BY id`
    );
    const order_id = response_data.order_id;
    const payment_data = await client.query(
      `SELECT *
      FROM payment
      WHERE order_id = $1`,
      [order_id]
    );
    const user_id = payment_data.rows[0].user_id;
    switch (response_data.status) {
      case "confirm_check":
        if (response_data.type === "payment") {
          const confirm_payment = await client.query(
            `UPDATE payment
            SET payment_status = $1
            WHERE order_id = $2
            RETURNING *`,
            ["Pending", order_id]
          );
        }
        console.log("confirm_check");
        break;
      case "paid":
        if (response_data.type === "payment") {
          const user = await client.query(
            `SELECT affiliate_user_id,
            subscription
            FROM users
            WHERE id = $1`,
            [user_id]
          );
          const paid_payment = await client.query(
            `UPDATE payment
            SET payment_status = $1,
            paid_at = $2,
            network = $3,
            currency = $4,
            currency_amount = $5,
            actually_paid_amount = $6,
            actually_paid_currency_amount = $7,
            merchant_currency_amount = $8,
            payer_currency = $9,
            sign = $10,
            commission = $11,
            status_description = $12,
            affiliate_user_id = $13,
            affiliate_percentage = $14
            WHERE order_id = $15
            RETURNING *`,
            [
              "Paid",
              formattedDate,
              response_data.network,
              response_data.currency,
              response_data.payer_amount,
              response_data.payment_amount_usd,
              response_data.payment_amount,
              response_data.merchant_amount,
              response_data.payer_currency,
              response_data.sign,
              response_data.commission,
              response_data.status,
              user.rows[0].affiliate_user_id,
              10,
              order_id,
            ]
          );
          const remain_timestamp = user.rows[0].subscription.isExist
            ? new Date(user.rows[0].subscription.next_billing_date).getTime() -
              nowDate.getTime()
            : 0;
          // let remain_price = 0;
          // if (remain_timestamp > 0) {
          //   const current_count = user.rows[0].subscription.count;
          //   const current_plan = user.rows[0].subscription.plan;
          //   const new_count = paid_payment.rows[0].count;
          //   if (current_count > new_count) {
          //     const unit_timestamp = 24 * 60 * 60 * 1000;
          //     const days = remain_timestamp / unit_timestamp;
          //     remain_price = current_plan === "monthly" ? (days / 30) * (price_list.rows[0].price * (current_count - new_count)) : (days / 365) * (price_list.rows[1].price * 12 * (current_count - new_count));
          //   }
          // }
          const billing_date =
            remain_timestamp > 0
              ? user.rows[0].subscription.isExist
                ? user.rows[0].subscription.paid_at
                : nowDate
              : nowDate;
          const futureDate = new Date(billing_date);
          const plan = paid_payment.rows[0].plan;
          if (plan === "monthly") futureDate.setDate(futureDate.getDate() + 30);
          if (plan === "annually")
            futureDate.setFullYear(futureDate.getFullYear() + 1);
          await updateUserRemainBalanceAndPaidAmount(
            user_id,
            paid_payment.rows[0].payment_type,
            0,
            paid_payment.rows[0].pay_amount,
            user.rows[0].affiliate_user_id,
            paid_payment.rows[0].affiliate_percentage
          );
          const price =
            plan === "monthly"
              ? payment_data.rows[0].count * price_list.rows[0].price
              : payment_data.rows[0].count * price_list.rows[1].price * 12;
          const value = {
            isExist: true,
            count: payment_data.rows[0].count,
            plan: payment_data.rows[0].plan,
            amount: parseFloat(price.toFixed(1)),
            next_billing_date: futureDate,
            paid_at: formattedDate,
            payment_status: "paid",
          };
          await updateSubscription(user_id, value);
          const updated_user = await updateProgressSubscription(user_id, value);
          if (payment_data.rows[0].promo_code) {
            await client.query(
              `UPDATE affiliate_code
              SET current_number_of_users = current_number_of_users + 1
              WHERE discount_code = $1`,
              [payment_data.rows[0].promo_code]
            );
          }
          await sendPaidSocketMessage(
            user_id,
            order_id,
            formattedDate,
            paid_payment.rows[0],
            updated_user
          );
        }
        console.log("paid");
        break;
      case "paid_over":
        if (response_data.type === "payment") {
          const user = await client.query(
            `SELECT subscription
            FROM users
            WHERE id = $1`,
            [user_id]
          );
          const paid_payment = await client.query(
            `UPDATE payment
            SET payment_status = $1,
            paid_at = $2,
            network = $3,
            currency = $4,
            currency_amount = $5,
            actually_paid_amount = $6,
            actually_paid_currency_amount = $7,
            merchant_currency_amount = $8,
            payer_currency = $9,
            sign = $10,
            commission = $11,
            status_description = $12,
            affiliate_user_id = $13,
            affiliate_percentage = $14
            WHERE order_id = $15
            RETURNING *`,
            [
              "Paid",
              formattedDate,
              response_data.network,
              response_data.currency,
              response_data.payer_amount,
              response_data.payment_amount_usd,
              response_data.payment_amount,
              response_data.merchant_amount,
              response_data.payer_currency,
              response_data.sign,
              response_data.commission,
              response_data.status,
              user.rows[0].affiliate_user_id,
              10,
              order_id,
            ]
          );
          let remain_price =
            response_data.payment_amount_usd - response_data.amount;
          const remain_timestamp = user.rows[0].subscription.isExist
            ? new Date(user.rows[0].subscription.next_billing_date).getTime() -
              nowDate.getTime()
            : 0;
          // if (remain_timestamp > 0) {
          //   const current_count = user.rows[0].subscription.count;
          //   const current_plan = user.rows[0].subscription.plan;
          //   const new_count = paid_payment.rows[0].count;
          //   if (current_count > new_count) {
          //     const unit_timestamp = 24 * 60 * 60 * 1000;
          //     const days = remain_timestamp / unit_timestamp;
          //     remain_price += (current_plan === "monthly" ? (days / 30) * (price_list.rows[0].price * (current_count - new_count)) : (days / 365) * (price_list.rows[1].price * 12 * (current_count - new_count)));
          //   }
          // }
          const billing_date =
            remain_timestamp > 0
              ? user.rows[0].subscription.isExist
                ? user.rows[0].subscription.paid_at
                : nowDate
              : nowDate;
          const futureDate = new Date(billing_date);
          const plan = paid_payment.rows[0].plan;
          if (plan === "monthly") futureDate.setDate(futureDate.getDate() + 30);
          if (plan === "annually")
            futureDate.setFullYear(futureDate.getFullYear() + 1);
          await updateUserRemainBalanceAndPaidAmount(
            user_id,
            paid_payment.rows[0].payment_type,
            remain_price,
            paid_payment.rows[0].pay_amount,
            user.rows[0].affiliate_user_id,
            paid_payment.rows[0].affiliate_percentage
          );
          const price =
            plan === "monthly"
              ? payment_data.rows[0].count * price_list.rows[0].price
              : payment_data.rows[0].count * price_list.rows[1].price * 12;
          const value = {
            isExist: true,
            count: payment_data.rows[0].count,
            plan: payment_data.rows[0].plan,
            amount: parseFloat(price.toFixed(1)),
            next_billing_date: futureDate,
            paid_at: formattedDate,
            payment_status: "paid",
          };
          await updateSubscription(user_id, value);
          const updated_user = await updateProgressSubscription(user_id, value);
          if (payment_data.rows[0].promo_code) {
            await client.query(
              `UPDATE affiliate_code
              SET current_number_of_users = current_number_of_users + 1
              WHERE promo_code = $1`,
              [payment_data.rows[0].promo_code]
            );
          }
          await sendPaidSocketMessage(
            user_id,
            order_id,
            formattedDate,
            paid_payment.rows[0],
            updated_user
          );
        }
        console.log("paid_over");
        break;
      case "fail":
        if (response_data.type === "payment") {
          const user = await client.query(
            `SELECT subscription
            FROM users
            WHERE id = $1`,
            [user_id]
          );
          if (!user.rows[0].subscription.isExist) {
            await updateSubscription(user_id, { isExist: false });
          }
          const updated_user = await updateProgressSubscription(user_id, {
            isExist: false,
          });
          await deletePayment(order_id);
          await sendFailSocketMessage(
            user_id,
            order_id,
            formattedDate,
            response_data,
            updated_user
          );
        }
        console.log("fail");
        break;
      case "wrong_amount":
        if (response_data.type === "payment") {
          await client.query(
            `UPDATE payment
            SET payment_status = $1,
            status_description = $2
            WHERE order_id = $3
            RETURNING *`,
            ["Wrong Amount", response_data.status, order_id]
          );
        }
        console.log("wrong_amount");
        break;
      case "wrong_amount_waiting":
        if (response_data.type === "payment") {
          await client.query(
            `UPDATE payment
            SET payment_status = $1,
            status_description = $2
            WHERE order_id = $3
            RETURNING *`,
            ["Wrong Amount", response_data.status, order_id]
          );
        }
        console.log("wrong_amount_waiting");
        break;
      case "cancel":
        if (response_data.type === "payment") {
          const user = await client.query(
            `SELECT subscription,
            affiliate_user_id
            FROM users
            WHERE id = $1`,
            [user_id]
          );
          await client.query(
            `UPDATE payment
            SET payment_status = $1,
            sign = $2,
            status_description = $3,
            affiliate_user_id = $4,
            affiliate_percentage = $5
            WHERE order_id = $6
            RETURNING *`,
            [
              "Cancel",
              response_data.sign,
              response_data.status,
              user.rows[0].affiliate_user_id,
              10,
              order_id,
            ]
          );
          if (!user.rows[0].subscription.isExist) {
            await updateSubscription(user_id, { isExist: false });
          }
          const updated_user = await updateProgressSubscription(user_id, {
            isExist: false,
          });
          // await deletePayment(order_id);
          await sendExpiredSocketMessage(
            user_id,
            order_id,
            formattedDate,
            response_data,
            updated_user
          );
        }
        console.log("cancel");
        break;
      case "system_fail":
        if (response_data.type === "payment") {
          const user = await client.query(
            `SELECT subscription
            FROM users
            WHERE id = $1`,
            [user_id]
          );
          if (!user.rows[0].subscription.isExist) {
            await updateSubscription(user_id, { isExist: false });
          }
          const updated_user = await updateProgressSubscription(user_id, {
            isExist: false,
          });
          await deletePayment(order_id);
          await sendFailSocketMessage(
            user_id,
            order_id,
            formattedDate,
            response_data,
            updated_user
          );
        }
        console.log("system_fail");
        break;
      case "refund_process":
        console.log("refund_process");
        break;
      case "refund_fail":
        console.log("refund_fail");
        break;
      case "refund_paid":
        console.log("refund_paid");
        break;
    }
    await res.sendStatus(200);
  } catch {
    await res.sendStatus(501);
  }
};

exports.getCurrentPlan = async (req, res) => {
  try {
    const remain_balance = req.user.remain_balance;
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { count } = decryptedData;
    const nowDate = new Date();
    const subscription = req.user.subscription;
    let additional_price = 0;
    const remain_timestamp = subscription.isExist
      ? new Date(subscription.next_billing_date).getTime() - nowDate.getTime()
      : 0;
    const price_list = await client.query(
      `SELECT * FROM price_list
      ORDER BY id`
    );
    const current_count = subscription.count;
    const new_count = count;
    const current_plan = subscription.plan;
    if (remain_timestamp > 0) {
      const unit_timestamp = 24 * 60 * 60 * 1000;
      const days = remain_timestamp / unit_timestamp;
      additional_price =
        current_plan === "monthly"
          ? (days / 30) *
            (price_list.rows[0].price * (new_count - current_count))
          : (days / 365) *
            (price_list.rows[1].price * 12 * (new_count - current_count));
    }
    const billing_date =
      remain_timestamp > 0
        ? subscription.isExist
          ? subscription.paid_at
          : nowDate
        : nowDate;
    const futureDate = new Date(billing_date);
    if (current_plan === "monthly")
      futureDate.setDate(futureDate.getDate() + 30);
    if (current_plan === "annually")
      futureDate.setFullYear(futureDate.getFullYear() + 1);
    const encryptedResponse = encryptWithSymmetricKey({
      add_price: parseFloat(additional_price.toFixed(1)),
      remain_balance: -remain_balance,
      billing_date: futureDate,
    });
    await res.status(200).send({ encrypted: encryptedResponse });
  } catch {
    await res.sendStatus(501);
  }
};

exports.customizeSubscription = async (req, res) => {
  try {
    const remain_balance = req.user.remain_balance;
    const subscription = req.user.subscription;
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { count, promoCode } = decryptedData;
    let percentage = 1;
    if (promoCode) {
      const code_info = await client.query(
        `SELECT * FROM affiliate_code
        WHERE discount_code = $1`,
        [promoCode]
      );
      if (code_info.rowCount > 0) {
        percentage = 1 - code_info.rows[0].discount_percentage / 100;
      }
    }
    const accounts = await client.query(
      `SELECT user_id
        FROM accounts
        WHERE user_id = $1`,
      [req.user.id]
    );
    if (accounts.rowCount > count + 2) {
      await res
        .status(201)
        .send(
          "Currently, you have accounts registered, which exceeds the limit for the selected plan. To customize plan, you need to remove some accounts."
        );
    } else {
      const price_list = await client.query(
        `SELECT * FROM price_list
          ORDER BY id`
      );
      let price = 0;
      price =
        subscription.plan === "monthly"
          ? count * price_list.rows[0].price
          : count * price_list.rows[1].price * 12;
      const today = new Date();
      const remain_timestamp = subscription.isExist
        ? new Date(subscription.next_billing_date).getTime() - today.getTime()
        : 0;
      if (remain_timestamp > 0) {
        const unit_timestamp = 24 * 60 * 60 * 1000;
        const days = remain_timestamp / unit_timestamp;
        if (subscription.count > count) {
          const remain_price =
            subscription.plan === "monthly"
              ? (days / 30) *
                (price_list.rows[0].price * (subscription.count - count))
              : (days / 365) *
                (price_list.rows[1].price * 12 * (subscription.count - count));
          price = remain_price;
        }
        if (subscription.count < count) {
          const additional_price =
            subscription.plan === "monthly"
              ? (days / 30) *
                (price_list.rows[0].price * (count - subscription.count))
              : (days / 365) *
                (price_list.rows[1].price * 12 * (count - subscription.count));
          price = additional_price;
        }
      }
      price = (price - remain_balance) * percentage;
      if (parseFloat(price.toFixed(1)) > 0) {
        const requestData = {
          amount: price.toFixed(1),
          currency: "USD",
          name: "Customize Subscription Payment",
          period: subscription.plan,
          order_id: createOrderId(req.user.id, count),
          subtract: "100",
          url_callback: `${SERVER_URL}/api/cryptomus/webhook`,
          url_success: process.env.FRONTEND_URL || "http://localhost:5173",
          is_payment_multiple: true,
          lifetime: 360,
          additional_data: JSON.stringify({
            user_id: req.user.id,
            promo_code: promoCode,
          }),
        };
        const SIGN_KEY = generateSign(requestData, PAYMENT_API_KEY);
        await axios
          .post(`https://api.cryptomus.com/v1/payment`, requestData, {
            headers: {
              "Content-Type": "application/json",
              merchant: MERCHANT_ID,
              sign: SIGN_KEY,
            },
          })
          .then(async (response) => {
            if (response.status === 200) {
              await insertPayment(
                req.user.id,
                subscription.plan,
                count,
                today.toISOString(),
                response.data.result,
                promoCode,
                "customize"
              );
              const value = {
                isExist: false,
                payment_status: "created",
              };
              const user = await updateProgressSubscription(req.user.id, value);
              const encryptedResponse = encryptWithSymmetricKey({
                invoice_url: response.data.result.url,
                user: user,
              });
              await res.status(200).send({ encrypted: encryptedResponse });
            }
          });
      } else {
        let amount =
          subscription.plan === "monthly"
            ? count * price_list.rows[0].price
            : count * price_list.rows[1].price * 12;
        const futureDate = new Date(subscription.paid_at);
        const value = {
          plan: subscription.plan,
          count: count,
          amount: amount,
          isExist: true,
          payment_status: "paid",
          paid_at: subscription.paid_at,
          next_billing_date:
            subscription.plan === "monthly"
              ? new Date(futureDate.setDate(futureDate.getDate() + 30))
              : new Date(futureDate.setFullYear(futureDate.getFullYear() + 1)),
        };
        const user = await client.query(
          `UPDATE users
            SET subscription = $1,
            remain_balance = remain_balance + $2
            WHERE id = $3
            RETURNING *`,
          [value, -parseFloat(price.toFixed(1)), req.user.id]
        );
        await client.query(
          `INSERT INTO payment
          ( uuid,
          order_id,
          pay_amount,
          payment_status,
          status_description,
          plan,
          count,
          user_id,
          payer_currency,
          created_at,
          promo_code,
          payment_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *`,
          [
            "",
            createOrderId(req.user.id, count),
            0,
            "Paid",
            "paid",
            subscription.plan,
            count,
            req.user.id,
            "BALANCE",
            today.toISOString(),
            promoCode,
            "customize",
          ]
        );
        await client.query(
          `UPDATE affiliate_code
          SET current_number_of_users = current_number_of_users + 1
          WHERE discount_code = $1`,
          [promoCode]
        );
        const encryptedResponse = encryptWithSymmetricKey({
          user: user.rows[0],
        });
        await res.status(202).send({ encrypted: encryptedResponse });
      }
    }
  } catch {
    await res.status(501).send("Server Error!");
  }
};

exports.getNewPayment = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id } = decryptedData;
    const data = await client.query(
      `SELECT *
      FROM payment
      WHERE user_id = $1
      AND payment_status <> $2`,
      [user_id, "finished"]
    );
    const user_data = await client.query(
      `SELECT * FROM users
      WHERE id = $1`,
      [user_id]
    );
    const encryptedResponse = encryptWithSymmetricKey({
      data: data.rows[0],
      user: user_data.rows[0],
    });
    await res.status(200).send({ encrypted: encryptedResponse });
  } catch {
    await res.status(501).send("Server Error!");
  }
};

exports.getPaymentHistory = async (req, res) => {
  try {
    const decryptedData = JSON.parse(decryptData(req.body.encrypted));
    const { user_id, current_page, display_count } = decryptedData;
    const offset = display_count * current_page;
    const data = await client.query(
      `SELECT * FROM payment
      WHERE user_id = $1
      ORDER BY id ASC
      LIMIT $2 OFFSET $3`,
      [user_id, display_count, offset]
    );
    const totalCount = await client.query(
      `SELECT COUNT(*) AS total_count FROM payment WHERE user_id = $1`,
      [user_id]
    );
    const total_count = totalCount.rows[0].total_count;
    const encryptedResponse = encryptWithSymmetricKey({
      data: data.rows,
      total_count: total_count,
    });
    await res.status(200).send({ encrypted: encryptedResponse });
  } catch {
    await res.status(501).send("Server Error!");
  }
};

const insertWithdraw = async (
  payout_amount,
  user_id,
  address,
  order_id,
  uuid
) => {
  await client.query(
    `INSERT INTO withdraws
    (payout_amount, user_id, address, order_id, uuid)
    VALUES ($1, $2, $3, $4, $5)`,
    [payout_amount, user_id, address, order_id, uuid]
  );
};

exports.sendRequestWithdrawal = async (req, res) => {
  const user_id = req.user.id;
  const decryptedData = JSON.parse(decryptData(req.body.encrypted));
  const { network, currency, address } = decryptedData;
  console.log(network, address);
  const withdraw_amount = req.user.balance;
  if (withdraw_amount >= 5) {
    const requestData = {
      amount: withdraw_amount.toString(),
      currency: "USD",
      order_id: createPayoutOrderId(req.user.id, parseInt(withdraw_amount)),
      is_subtract: "0",
      address: address,
      network: network,
      to_currency: currency,
      url_callback: `${SERVER_URL}/api/cryptomus/payoutwebhook`,
    };
    console.log(requestData);
    const SIGN_KEY = generateSign(requestData, PAYOUT_API_KEY);
    await axios
      .post(`https://api.cryptomus.com/v1/payout`, requestData, {
        headers: {
          "Content-Type": "application/json",
          merchant: MERCHANT_ID,
          sign: SIGN_KEY,
        },
      })
      .then(async (response) => {
        console.log(response.data);
        if (response.status === 200) {
          await insertWithdraw(
            withdraw_amount,
            user_id,
            address,
            response.data.result.order_id,
            response.data.result.uuid
          );
          await res.sendStatus(200);
        }
      })
      .catch(async (err) => {
        if (
          err.status === 422 &&
          err.response.data.message === "Not enough funds."
        )
          await res
            .status(201)
            .send(
              "You cannot receive funds in this currency as the site does not have sufficient balance."
            );
        else await res.sendStatus(501);
      });
  } else {
    await res.status(201).send("The withdraw amount must exceed $5.");
  }
};

exports.payoutWebhook = async (req, res) => {
  try {
    const response_data = req.body;
    console.log(response_data);
    const today = new Date();
    const formattedDate = today.toISOString();
    const order_id = response_data.order_id;
    const withdraw_data = await client.query(
      `SELECT *
      FROM withdraws
      WHERE order_id = $1`,
      [order_id]
    );
    const user_id = withdraw_data.rows[0].user_id;
    switch (response_data.status) {
      case "process":
        console.log("payout process");
        break;
      case "check":
        console.log("payout check");
        break;
      case "paid":
        if ((response_data.type = "payout")) {
          const paid_payout = await client.query(
            `UPDATE withdraws
            SET payout_status = $1,
            paid_at = $2,
            network = $3,
            currency = $4,
            payer_currency = $5,
            currency_amount = $6,
            sign = $7,
            commission = $8,
            txid = $9
            WHERE order_id = $10
            RETURNING *`,
            [
              "Paid",
              formattedDate,
              response_data.network,
              response_data.currency,
              response_data.payer_currency,
              response_data.merchant_amount,
              response_data.sign,
              response_data.commission,
              response_data.txid,
              order_id,
            ]
          );
          const updated_user = await updateUserWithdraws(
            user_id,
            paid_payout.rows[0].payout_amount
          );
          await sendPaidPayoutSocketMessage(
            user_id,
            order_id,
            formattedDate,
            paid_payout.rows[0],
            updated_user
          );
        }
        console.log("payout paid");
        break;
      case "fail":
        break;
      case "cancel":
        break;
      case "system_fail":
        break;
    }
    await res.sendStatus(200);
  } catch {
    await res.sendStatus(501);
  }
};
