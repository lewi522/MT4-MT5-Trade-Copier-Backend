const passport = require("passport");
const LocalStrategy = require("passport-local");
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const config = require('./config');
const { emailExists, search_by_id, matchPassword } = require("./helper");
const { decryptData } = require('./utils/encryptFunction');


const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromHeader('authorization'),
  secretOrKey: config.secret
};

module.exports = () => {
  passport.use(
    "local",
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email, password, done) => {
        try {
          const decrypted_email = JSON.parse(decryptData(email));
          const decrypted_password = JSON.parse(decryptData(password));
          console.log(decrypted_email, decrypted_password);
          const user = await emailExists(decrypted_email);
          if (!user) return done(null, false);
          const isMatch = await matchPassword(decrypted_password, user.password);
          if (!isMatch) return done(null, false);
          return done(null, { id: user.id, email: user.email });
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );
  passport.use(
    "jwt",
    new JwtStrategy(
      jwtOptions,
      async (payload, done) => {
        try {
          const user = await search_by_id(payload.id);
          if (!user) return done(null, false);
          else return done(null, user)
        } catch (error) {
          console.log(error);
          return done(error, false);
        }
      }
    )
  )
};