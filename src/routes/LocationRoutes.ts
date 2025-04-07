import { Router } from 'express';
import {
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../controllers/LocationController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

router.get('/', Authenticate, Paginate, getAllLocations);
router.post('/', Authenticate, createLocation);
router.put('/:id', Authenticate, updateLocation);
router.delete('/:id', Authenticate, deleteLocation);

export default router;