var passport = require("passport"),
  requireAuth = passport.authenticate("jwt", { session: false }),
  router = require("express").Router(),
  adminCtr = require("../controllers/admin.controller");

router.post("/get-all-data", requireAuth, adminCtr.getAllData);
router.post("/add-affiliate-code", requireAuth, adminCtr.addAffiliateCode);
router.post("/get-code-data", requireAuth, adminCtr.getCodeData);
router.post("/delete-affiliate-code", requireAuth, adminCtr.deleteAffiliateCode);
router.post("/update-affiliate-code", requireAuth, adminCtr.updateAffiliateCode);

module.exports = router;