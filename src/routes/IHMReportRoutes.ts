import { Router } from 'express';
import {
  generateIHMReport,
  getIHMReports,
  updateIHMReport,
  deleteIHMReport,
} from '../controllers/IHMReportController';
import Authenticate from '../middlewares/Authenticate';

const IHMReportRoutes = Router();

IHMReportRoutes.get('/vessels/:id/ihm-reports', Authenticate, getIHMReports);
IHMReportRoutes.post('/vessels/:id/ihm-reports', Authenticate, generateIHMReport);
IHMReportRoutes.patch('/ihm-reports/:reportId', Authenticate, updateIHMReport);
IHMReportRoutes.delete('/ihm-reports/:reportId', Authenticate, deleteIHMReport);

export default IHMReportRoutes;
