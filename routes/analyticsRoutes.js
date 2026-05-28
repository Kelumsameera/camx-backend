import express from "express";
import {
  getGoogleAnalyticsData,
} from "../controllers/analyticsController.js";

const analyticsRouter= express.Router();

analyticsRouter.get("/google-analytics", getGoogleAnalyticsData);

export default analyticsRouter;