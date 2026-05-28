import { BetaAnalyticsDataClient } from '@google-analytics/data';
import path from 'path';

// JSON key එකේ නිවැරදි Path එක දෙන්න
const keyFilePath = path.join(process.cwd(), 'camx-analytics-key.json');

const analyticsDataClient = new BetaAnalyticsDataClient({
  keyFilename: keyFilePath,
});

export async function getGoogleAnalyticsData(req, res) {
  try {
    // ඔබේ Property ID එක (Google Analytics Admin එකෙන් ලබා ගන්න)
    const propertyId = '538937737'; 

    const [response] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'totalUsers' }
      ],
    });

    const data = {
      activeUsers: response.rows[0]?.metricValues[0].value || 0,
      pageViews: response.rows[0]?.metricValues[1].value || 0,
      totalUsers: response.rows[0]?.metricValues[2].value || 0,
    };

    res.json(data);
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Error fetching GA data" });
  }
}