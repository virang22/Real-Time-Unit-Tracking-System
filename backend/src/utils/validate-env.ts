import { bool, cleanEnv, port, str } from 'envalid';

const env = cleanEnv(process.env, {
    NODE_ENV: str({ choices: ['development', 'production', 'staging'] }),

    PORT: port(),

    API_URL: str(),
    FRONT_URL: str(),

    MONGODB_URI: str(),

    SECRET_KEY: str(),

    // Seeding
    SEED: bool(),

    // SMTP Configuration
    SMTP_SERVICE: str(),
    SMTP_HOST: str(),
    SMTP_PORT: port(),
    SMTP_SECURE: bool(),
    SMTP_EMAIL: str(),
    SMTP_PASSWORD: str(),
    SMTP_RECEIVER_EMAIL: str(),
});

export default env; 