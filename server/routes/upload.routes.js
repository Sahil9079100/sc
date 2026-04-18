import express from 'express';
import { upload } from '../middlewares/multer.middleware.js';
import { handleImageUpload } from '../controllers/upload.controller.js';

const router = express.Router();

router.post('/upload', upload.single('image'), handleImageUpload);

export default router;
