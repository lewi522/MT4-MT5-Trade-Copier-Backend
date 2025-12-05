var config = require("../config"),
  jwt = require("jsonwebtoken");

// Generate token
module.exports = (user) => {
  var jsonData = {
    id: user.id,
    username: user.username,
    password: user.password
  };
  return jwt.sign(jsonData, config.secret, {
    expiresIn: '1d'
  });
}