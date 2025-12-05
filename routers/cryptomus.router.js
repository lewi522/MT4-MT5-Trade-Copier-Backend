var passport = require("passport"),
  requireAuth = passport.authenticate("jwt", { session: false }),
  router = require("express").Router(),
  cryptomusCtr = require("../controllers/cryptomus.controller");

  router.post("/make-subscription", requireAuth, cryptomusCtr.makeSubscription);
  router.post("/webhook", cryptomusCtr.webhook);
  router.post("/get-new-payment", requireAuth, cryptomusCtr.getNewPayment);
  router.post("/customize-subscription", requireAuth, cryptomusCtr.customizeSubscription);
  router.post("/get-payment-history", requireAuth, cryptomusCtr.getPaymentHistory);  
  router.post("/send-request-withdrawal", requireAuth, cryptomusCtr.sendRequestWithdrawal);
  router.post("/payoutwebhook", cryptomusCtr.payoutWebhook);
  router.post("/check-promo-code", requireAuth, cryptomusCtr.checkPromoCode);
  router.post("/get-current-plan", requireAuth, cryptomusCtr.getCurrentPlan);

module.exports = router;