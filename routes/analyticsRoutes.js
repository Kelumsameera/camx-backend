import express from "express";
import { getGoogleAnalyticsData } from "../controllers/analyticsController.js";
import { requireAdmin } from "../middleware/auth.js";

const analyticsRouter = express.Router();

analyticsRouter.get("/google-analytics", requireAdmin, getGoogleAnalyticsData);

export default analyticsRouter;
