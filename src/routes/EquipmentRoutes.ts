import { Router } from 'express';
import {
  getAllEquipments,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from '../controllers/EquipmentController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

router.get('/', Authenticate, Paginate, getAllEquipments);
router.post('/', Authenticate, createEquipment);
router.put('/:id', Authenticate, updateEquipment);
router.delete('/:id', Authenticate, deleteEquipment);

export default router;