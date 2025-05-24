import { Router } from 'express';
import {
  getAllPins,
  getPinById,
  createPin,
  updatePin,
  deletePin,
} from '../controllers/PinController';
import upload from '../middlewares/Multer';
import Authenticate from '../middlewares/Authenticate';

const router = Router();

router.get('/', Authenticate, getAllPins);
router.get('/:id', Authenticate, getPinById);
router.post('/', Authenticate, upload.any(), createPin);
router.put('/:id', Authenticate, upload.any(), updatePin);
router.delete('/:id', Authenticate, deletePin);

export default router;
