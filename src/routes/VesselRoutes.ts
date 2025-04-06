import { Router } from 'express';
import {
  getAllVessels,
  getVesselById,
  createVessel,
  updateVessel,
  deleteVessel,
} from '../controllers/VesselController';
import upload from '../middlewares/Multer';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

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
