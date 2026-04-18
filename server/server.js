import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import uploadRoutes from './routes/upload.routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Important for form data

// Expose the user_img folder so frontend can load it
app.use('/user_img', express.static(path.join(__dirname, 'user_img')));

// Routes
app.use('/api', uploadRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});