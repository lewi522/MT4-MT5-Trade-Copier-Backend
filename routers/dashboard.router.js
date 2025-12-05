var passport = require("passport"),
  requireAuth = passport.authenticate("jwt", { session: false }),
  router = require("express").Router(),
  dashboardCtr = require("../controllers/dashboard.controller");

  //dashboard
  router.post("/get-clusters-with-info", requireAuth, dashboardCtr.getClustersWithInfo);
  router.post("/get-dashboard-balance-chart", requireAuth, dashboardCtr.getDashboardBalanceChart);
  router.post("/get-dashboard-balance-chart-by-clusterid", requireAuth, dashboardCtr.getDashboardBalanceChartByClusterId);
  router.post("/get-dashboard-pl-chart", requireAuth, dashboardCtr.getDashboardPlChart);
  router.post("/get-dashboard-pl-chart-by-clusterid", requireAuth, dashboardCtr.getDashboardPlChartByClusterId)
  router.post("/get-dashboard-card-data", requireAuth, dashboardCtr.getDashboardCardData);

  //clusters
  router.post("/create-cluster", requireAuth, dashboardCtr.createCluster);
  router.post("/get-available-account-list", requireAuth, dashboardCtr.getAvailableAccountList);
  router.post("/get-available-copier-list", requireAuth, dashboardCtr.getAvailableCopierList);
  router.post("/delete-cluster", requireAuth, dashboardCtr.deleteCluster);
  router.post("/get-clusters", requireAuth, dashboardCtr.getClusters);
  router.post("/update-cluster-name", requireAuth, dashboardCtr.updateClusterName);
  router.post("/create-copier", requireAuth, dashboardCtr.createCopier);
  router.post("/get-copier-by-clusterid", requireAuth, dashboardCtr.getCopierByClusterId);
  router.post("/get-contract-by-id", requireAuth, dashboardCtr.getContractById);
  router.post("/update-contract-status", requireAuth, dashboardCtr.updateContractStatus);
  router.post("/update-contract-copier-setting", requireAuth, dashboardCtr.updateContractCopierSetting);
  router.post("/update-contract-risk-setting", requireAuth, dashboardCtr.updateContractRiskSetting);
  router.post("/update-contract-position-setting", requireAuth, dashboardCtr.updateContractPositionSetting);

  //deploy account
  router.post("/deploy-account", requireAuth, dashboardCtr.deployAccount);
  router.post("/get-my-accounts", requireAuth, dashboardCtr.getMyAccounts);
  router.post("/delete-account", requireAuth, dashboardCtr.deleteAccount);
  // router.post("/get-account-list", requireAuth, dashboardCtr.getAccountList);

module.exports = router;