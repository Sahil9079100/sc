import { processMessage } from '../services/agent.service.js';

export const handleImageUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const { source, coordinates: rawCoordinates, sessionId = 'web_guest_user' } = req.body;
        let coordinates = null;

        // since it might be stringified from multipart/form-data
        if (rawCoordinates) {
            try {
                coordinates = typeof rawCoordinates === 'string' ? JSON.parse(rawCoordinates) : rawCoordinates;
            } catch (e) {
                return res.status(400).json({ error: 'Invalid coordinates format' });
            }
        }

        const fileUrl = `/user_img_web/${req.file.filename}`;

        console.log(JSON.stringify({
            source: source || 'web',
            image_url: fileUrl,
            coordinates: coordinates
        }));

        // Run the agent process for the Web user
        const aiResult = await processMessage({
            sessionId: sessionId,
            source: source || 'web',
            imageUrl: fileUrl,
            coordinates: coordinates
        });

        // Creating response mimicking chat payload behavior (including the AI's intelligent text)
        const responsePayload = {
            success: true,
            data: {
                message_id: Date.now().toString(),
                sender: source || 'web',
                type: 'image',
                image_url: fileUrl,
                coordinates: coordinates,
                timestamp: new Date().toISOString()
            },
            message: 'Image successfully uploaded for chat',
            ai_response: aiResult.text,
            diagnostic: aiResult.diagnosticResult
        };

        res.status(200).json(responsePayload);
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to process upload' });
    }
};
