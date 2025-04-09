import { Router } from 'express';
import {
  getAllDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  getDocumentTypesImages,
} from '../controllers/DocumentTypeController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

router.get('/', Authenticate, Paginate, getAllDocumentTypes);
router.post('/', Authenticate, createDocumentType);
router.put('/:id', Authenticate, updateDocumentType);
router.delete('/:id', Authenticate, deleteDocumentType);
router.get('/:documentTypeId/:vesselID', Authenticate, getDocumentTypesImages);


export default router;