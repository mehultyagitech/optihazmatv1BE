import { Router, urlencoded } from 'express';
import {
  getAllVessels,
  getVesselById,
  createVessel,
  updateVessel,
  deleteVessel,
} from '../controllers/VesselController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';
import handleFileUpload from '../middlewares/FileUpload';

const router = Router();

router.get('/', Authenticate, Paginate, getAllVessels);
router.get('/:id', Authenticate, getVesselById);
router.post('/', Authenticate, createVessel);
router.put('/:id', Authenticate, updateVessel);
router.delete('/:id', Authenticate, deleteVessel);

router.post('/:id/upload', Authenticate, urlencoded({ extended: true }), handleFileUpload, Authenticate, updateVessel);
export default router;
