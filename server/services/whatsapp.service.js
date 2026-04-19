import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processMessage } from './agent.service.js'; // Added agent import

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initializeWhatsAppClient = () => {
    // Note: If you skipped Puppeteer browser download, you may need to provide executablePath 
    // pointing to your local Chrome/Chromium installation.
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
            coordinates: null
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
                }
            }

            // Check for Location
            if (msg.location) {
                extractedData.coordinates = {
                    lat: msg.location.latitude,
                    lon: msg.location.longitude
                };
            }

            // Let the Agent process the input instead of manual state checks
            console.log(`[WhatsApp -> Agent] Dispatching state update to Orchestrator...`);
            const aiResult = await processMessage(extractedData);
            
            // Send the AI's intelligent response back to the user
            if (aiResult.text && aiResult.text.length > 0) {
                await client.sendMessage(from, aiResult.text);
            }
            
            // Optional: If the diagnostic hit, you could augment with a voice note or structured JSON 
            if (aiResult.diagnosticResult) {
                console.log(`[Diagnostic Ready] Successfully processed diagnosis for ${from}`);
                // System could send TTS here later (Phase 4B)
            }
            
        } catch (err) {
            console.error(`Error processing WhatsApp message from ${from}:`, err);
            await client.sendMessage(from, 'An error occurred while processing your message. Please try again.');
        }
    });

    client.initialize();

    return client;
};
