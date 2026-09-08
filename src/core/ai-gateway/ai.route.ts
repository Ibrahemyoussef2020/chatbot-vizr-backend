import { Router } from 'express';
import { AIController } from './ai.controller.js';
import { AIMiddleware } from './ai.middleware.js';
import authenticate from '../../middlewares/authenticate.middleware.js';

const aiRouter = Router();
aiRouter.use(authenticate);

aiRouter.post('/stream', AIMiddleware.validateStreamPayload, AIController.handleStream);
aiRouter.post('/generate', AIMiddleware.validateGeneratePayload, AIController.handleGenerate);

export default aiRouter; 
