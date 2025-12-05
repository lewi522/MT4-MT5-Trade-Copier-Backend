const client = require("../config/db/db.js");
const { v5: uuidv5 } = require("uuid");
const { getSocketInstance, socketUsers } = require("../socket/socket");
const emailjs = require("@emailjs/nodejs");
const moment = require("moment");

const MY_NAMESPACE = uuidv5("https://dash.ticksync.io/", uuidv5.DNS);

const paymentCheck = async () => {
  try {
    const users = await client.query(
      `SELECT id,
      email,
      subscription
      FROM users`
    );
    const io = getSocketInstance();
    const promises = users.rows.map(async (user) => {
      const subscription = user.subscription;
      if (subscription?.isExist) {
        if (new Date(subscription?.next_billing_date) < new Date()) {
          await client.query(
            `UPDATE contract 
            SET status = $1
            WHERE user_id = $2`,
            [false, user.id]
          );
          const temp_subscription = {
            ...user.subscription,
            payment_status: "expired",
          };
          const updated_user = await client.query(
            `UPDATE users
            SET subscription = $1
            WHERE id = $2
            RETURNING *`,
            [temp_subscription, user.id]
          );
          const today = new Date();
          const formattedDate = today.toISOString();
          const my_secret_name = JSON.stringify({
            time: moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
            type: "Subscription expired",
            user_id: user.id,
          });
          const uniqueId = uuidv5(my_secret_name, MY_NAMESPACE);
          const messages = await client.query(
            `INSERT INTO notifications
              (id, receiver_id, message, read, time, type)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING *`,
            [
              uniqueId,
              user.id,
              "Subscription is expired at " +
                moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A") +
                " You need to pay for subscription to continue to do copy trading.",
              false,
              formattedDate,
              "subscription_expired",
            ]
          );
          const templateParams = {
            to_name: user.first_name
              ? user.first_name + user.last_name
              : "dear",
            from_name: "TickSync",
            recipient: user.email,
            message:
              "Subscription is expired at " +
              moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A") +
              " You need to pay for subscription to continue to do copy trading.",
          };
          const serviceID = process.env.EMAILJS_SERVICE_ID;
          const templateID = process.env.EMAILJS_TEMPLATE_ID_NOTIFICATION;
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
            "verify code send success",
            response.status,
            response.text
          );
          if (socketUsers[user.id]) {
            console.log("Send Socket");
            io.to(user.id).emit("subscription_expired", {
              message: messages.rows[0],
              user: updated_user.rows[0],
            });
          }
        } else {
          const remain_timestamp =
            new Date(subscription.next_billing_date).getTime() -
            new Date().getTime();
          const unit_timestamp = 24 * 60 * 60 * 1000;
          const days = remain_timestamp / unit_timestamp;
          if (days < 3) {
            const today = new Date();
            const formattedDate = today.toISOString();
            const my_secret_name = JSON.stringify({
              time: moment(formattedDate).format("YYYY/MM/DD hh:mm:ss A"),
              type: "Subscription renewal warning",
              user_id: user.id,
            });
            const uniqueId = uuidv5(my_secret_name, MY_NAMESPACE);
            const messages = await client.query(
              `INSERT INTO notifications
              (id, receiver_id, message, read, time, type)
              VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING *`,
              [
                uniqueId,
                user.id,
                "Subscription will be expried after " +
                  parseInt(days) +
                  " days. Please pay for subscription to continue to do copy trading.",
                false,
                formattedDate,
                "subscription_renewal",
              ]
            );
            const templateParams = {
              to_name: user.first_name
                ? user.first_name + user.last_name
                : "dear",
              from_name: "TickSync",
              recipient: user.email,
              message:
                "Subscription will be expried after " +
                parseInt(days) +
                " days. Please pay for subscription to continue to do copy trading.",
            };
            const serviceID = process.env.EMAILJS_SERVICE_ID;
            const templateID = process.env.EMAILJS_TEMPLATE_ID_NOTIFICATION;
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
              "verify code send success",
              response.status,
              response.text
            );
            if (socketUsers[user.id]) {
              console.log("Send Socket");
              io.to(user.id).emit("subscription_renewal", {
                message: messages.rows[0],
              });
            }
          }
        }
      }
    });
    await Promise.all(promises);
  } catch (err) {
    console.log(err);
  }
};

function runPayment() {
  setInterval(paymentCheck, 24 * 60 * 60 * 1000);
}

module.exports = { runPayment };
