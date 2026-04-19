import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import axios from 'axios';

export const transcribeAudio = async (filePath) => {
    try {
        console.log(`[STT Service] Transcribing audio with Deepgram: ${filePath}`);
        
        if (!process.env.DEEPGRAM_API_KEY) {
            console.log("[STT Service] No DEEPGRAM_API_KEY found. Returning mock transcription.");
            return { 
                text: "Mera fasal kharab ho raha hai, patte pe pile dhabbe hain.",
                language: "hi" 
            };
        }

        const audioBuffer = fs.readFileSync(filePath);

        const response = await axios.post('https://api.deepgram.com/v1/listen?model=nova-3&detect_language=true', audioBuffer, {
            headers: {
                'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
                'Content-Type': 'audio/ogg' 
            }
        });
        
        const data = response.data;
        const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
        const language = data.results?.channels?.[0]?.detected_language || "en";
        
        console.log(`[STT Service] Transcription complete. Language: ${language}, Text: ${text}`);
        return { text, language };
    } catch (error) {
        console.error('[STT Service] Error in STT processing:', error.message);
        if (error.response?.data) {
            console.error('[STT Service] API Rejection:', error.response.data);
        }
        return { text: "", language: "en" }; 
    }
};
