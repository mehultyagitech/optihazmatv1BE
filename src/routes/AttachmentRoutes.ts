import { Router } from 'express';
import Authenticate from '../middlewares/Authenticate';
import { getPinsByAttachmentId, getAttachmentsByVesselId, deleteAttachmentById } from '../controllers/AttachmentController';

const router = Router();
router.use(Authenticate);

router.get('/:id', getAttachmentsByVesselId);
router.get('/:id/pins', getPinsByAttachmentId);
router.delete('/:id', deleteAttachmentById);

export default router;