import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export const getMockSatelliteData = async (lat, lon, weatherData) => {
    try {
        console.log(`[Satellite Service] Requesting data data from Gemini for ${lat}, ${lon}`);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        
        const prompt = `Act as an advanced agricultural satellite API.
I have coordinates: Latitude ${lat}, Longitude ${lon}.
Current real weather at this location: 
- Temperature: ${weatherData.temperature_c}°C
- Humidity: ${weatherData.humidity_percent}%
- Recent Rainfall: ${weatherData.rainfall_latest_mm}mm

Generate a highly realistic mock JSON response containing estimated soil and satellite metrics for this specific environment. Use the weather data context to make these numbers scientifically plausible.
Include exact keys: "soil_moisture_percent" (number), "nitrogen_level" (string like "Low", "Moderate", "High"), "soil_ph" (number), and "ndvi_index" (number between 0 and 1).
Respond ONLY with a valid JSON object. No markdown formatting like \`\`\`json.`;
        
        const result = await model.generateContent(prompt);
        let responseText = result.response.text();
        
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        return JSON.parse(responseText);
    } catch (error) {
        console.error('[Satellite Service] Error generating mock data:', error.message);
        return {
            soil_moisture_percent: 45,
            nitrogen_level: "Moderate",
            soil_ph: 6.5,
            ndvi_index: 0.55
        };
    }
};
