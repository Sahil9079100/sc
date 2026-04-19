import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

import { getWeatherData } from './weather.service.js';
import { getMockSatelliteData } from './satellite.service.js';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
// Simple in-memory store for user sessions
const sessions = new Map();

export const getSession = (sessionId) => {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            status: 'gathering_info',
            image_url: null,
            coordinates: null,
            language: 'en', // Default language
            history: [], // Stores { role: 'user' | 'model', content: '...' }
            diagnostic_data: null,
            question_count: 0
        });
    }
    return sessions.get(sessionId);
};

export const updateSession = (sessionId, updates) => {
    const session = getSession(sessionId);
    Object.assign(session, updates);
    return session;
};

// Mock Phase 2: Parallel Data Processing (Vision + Geo-Spatial)
const runDiagnosticEngine = async (imageUrl, coordinates) => {
    console.log(`[Diagnostic Engine] Running visual inference on ${imageUrl}...`);
    
    // TRACK B: GEO-SPATIAL CONTEXT PIPELINE
    console.log(`[Diagnostic Engine] Fetching real weather data for ${coordinates.lat}, ${coordinates.lon}...`);
    const weatherData = await getWeatherData(coordinates.lat, coordinates.lon);
    
    console.log(`[Diagnostic Engine] Generating realistic mock satellite/soil data...`);
    const satelliteData = await getMockSatelliteData(coordinates.lat, coordinates.lon, weatherData);
    
    const geoSpatialData = {
        weather: weatherData,
        soil_satellite_mock: satelliteData
    };

    console.log(`[Diagnostic Engine] Geo-Spatial Pipeline completed:`, geoSpatialData);

    // Mock representation of Track A (Vision) until real ResNet is integrated
    const visualMock = {
        suspected_disease: 'Leaf Blight (89% confidence)',
        visual_cues: 'Yellowing margins and necrotic spots.'
    };

    return {
        visual_diagnosis: visualMock,
        geo_spatial_data: geoSpatialData,
        raw_data: { image: imageUrl, loc: coordinates }
    };
};

export const processMessage = async ({ sessionId, source, text = '', imageUrl = null, coordinates = null, language = null }) => {
    const session = getSession(sessionId);

    // 1. Update State (Slot Filling)
    if (imageUrl) session.image_url = imageUrl;
    if (coordinates) session.coordinates = coordinates;
    if (language) session.language = language; // Track user language if Deepgram detected it

    let systemPromptAddition = '';
    let isConfidenceEval = false;

    // 2. Check if we should trigger the diagnostic (Both slots filled)
    if (session.image_url && session.coordinates && session.status !== 'completed') {
        if (!session.diagnostic_data) {
            console.log("[Agent] Triggering raw backend models. Fetching diagnostic signals...");
            session.diagnostic_data = await runDiagnosticEngine(session.image_url, session.coordinates);
            session.status = 'evaluating_confidence';
        }

        isConfidenceEval = true;

        systemPromptAddition = `
[PHASE 3: CONFIDENCE-BASED DYNAMIC DIAGNOSIS]
You are an Expert Agronomist communicating directly with a farmer.
We have collected initial multi-modal data:
--- VISUAL DIAGNOSIS (Mocked ResNet) ---
- Suspected Disease: ${session.diagnostic_data.visual_diagnosis.suspected_disease}
- Visual Cues: ${session.diagnostic_data.visual_diagnosis.visual_cues}

--- GEO-SPATIAL DATA ---
Weather: ${session.diagnostic_data.geo_spatial_data.weather.temperature_c}°C, Humidity ${session.diagnostic_data.geo_spatial_data.weather.humidity_percent}%
Soil Moisture: ${session.diagnostic_data.geo_spatial_data.soil_satellite_mock.soil_moisture_percent}%

Previous Follow-up Questions Asked by you: ${session.question_count}
Maximum Allowed Questions before forcing a best-guess diagnosis: 2

YOUR TASK:
Evaluate if this raw symptomatic and environmental data, combined with the farmer's chat history, is sufficient to make a confident diagnosis (> 85% confidence score).
If confidence is < 85 AND you haven't asked 2 questions yet, output 'needs_more_info' and provide exactly 1-2 follow-up questions to gather more specific clues (e.g. usage of fertilizers, watering history, when it started).
If confidence is >= 85 OR you have already asked 2 questions, output 'confident' and provide the final_diagnosis_draft.

CRITICAL INSTRUCTION: You MUST format your ENTIRE output as a valid JSON object. Do not include markdown codeblocks (\`\`\`json) outside of the structure, just output raw JSON:
{
  "confidence_score": <number 0-100>,
  "internal_reasoning": "<string explaining your logic>",
  "status": "confident" | "needs_more_info",
  "follow_up_questions": ["<question 1 in the EXACT SAME language the user used>"],
  "final_diagnosis_draft": "<Markdown formatted final diagnosis in the EXACT SAME language the user used, empty if 'needs_more_info'>"
}
`;
    } else if (session.status === 'completed') {
        systemPromptAddition = `The final diagnosis is complete. You are chatting friendly with the farmer. CRITICAL: Reply in the EXACT SAME language the farmer is using (Hindi, Gujarati, Marathi, Tamil, Telugu, etc.).`;
    } else {
        systemPromptAddition = `
Current State:
- Has user provided an image? ${session.image_url ? 'YES' : 'NO'}
- Has user provided a location? ${session.coordinates ? 'YES' : 'NO'}

Your task: Assess state. If missing image, ask for crop photo. If missing location, ask for location pin.
CRITICAL LANGUAGE RULE: You MUST speak the EXACT SAME language the user is typing/speaking in (e.g., Gujarati, Hindi, Marathi, Tamil, Telugu, Kannada, Malayalam, Odia, Punjabi, Bengali, or English). Never force English unless they use English. Do NOT hallucinate a diagnosis until both are YES.
`;
    }

    // 3. Assemble Context & Prompt
    const systemInstruction = `
You are an expert Agentic Agronomist AI. You help farmers diagnose crop diseases.
${systemPromptAddition}
`;

    // Add user message to short-term memory
    let inputContent = text || '';
    if (!text && imageUrl && !coordinates) inputContent = "[User uploaded an image]";
    if (!text && !imageUrl && coordinates) inputContent = `[User shared location: Lat ${coordinates.lat}, Lon ${coordinates.lon}]`;
    if (!text && imageUrl && coordinates) inputContent = "[User submitted both an image and location simultaneously]";

    session.history.push({ role: 'user', content: inputContent });

    // Keep only last 5 messages
    if (session.history.length > 6) {
        session.history = session.history.slice(session.history.length - 6);
    }

    const contents = session.history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    const latestUserMsgIndex = contents.length - 1;
    contents[latestUserMsgIndex].parts[0].text = `[SYSTEM INSTRUCTION]\n${systemInstruction}\n\n[USER INPUT]\n${contents[latestUserMsgIndex].parts[0].text}`;

    console.log(`[Agent] Calling Gemini for session ${sessionId}...`);
    try {
        let aiResponseText = "";
        let isFinalDiag = false;

        if (!process.env.GEMINI_API_KEY) {
            aiResponseText = "Missing Gemini key.";
        } else {
            const chatConfig = { history: contents.slice(0, -1) };
            
            // Native JSON mode enforcement for Phase 3
            if (isConfidenceEval) {
                chatConfig.generationConfig = { responseMimeType: "application/json" };
            }

            const chat = model.startChat(chatConfig);
            const result = await chat.sendMessage(contents[latestUserMsgIndex].parts[0].text);
            let rawText = result.response.text();

            if (isConfidenceEval) {
                // Parse JSON dynamically
                let jsonResponse;
                try {
                    jsonResponse = JSON.parse(rawText);
                    console.log(`[Agent] Dynamic Confidence Engine:`, Object.entries(jsonResponse).map(([k, v]) => `${k}:${typeof v === 'string' && v.length > 50 ? '"..."' : JSON.stringify(v)}`).join(', '));
                    
                    if (jsonResponse.status === 'confident' || session.question_count >= 2) {
                        aiResponseText = jsonResponse.final_diagnosis_draft || "Based on the provided information, I have reached a conclusion.";
                        session.status = 'completed';
                        isFinalDiag = true;
                    } else {
                        // Fallback safely to prevent crashing if the array is missing or empty
                        const questions = jsonResponse.follow_up_questions || [];
                        aiResponseText = questions.length > 0 ? questions.join(' ') : "कृपया मुझे अपनी समस्या के बारे में और जानकारी दें।";
                        session.question_count += 1;
                    }
                } catch (e) {
                    console.error('[Agent] Failed to parse confidence JSON. Fallback to raw text.', rawText);
                    aiResponseText = "मैंने आपकी जानकारी देख ली है, लेकिन मुझे थोड़ी और जानकारी चाहिए। क्या आप बता सकते हैं कि आपने आखिरी बार खेतों में क्या डाला था?";
                    session.question_count += 1;
                }
            } else {
                aiResponseText = rawText;
            }
        }

        // Add to history so AI remembers the actual question it asked
        session.history.push({ role: 'model', content: aiResponseText });

        return {
            text: aiResponseText,
            diagnosticResult: isFinalDiag ? session.diagnostic_data : null,
            state: session
        };
    } catch (error) {
        console.error('[Agent] Error calling LLM:', error);
        return { text: "I'm having trouble analyzing that. Please try again.", diagnosticResult: null, state: session };
    }
};
