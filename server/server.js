import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import uploadRoutes from './routes/upload.routes.js';
import { initializeWhatsAppClient } from './services/whatsapp.service.js';
 
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors(
    {
        origin: ['https://sc.sawinest.xyz', 'http://localhost:5173'], // Only this domain can access
        methods: 'GET,POST',
        optionsSuccessStatus: 200
    }
));
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Important for form data

// Expose the user_img folders so frontend can load it
app.use('/user_img_web', express.static(path.join(__dirname, 'user_img_web')));
app.use('/user_img_whatsapp', express.static(path.join(__dirname, 'user_img_whatsapp')));

// Routes
app.use('/api', uploadRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    
    // Initialize WhatsApp Bot as soon as server starts
    // NOTE: This will log a QR code to your terminal that you must scan.
    initializeWhatsAppClient();
});