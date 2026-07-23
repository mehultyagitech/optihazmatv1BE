import { Router } from 'express';
import {
  createPurchaseOrdersBulk,
  getPurchaseOrders,
  clearPurchaseOrders,
} from '../controllers/PurchaseOrderController';
import Authenticate from '../middlewares/Authenticate';

const PurchaseOrderRoutes = Router();

PurchaseOrderRoutes.get('/', Authenticate, getPurchaseOrders);
PurchaseOrderRoutes.post('/bulk', Authenticate, createPurchaseOrdersBulk);
PurchaseOrderRoutes.delete('/', Authenticate, clearPurchaseOrders);

export default PurchaseOrderRoutes;
