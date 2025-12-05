require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || "development";

var express = require("./config/express.js"),
    passport = require("./config/passport.js"),
    config = require("./config/config.js"),
    // fs = require(`fs`),
    http = require("http");

// https = require("https");
const { startFunc } = require("./trading/masters/index.master.trading.js");
const { initSocket } = require('./socket/socket.js');
const { runPayment }  = require('./payment/payment.check.js');

var app = express();
passport();
// const options = {
//     key: fs.readFileSync('private.key'),
//     cert: fs.readFileSync('certificate.crt')
// };
// var server = https.createServer(options, app);
var server = http.createServer(app);

initSocket(server);
// startFunc();
// runPayment();

server.listen(config.port, () => {
    console.log(`Server is running at http://localhost:${config.port}`)
});
