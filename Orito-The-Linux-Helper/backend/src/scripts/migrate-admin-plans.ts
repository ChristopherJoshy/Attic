import mongoose from 'mongoose';
import pino from 'pino';
import { User } from '../models/user.js';
import { config } from '../config/index.js';

const logger = pino({
    transport: {
        target: 'pino-pretty',
        options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            colorize: true,
        }
    }
});

async function migrateAdminPlans() {
    try {
        logger.info('Starting admin plan migration...');
        await mongoose.connect(config.MONGODB_URI);
        logger.info('Connected to MongoDB');

        const result = await User.updateMany(
            { isAdmin: true, tier: { $ne: 'pro' } },
            { $set: { tier: 'pro' } }
        );

        logger.info({ 
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount 
        }, 'Admin users upgraded to Pro tier');

        await mongoose.disconnect();
        logger.info('Migration complete');
        process.exit(0);
    } catch (error) {
        logger.error({ error }, 'Migration failed');
        process.exit(1);
    }
}

migrateAdminPlans();
