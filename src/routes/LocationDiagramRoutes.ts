import { Router } from 'express';
import Authenticate from '../middlewares/Authenticate';
import {
  getAllLocationDiagrams,
  createLocationDiagram,
  getLocationDiagramById,
  updateLocationDiagram,
  deleteLocationDiagram,
  bulkDeleteLocationDiagrams,
} from '../controllers/LocationDiagramController';
import Paginate from '../middlewares/Pagination';
import upload from '../middlewares/Multer';

const LocationDiagramRoutes = Router();

LocationDiagramRoutes.use(Authenticate);
LocationDiagramRoutes.get('/:vesselId', Paginate, getAllLocationDiagrams);
LocationDiagramRoutes.post('/:vesselId', upload.single('image'), createLocationDiagram);
LocationDiagramRoutes.get('/:vesselId/:LocationDiagramId', getLocationDiagramById);
LocationDiagramRoutes.post('/:vesselId/bulk-delete', bulkDeleteLocationDiagrams);
LocationDiagramRoutes.put('/:vesselId/:LocationDiagramId', upload.single('image'), updateLocationDiagram);
LocationDiagramRoutes.delete('/:vesselId/:LocationDiagramId', deleteLocationDiagram);

export default LocationDiagramRoutes;