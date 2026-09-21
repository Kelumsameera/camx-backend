import { BetaAnalyticsDataClient } from "@google-analytics/data";
import path from "path";
import fs from "fs";
import { isAdmin } from "../middleware/auth.js";
import logger from "../utils/logger.js";

const keyFilePath = path.join(process.cwd(), "camx-analytics-key.json");

let analyticsDataClient = null;
if (fs.existsSync(keyFilePath)) {
  try {
    analyticsDataClient = new BetaAnalyticsDataClient({
      keyFilename: keyFilePath,
    });
  } catch (err) {
    logger.warn("Could not initialize Google Analytics client", err);
  }
}

// ==========================================
// GET GOOGLE ANALYTICS DATA (ADMIN ONLY) (CAMX-010)
// ==========================================
export async function getGoogleAnalyticsData(req, res) {
  // SECURITY: Require Admin Authorization (CAMX-010)
  if (!isAdmin(req)) {
    return res.status(403).json({ success: false, message: "Forbidden: Admins only" });
  }

  if (!analyticsDataClient) {
    return res.status(503).json({
      success: false,
      message: "Google Analytics service is not configured on this server",
    });
  }

  try {
    const propertyId = process.env.GA_PROPERTY_ID || "538937737";

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
      metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }, { name: "totalUsers" }],
    });

    const data = {
      activeUsers: Number(response.rows?.[0]?.metricValues?.[0]?.value || 0),
      pageViews: Number(response.rows?.[0]?.metricValues?.[1]?.value || 0),
      totalUsers: Number(response.rows?.[0]?.metricValues?.[2]?.value || 0),
    };

    return res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error("Analytics Error", error);
    return res.status(500).json({ success: false, message: "Error fetching GA data" });
  }
}

export default { getGoogleAnalyticsData };
