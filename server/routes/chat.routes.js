import express from 'express';
import { handleNewMessage } from '../controllers/chat.controller.js';
import { uploadImage } from '../middlewares/upload.middleware.js';

const router = express.Router();

// Route to handle incoming chat messages with an image upload
router.post('/message', uploadImage, handleNewMessage);

export default router;