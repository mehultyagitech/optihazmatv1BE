import { Router } from 'express';
import {
    getAllDashboardData,
    getAllVesselDashboardData
} from '../controllers/DashboardController';
import Authenticate from '../middlewares/Authenticate';
import Paginate from '../middlewares/Pagination';

const router = Router();

router.get('/', Authenticate, getAllDashboardData);
router.get('/getAllVesselDashboardData/:vesselId', Authenticate, getAllVesselDashboardData);

export default router;