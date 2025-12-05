var passport = require("passport"),
  requireSignin = passport.authenticate("local", { session: false }),
  requireAuth = passport.authenticate("jwt", { session: false }),
  router = require("express").Router(),
  userCtr = require("../controllers/user.controller");

router.post("/register", userCtr.register);
router.post("/login", requireSignin, userCtr.login);
router.post("/send-verify-email", userCtr.sendEmail);
router.post("/token-verification", userCtr.tokenVerification);
router.post("/login-with-token", userCtr.loginWithToken);
router.post("/send-verify-code", userCtr.sendVerifyCode);
router.post("/check-verify-code", userCtr.checkVerifyCode);
router.post("/change-password", userCtr.changePassword);

//account setting
router.post("/get-trade-count", requireAuth, userCtr.getTradeCount);
router.post("/save-personal-information", requireAuth, userCtr.savePersonalInformation);
router.post("/get-personal-information", requireAuth, userCtr.getPersonalInformation);
router.post("/change-password-setting", requireAuth, userCtr.changePasswordSetting);
router.post("/update-notification", requireAuth, userCtr.updateNotification);
router.post("/upload-avatar", requireAuth, userCtr.uploadAvatar);
router.post("/delete-avatar", requireAuth, userCtr.deleteAvatar);
router.post("/get-notification-list", requireAuth, userCtr.getNotificationList);
router.post("/update-notification-setting", requireAuth, userCtr.updateNotificationSetting);
router.post("/set-active-affiliate-marketing", requireAuth, userCtr.setActiveAffiliateMarketing);
router.post("/get-affiliate-marketing-data", requireAuth, userCtr.getAffiliateMarketingData);

module.exports = router;