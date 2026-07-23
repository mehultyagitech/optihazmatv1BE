import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  disableUser,
} from '../controllers/UserController';
import Authenticate from '../middlewares/Authenticate';
import HasRole from '../middlewares/HasRole';
import Paginate from '../middlewares/Pagination';
import { getClientManagers,getClientManager,createClientManager,updateClientManager,getSubLocation,deleteClientManager } from '../controllers/ClientManagerController';

const UserRoutes = Router();

UserRoutes.get('/me', Authenticate, (_, res) => {
  res.status(200).json({ success: true, data: res.locals.user });
});
UserRoutes.get('/users', Authenticate, HasRole(Role.ADMIN), Paginate, getUsers);
UserRoutes.post('/users', Authenticate, HasRole(Role.ADMIN), createUser);
UserRoutes.get('/users/:id', Authenticate, getUser);
UserRoutes.put('/users/:id', Authenticate, HasRole(Role.ADMIN), updateUser);
UserRoutes.post(
  '/users/:id/disable',
  Authenticate,
  HasRole(Role.ADMIN),
  disableUser,
);
UserRoutes.get('/client-managers', Authenticate, getClientManagers);
UserRoutes.get('/client-managers/:id', Authenticate, getClientManager);
UserRoutes.post('/client-managers', Authenticate, createClientManager);
UserRoutes.put('/client-managers/:id', Authenticate, updateClientManager);
UserRoutes.get('/sub-location', Authenticate, getSubLocation);
UserRoutes.put('/delete-client-managers/:id', Authenticate, deleteClientManager);

export default UserRoutes;
