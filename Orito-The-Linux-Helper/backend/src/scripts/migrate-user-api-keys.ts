/**
 * Migration script for user_api_keys collection
 * 
 * This script ensures the user_api_keys collection and indexes are created.
 * Run with: npm run migrate:user-api-keys
 * 
 * The Mongoose model will automatically create the collection on first use,
 * but this script ensures indexes are created explicitly for production deployments.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/orito';

async function migrate() {
    console.log('Connecting to MongoDB...');
    
    await mongoose.connect(MONGODB_URI, {
        maxPoolSize: 10,
    });
    
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('Database connection not established');
    }
    
    // Check if collection exists
    const collections = await db.listCollections({ name: 'user_api_keys' }).toArray();
    
    if (collections.length === 0) {
        console.log('Creating user_api_keys collection...');
        await db.createCollection('user_api_keys');
        console.log('Collection created successfully');
    } else {
        console.log('user_api_keys collection already exists');
    }
    
    // Create indexes
    console.log('Creating indexes...');
    
    // User ID index for fast lookups
    await db.collection('user_api_keys').createIndex(
        { userId: 1 },
        { name: 'userId_idx' }
    );
    console.log('  ✓ userId index created');
    
    // Compound unique index for userId + provider
    await db.collection('user_api_keys').createIndex(
        { userId: 1, provider: 1 },
        { unique: true, name: 'userId_provider_unique_idx' }
    );
    console.log('  ✓ userId+provider unique index created');
    
    // Created at index for sorting
    await db.collection('user_api_keys').createIndex(
        { createdAt: -1 },
        { name: 'createdAt_idx' }
    );
    console.log('  ✓ createdAt index created');
    
    console.log('\nMigration completed successfully!');
    
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
}

migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
