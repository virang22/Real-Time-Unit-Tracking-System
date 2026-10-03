import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import morgan from 'morgan';
import path from 'path';
import { errorMiddleware } from './middlewares/error.middleware';
import routes from './routes/index.routes';
import env from './utils/validate-env';

export class App {
    public express: Express = express();

    constructor() {
        // Middlewares
        this.express.use(morgan('dev'));

        this.express.use(express.json({ limit: '200mb' }));
        this.express.use(cors({
            origin: (origin, callback) => {
                const isLocalDevelopmentOrigin = origin
                    ? /^https?:\/\/localhost:\d+$/.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/.test(origin)
                    : true;

                if (isLocalDevelopmentOrigin || origin === env.FRONT_URL) {
                    callback(null, true);
                    return;
                }

                callback(new Error('Origin not allowed by CORS'));
            },
            methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'PATCH', 'DELETE'],
            allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'access-token']
        }));

        // Static file serving for uploaded files
        this.express.use('/media', express.static(path.resolve(__dirname, '../uploads')));

        // Routes
        this.express.use('/api', routes);
        // Root route
        this.express.get('/', (req: Request, res: Response) => {
            res.send('Server Works! 🚀🚀 ');
        });
        // Health endpoint
        this.express.get('/health', (req: Request, res: Response) => {
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: env.NODE_ENV
            });
        });
    }
}

