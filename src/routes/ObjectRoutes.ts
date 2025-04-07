import { Router } from 'express';
import getAllObjects, {
  createObject,
  updateObject,
  deleteObject,
} from '../controllers/ObjectController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

router.get('/', Authenticate, Paginate, getAllObjects);
router.post('/', Authenticate, createObject);
router.put('/:id', Authenticate, updateObject);
router.delete('/:id', Authenticate, deleteObject);

export default router;