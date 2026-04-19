import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Map standard short language codes (from Deepgram) to Sarvam's expected format
const languageMap = {
    'hi': 'hi-IN',
    'bn': 'bn-IN',
    'ta': 'ta-IN',
    'te': 'te-IN',
    'mr': 'mr-IN',
    'kn': 'kn-IN',
    'ml': 'ml-IN',
    'gu': 'gu-IN',
    'or': 'or-IN',
    'pa': 'pa-IN',
    'en': 'en-IN'
};

export const generateAudio = async (text, languageCode = 'en') => {
    try {
        console.log(`[TTS Service] Processing text for language: ${languageCode}`);

        // Dynamic Round-Robin API Key Load Balancer for Hackathons
        const apiKeys = process.env.SARVAM_API_KEYS
            ? process.env.SARVAM_API_KEYS.split(',').map(k => k.trim()).filter(Boolean)
            : (process.env.SARVAM_API_KEY ? [process.env.SARVAM_API_KEY.trim()] : []);

        if (apiKeys.length === 0) {
            console.log("[TTS Service] No SARVAM_API_KEYS found. Returning null (mock mode).");
            return null;
        }

        const sarvamLang = languageMap[languageCode] || 'hi-IN';

        const cleanText = text.replace(/[*_#\[\]`~]/g, '');

        const rawChunks = cleanText.match(/[^.?!।\n]+[.?!।\n]*/g) || [cleanText];

        const validChunks = rawChunks
            .map(c => c.trim())
            .filter(c => c.length > 0 && /[\p{L}]/u.test(c));

        if (validChunks.length === 0) {
            console.log(`[TTS Service] No valid text chunks (letters) available to synthesize.`);
            return null;
        }

        console.log(`[TTS Service] Split text into ${validChunks.length} chunk(s). Processing in parallel...`);

        const destDir = path.join(__dirname, '../user_audio_whatsapp/responses');
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const chunkPromises = validChunks.map(async (chunk, index) => {
            // Round-robin load balancer, we broke college kids cant afford paid api keys...lol
            const apiKey = apiKeys[index % apiKeys.length];

            try {
                const payload = {
                    "text": chunk,
                    "target_language_code": sarvamLang,
                    "speaker": "shubh",
                    "model": "bulbul:v3"
                };

                const response = await axios.post('https://api.sarvam.ai/text-to-speech', payload, {
                    headers: {
                        'api-subscription-key': apiKey,
                        'Content-Type': 'application/json'
                    }
                });

                const base64Audio = response.data.audios?.[0];
                if (!base64Audio) throw new Error("No audio data returned for a chunk.");

                const chunkFilename = `chunk-${Date.now()}-${index}.wav`;
                const chunkFilepath = path.join(destDir, chunkFilename);

                fs.writeFileSync(chunkFilepath, Buffer.from(base64Audio, 'base64'));
                return chunkFilename;
            } catch (err) {
                console.error(`[TTS Service] Skipped faulty chunk [${chunk}]:`, err.response?.data?.error?.message || err.message);
                return null;
            }
        });

        const resolvedRawWavs = await Promise.all(chunkPromises);

        const resolvedWavChunks = resolvedRawWavs.filter(filename => filename !== null);

        if (resolvedWavChunks.length === 0) {
            console.log(`[TTS Service] All API chunk requests failed to generate an audio payload.`);
            return null;
        }

        //ffmpeg stichhhh
        const listFilename = `concat-list-${Date.now()}.txt`;
        const listFilepath = path.join(destDir, listFilename);
        const listData = resolvedWavChunks.map(filename => `file '${filename}'`).join('\n');
        fs.writeFileSync(listFilepath, listData);

        const oggFilename = `response-final-${Date.now()}.ogg`;
        const oggFilepath = path.join(destDir, oggFilename);

//wav to ogg
        await execPromise(`ffmpeg -f concat -safe 0 -i "${listFilename}" -c:a libopus -b:a 32k -vbr on "${oggFilename}"`, { cwd: destDir });

        //temp chunk WAVs and the text list
        for (const chunk of resolvedWavChunks) {
            const cleanupPath = path.join(destDir, chunk);
            if (fs.existsSync(cleanupPath)) fs.unlinkSync(cleanupPath);
        }
        if (fs.existsSync(listFilepath)) fs.unlinkSync(listFilepath);

        console.log(`[TTS Service] Parallel audio generation complete. Saved OGG stream at ${oggFilepath}`);
        return oggFilepath;

    } catch (error) {
        console.error('[TTS Service] Error generating TTS:', error.message);
        if (error.response?.data) {
            console.error('[TTS Service] API Rejection:', error.response.data);
        }
        return null;
    }
};
