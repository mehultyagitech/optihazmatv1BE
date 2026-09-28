import { Router } from 'express';
import {
  getAllDesignatedPersons,
  createDesignatedPerson,
  updateDesignatedPerson,
  deleteDesignatedPerson,
} from '../controllers/DesignatedPersonController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';
import upload from '../middlewares/Multer';

const router = Router();

// The signature is optional, so the form is sent as multipart either way.
const uploadSignature = upload.fields([{ name: 'signature', maxCount: 1 }]);

router.get('/', Authenticate, Paginate, getAllDesignatedPersons);
router.post('/', Authenticate, uploadSignature, createDesignatedPerson);
router.put('/:id', Authenticate, uploadSignature, updateDesignatedPerson);
router.delete('/:id', Authenticate, deleteDesignatedPerson);

export default router;
