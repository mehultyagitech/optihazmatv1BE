import { Router } from 'express';
import getGenericData from '../controllers/GenericApiController';
import Authenticate from '../middlewares/Authenticate';

const router = Router();

router.get('/', Authenticate, getGenericData);

export default router;