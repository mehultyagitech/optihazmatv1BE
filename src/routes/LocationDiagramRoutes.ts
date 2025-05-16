import { Router } from 'express';
import Authenticate from '../middlewares/Authenticate';
import { getAllLocationDiagrams } from '../controllers/LocationDiagramController';
import Paginate from '../middlewares/Pagination';

const LocationDiagramRoutes = Router();

LocationDiagramRoutes.use(Authenticate);
LocationDiagramRoutes.get('/:vesselId', Paginate, getAllLocationDiagrams);

export default LocationDiagramRoutes;