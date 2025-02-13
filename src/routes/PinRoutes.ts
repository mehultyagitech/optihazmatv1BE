import { Router } from 'express';
import multer from 'multer';
import {
  getAllPins,
  getPinById,
  createPin,
  updatePin,
  deletePin,
} from '../controllers/PinController';
import Authenticate from '../middlewares/Authenticate';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.get('/', Authenticate, getAllPins);
router.get('/:id', Authenticate, getPinById);
router.post('/', Authenticate, upload.array('images'), createPin);
router.put('/:id', Authenticate, updatePin);
router.delete('/:id', Authenticate, deletePin);

export default router;
