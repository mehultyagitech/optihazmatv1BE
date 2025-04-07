import { Router } from 'express';
import {
  getAllInventory,
  createInventory,
  updateInventory,
  deleteInventory,
} from '../controllers/InventoryController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

router.get('/', Authenticate, Paginate, getAllInventory);
router.post('/', Authenticate, createInventory);
router.put('/:id', Authenticate, updateInventory);
router.delete('/:id', Authenticate, deleteInventory);

export default router;