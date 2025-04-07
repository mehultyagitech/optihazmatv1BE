import { Router } from 'express';
import {
  getAllCompartments,
  createCompartment,
  updateCompartment,
  deleteCompartment,
} from '../controllers/CompartmentController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

router.get('/', Authenticate, Paginate, getAllCompartments);
router.post('/', Authenticate, createCompartment);
router.put('/:id', Authenticate, updateCompartment);
router.delete('/:id', Authenticate, deleteCompartment);

export default router;