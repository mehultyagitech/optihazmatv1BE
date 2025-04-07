import { Router } from 'express';
import {
  getAllSubLocations,
  createSubLocation,
  updateSubLocation,
  deleteSubLocation,
} from '../controllers/SubLocation';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

router.get('/', Authenticate, Paginate, getAllSubLocations);
router.post('/', Authenticate, createSubLocation);
router.put('/:id', Authenticate, updateSubLocation);
router.delete('/:id', Authenticate, deleteSubLocation);

export default router;