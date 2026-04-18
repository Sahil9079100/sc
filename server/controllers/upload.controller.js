export const handleImageUpload = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const { source, coordinates: rawCoordinates } = req.body;
        let coordinates = null;

        // since it might be stringified from multipart/form-data
        if (rawCoordinates) {
            try {
                coordinates = typeof rawCoordinates === 'string' ? JSON.parse(rawCoordinates) : rawCoordinates;
            } catch (e) {
                return res.status(400).json({ error: 'Invalid coordinates format' });
            }
        }

        const fileUrl = `/user_img/${req.file.filename}`;

        // Creating response mimicking chat payload behavior
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
            message: 'Image successfully uploaded for chat'
        };

        res.status(200).json(responsePayload);
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
};
