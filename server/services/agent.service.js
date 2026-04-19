import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

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
            history: [], // Stores { role: 'user' | 'model', content: '...' }
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
    console.log(`[Diagnostic Engine] Fetching weather/soil data for ${coordinates.lat}, ${coordinates.lon}...`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
        suspected_disease: 'Leaf Blight (89% confidence)',
        environmental_risk: 'High humidity detected (85%), favorable for fungal growth.',
        raw_data: { image: imageUrl, loc: coordinates }
    };
};

export const processMessage = async ({ sessionId, source, text = '', imageUrl = null, coordinates = null }) => {
    const session = getSession(sessionId);

    // 1. Update State (Slot Filling)
    if (imageUrl) session.image_url = imageUrl;
    if (coordinates) session.coordinates = coordinates;

    // 2. Check if we should trigger the diagnostic (Both slots filled)
    let diagnosticResult = null;
    let systemPromptAddition = '';

    if (session.image_url && session.coordinates && session.status !== 'completed') {
        session.status = 'running_diagnostic';
        diagnosticResult = await runDiagnosticEngine(session.image_url, session.coordinates);
        session.status = 'completed';

        systemPromptAddition = `
SYSTEM OVERRIDE: The user provided both the image and the location!
The backend Diagnostic Engine has just finished running. Here are the results:
- Suspected Disease: ${diagnosticResult.suspected_disease}
- Environmental Factors: ${diagnosticResult.environmental_risk}

Your task: Provide the Final Diagnosis, your contextual reasoning (bridging the visual and weather data), and 3 simple actionable remedies for the farmer. Keep it reassuring and clear.
`;

        // Reset slots if you want them to be able to submit a new crop scan later
        // session.image_url = null;
        // session.coordinates = null;
        // session.status = 'gathering_info';
    } else {
        systemPromptAddition = `
Current State:
- Has user provided an image? ${session.image_url ? 'YES' : 'NO'}
- Has user provided a location? ${session.coordinates ? 'YES' : 'NO'}

Your task: Check the current state. If the user is missing an image, politely ask them to upload a photo of the crop. If they are missing a location, politely ask them to send a location pin. Acknowledge whatever they have just provided. Do NOT hallucinate a diagnosis until both are YES.
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

    // Keep only last 5 messages to avoid huge context costs
    if (session.history.length > 5) {
        session.history = session.history.slice(session.history.length - 5);
    }

    // Format for Gemini API (contents array)
    const contents = session.history.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    // For safety, prepend the system prompt to the user's latest message
    const latestUserMsgIndex = contents.length - 1;
    contents[latestUserMsgIndex].parts[0].text = `[SYSTEM INSTRUCTION]\n${systemInstruction}\n\n[USER INPUT]\n${contents[latestUserMsgIndex].parts[0].text}`;

    console.log(`[Agent] Calling Gemini for session ${sessionId}...`);
    try {
        let aiResponseText = "";

        // If they haven't put a Gemini Key in .env yet, fallback gracefully for testing
        if (!process.env.GEMINI_API_KEY) {
            console.log("[Agent] No GEMINI_API_KEY found, returning mocked response based on state.");
            if (diagnosticResult) {
                aiResponseText = `*Mock AI Response*\n\nBased on your image and location (Lat ${session.coordinates.lat}), I've run the diagnostics.\n\nDiagnosis: ${diagnosticResult.suspected_disease}\nWeather Context: ${diagnosticResult.environmental_risk}\n\nRemedy:\n1. Ensure good drainage.\n2. Apply copper-based fungicide.\n3. Monitor daily.`;
            } else if (!session.image_url) {
                aiResponseText = `*Mock AI Response*\nCould you please provide an image of your crop?`;
            } else if (!session.coordinates) {
                aiResponseText = `*Mock AI Response*\nI received the image! Now, please share your location pin.`;
            }
        } else {
            const chat = model.startChat({
                history: contents.slice(0, -1), // Everything except the latest message
            });

            const result = await chat.sendMessage(contents[latestUserMsgIndex].parts[0].text);
            aiResponseText = result.response.text();
        }

        // Add AI response to memory
        session.history.push({ role: 'model', content: aiResponseText });

        return {
            text: aiResponseText,
            diagnosticResult,
            state: session
        };
    } catch (error) {
        console.error('[Agent] Error calling LLM:', error);
        if (error?.status === 404) {
            console.error(`[Agent] Model '${GEMINI_MODEL}' is unavailable. Try GEMINI_MODEL=gemini-2.5-flash.`);
        }
        return {
            text: "I'm having trouble analyzing that right now. Please try again in a moment.",
            diagnosticResult: null,
            state: session
        };
    }
};
