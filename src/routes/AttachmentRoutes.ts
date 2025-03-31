import { Router } from 'express';
import Authenticate from '../middlewares/Authenticate';
import { getAttachmentsByVesselId, deleteAttachmentById } from '../controllers/AttachmentController';

const router = Router();
router.use(Authenticate);

router.get('/:id', getAttachmentsByVesselId); // Get all attachments by vessel ID
router.delete('/:id', deleteAttachmentById); // Delete attachment by ID

export default router;