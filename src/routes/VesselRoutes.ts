import { Router } from 'express';
import multer from 'multer';
import {
  getAllVessels,
  getVesselById,
  createVessel,
  updateVessel,
  deleteVessel,
} from '../controllers/VesselController';
import Authenticate from '../middlewares/Authenticate';

const router = Router();
const upload = multer({ dest: 'uploads/' });

router.get('/', Authenticate, getAllVessels);
router.get('/:id', Authenticate, getVesselById);
router.post('/', upload.fields([{ name: 'attachments' }, { name: 'images' }]), createVessel);
router.put('/:id', Authenticate, updateVessel);
router.delete('/:id', Authenticate, deleteVessel);

export default router;
