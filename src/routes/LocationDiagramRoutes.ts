import { Router } from 'express';
import Authenticate from '../middlewares/Authenticate';
import { getAllLocationDiagrams, createLocationDiagram } from '../controllers/LocationDiagramController';
import Paginate from '../middlewares/Pagination';
import upload from '../middlewares/Multer';

const LocationDiagramRoutes = Router();

LocationDiagramRoutes.use(Authenticate);
LocationDiagramRoutes.get('/:vesselId', Paginate, getAllLocationDiagrams);
LocationDiagramRoutes.post('/:vesselId', upload.single('image'), createLocationDiagram);

export default LocationDiagramRoutes;