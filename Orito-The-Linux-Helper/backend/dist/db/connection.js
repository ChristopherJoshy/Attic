import mongoose from 'mongoose';
import { config } from '../config/index.js';
export async function connectDB() {
    // Optimized connection pool for 300+ concurrent users
    await mongoose.connect(config.MONGODB_URI, {
        maxPoolSize: 100, // Max 100 connections in pool (default is 10)
        minPoolSize: 10, // Keep 10 connections alive
        socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
        serverSelectionTimeoutMS: 5000, // Timeout after 5s if no server available
        heartbeatFrequencyMS: 10000, // Check server every 10s
        maxIdleTimeMS: 30000, // Close idle connections after 30s
        compressors: ['zlib'], // Enable compression for network traffic
    });
    // Set mongoose-level options for better performance
    mongoose.set('autoIndex', config.NODE_ENV === 'development'); // Only auto-create indexes in dev
    mongoose.set('maxTimeMS', 30000); // Global query timeout of 30s
}
export async function disconnectDB() {
    await mongoose.disconnect();
}
//# sourceMappingURL=connection.js.map