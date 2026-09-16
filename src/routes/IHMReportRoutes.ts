import { Router } from 'express';
import {
  generateIHMReport,
  getIHMReports,
  updateIHMReport,
  deleteIHMReport,
} from '../controllers/IHMReportController';
import Authenticate from '../middlewares/Authenticate';
import HasRole from '../middlewares/HasRole';
import { Role } from '@prisma/client';
import {
  getIHMCertificateStates,
  setIHMCertificateState,
} from '../controllers/IHMCertificateController';

const IHMReportRoutes = Router();

IHMReportRoutes.get('/vessels/:id/ihm-reports', Authenticate, getIHMReports);
IHMReportRoutes.post('/vessels/:id/ihm-reports', Authenticate, generateIHMReport);
IHMReportRoutes.patch('/ihm-reports/:reportId', Authenticate, updateIHMReport);
IHMReportRoutes.delete('/ihm-reports/:reportId', Authenticate, deleteIHMReport);

// IHM maintenance certificate trail: active / inactive per period.
IHMReportRoutes.get('/vessels/:id/ihm-certificates', Authenticate, getIHMCertificateStates);
IHMReportRoutes.patch(
  '/vessels/:id/ihm-certificates/:period',
  Authenticate,
  HasRole(Role.ADMIN),
  setIHMCertificateState,
);

export default IHMReportRoutes;
