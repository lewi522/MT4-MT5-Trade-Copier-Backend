const rateLimit = require("express-rate-limit");

const rateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: "You have exceeded your 100 requests per 5 minute limit.",
  headers: true
});

module.exports = rateLimiter;