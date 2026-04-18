export const handleNewMessage = async (req, res) => {
    try {
        // Will receive body payload here:
        // { "source": "web", "coordinates": {"lat": 26.91, "lon": 75.78} }
        // And the file from req.file (processed by upload middleware)
        
        console.log('Controller: Processing new message');
        res.status(200).json({ success: true, message: 'Message planned successfully' });
    } catch (error) {
        console.error('Error handling new message:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};