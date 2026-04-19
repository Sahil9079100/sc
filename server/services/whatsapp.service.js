import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processMessage } from './agent.service.js';
import { transcribeAudio } from './stt.service.js';
import { generateAudio } from './tts.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initializeWhatsAppClient = () => {

    const client = new Client({
        authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '../../.wwebjs_auth') }),
        puppeteer: {
            executablePath: '/usr/bin/google-chrome-stable',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', (qr) => {
        console.log('\n======================================================');
        console.log('WhatsApp Bot: Scan this QR code to log in to WhatsApp:');
        qrcode.generate(qr, { small: true });
        console.log('======================================================\n');
    });

    client.on('ready', () => {
        console.log('✅ WhatsApp Client is ready and connected!');
    });

    client.on('message', async (msg) => {
        console.log(`Received message from ${msg.from}:`, msg.body || '[Media/Location]');
        const from = msg.from;

        const extractedData = {
            sessionId: from,
            source: 'whatsapp',
            text: msg.body && typeof msg.body === 'string' && !msg.hasMedia && !msg.location ? msg.body : '',
            imageUrl: null,
            coordinates: null,
            language: null
        };

        try {
            // Check for Media
            if (msg.hasMedia) {
                console.log(`Downloading media from ${from}...`);
                const media = await msg.downloadMedia();
                console.log('Media downloaded:', media ? `Yes (${media.mimetype})` : 'No');

                if (media && media.mimetype && media.mimetype.startsWith('image/')) {
                    const extension = media.mimetype.split('/')[1].split(';')[0] || 'jpg';
                    const filename = `whatsapp-${Date.now()}.${extension}`;

                    const destDir = path.join(__dirname, '../user_img_whatsapp');
                    if (!fs.existsSync(destDir)) {
                        fs.mkdirSync(destDir, { recursive: true });
                    }

                    const filepath = path.join(destDir, filename);
                    fs.writeFileSync(filepath, media.data, 'base64');

                    extractedData.imageUrl = `/user_img_whatsapp/${filename}`;
                } else if (media && (media.mimetype.startsWith('audio/') || media.mimetype.includes('ogg'))) {
                    // Handle Voice Notes
                    const extension = media.mimetype.split('/')[1].split(';')[0] || 'ogg';
                    const filename = `whatsapp-audio-${Date.now()}.${extension}`;

                    const destDir = path.join(__dirname, '../user_audio_whatsapp');
                    if (!fs.existsSync(destDir)) {
                        fs.mkdirSync(destDir, { recursive: true });
                    }

                    const filepath = path.join(destDir, filename);
                    fs.writeFileSync(filepath, media.data, 'base64');
                    console.log(`[WhatsApp Service] Saved voice note to ${filepath}`);

                    // Convert Speech to Text using Deepgram
                    const sttResult = await transcribeAudio(filepath);
                    if (sttResult.text) {
                        extractedData.text = sttResult.text;
                        extractedData.language = sttResult.language || null;
                    } else {
                        await client.sendMessage(from, 'I could not clearly understand the voice note. Please try recording again.');
                        return;
                    }
                }
            }

            // Check for Location
            if (msg.location) {
                extractedData.coordinates = {
                    lat: msg.location.latitude,
                    lon: msg.location.longitude
                };
            }

            // let my brosky Agent process the input
            console.log('[WhatsApp -> Agent] Dispatching state update to Orchestrator...');
            const aiResult = await processMessage(extractedData);

            if (aiResult.text && aiResult.text.length > 0) {
                // Generate the TTS audio based on AI answer
                const userLang = aiResult?.state?.language || extractedData.language || 'hi';
                const audioPath = await generateAudio(aiResult.text, userLang);

                // Both are ready now, send Text first (above)
                await client.sendMessage(from, aiResult.text);

                // Then send Audio (below). We can safely use sendAudioAsVoice since the output is now OGG/Opus compatible formats!
                if (audioPath && fs.existsSync(audioPath)) {
                    const audioMedia = MessageMedia.fromFilePath(audioPath);
                    await client.sendMessage(from, audioMedia, { sendAudioAsVoice: true });
                }
            }

            // Optional diagnostic completion log
            if (aiResult.diagnosticResult) {
                console.log(`[Diagnostic Ready] Successfully processed diagnosis for ${from}`);
            }

        } catch (err) {
            console.error(`Error processing WhatsApp message from ${from}:`, err);
            await client.sendMessage(from, 'An error occurred while processing your message. Please try again.');
        }
    });

    
    client.initialize();

    return client;
};
