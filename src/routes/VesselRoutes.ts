import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import {
  getAllVessels,
  getVesselById,
  createVessel,
  updateVessel,
  deleteVessel,
} from '../controllers/VesselController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const savePath = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(savePath)) {
      fs.mkdirSync(savePath, { recursive: true });
    }
    cb(null, savePath);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      crypto.randomBytes(16).toString('hex') + path.extname(file.originalname),
    );
  },
});

// Single upload middleware that handles both image and attachments
const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // Limit file size to 5MB
  },
});

// Configure multer to handle both image (single) and attachments (array)
const uploadFiles = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'attachments[]', maxCount: 10 },
  { name: 'commonInventoryImage', maxCount: 1 },
]);

router.get('/', Authenticate, Paginate, getAllVessels);
router.get('/:id', Authenticate, getVesselById);
router.post(
  '/',
  uploadFiles,
  Authenticate,
  createVessel,
);

router.put(
  '/:id',
  uploadFiles,
  Authenticate,
  updateVessel,
);
router.delete('/:id', Authenticate, deleteVessel);

export default router;
