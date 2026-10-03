import { Router } from 'express';
import { getUserWithPassword } from '../controllers/admin.controller';

const adminRouter = Router();

// Development‑only endpoint to view a user together with its hashed password
adminRouter.get('/users/:id', getUserWithPassword);

export default adminRouter;
