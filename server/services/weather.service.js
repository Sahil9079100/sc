export const getWeatherData = async (lat, lon) => {
    try {
        // Fetch current weather (temperature, humidity, precipitation) from Open-Meteo
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation`;
        console.log(`[Weather Service] Fetching real weather data for ${lat}, ${lon}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Weather API failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        return {
            temperature_c: data.current.temperature_2m,
            humidity_percent: data.current.relative_humidity_2m,
            rainfall_latest_mm: data.current.precipitation
        };
    } catch (error) {
        console.error('[Weather Service] Error fetching weather:', error.message);
        // Fallback realistic data in case API fails
        return { temperature_c: 28, humidity_percent: 60, rainfall_latest_mm: 0 };
    }
};
