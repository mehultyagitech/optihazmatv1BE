import { Router } from 'express';
import { Role } from '@prisma/client';
import { getUsers, getUser, disableUser } from '../controllers/UserController';
import Authenticate from '../middlewares/Authenticate';
import HasRole from '../middlewares/HasRole';
import Paginate from '../middlewares/Pagination';
import { getClientManagers,getClientManager,createClientManager,updateClientManager,getSubLocation } from '../controllers/ClientManagerController';

const UserRoutes = Router();

UserRoutes.get('/me', Authenticate, (_, res) => {
  res.status(200).json({ success: true, data: res.locals.user });
});
UserRoutes.get('/users', Authenticate, HasRole(Role.ADMIN), Paginate, getUsers);
UserRoutes.get('/users/:id', Authenticate, getUser);
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

export default UserRoutes;
