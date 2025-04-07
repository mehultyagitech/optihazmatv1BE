import { Router } from 'express';
import {
  getAllDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
} from '../controllers/DocumentTypeController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

router.get('/', Authenticate, Paginate, getAllDocumentTypes);
router.post('/', Authenticate, createDocumentType);
router.put('/:id', Authenticate, updateDocumentType);
router.delete('/:id', Authenticate, deleteDocumentType);

export default router;