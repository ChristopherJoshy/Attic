import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as redis
from dotenv import load_dotenv

# Add parent directory to path to import config if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

async def clear_mongo_db(uri: str, db_name: str, label: str = "MongoDB"):
    print(f"\n🔍 Checking {label}...")
    
    # Load .env from Backend root (parent of this script)
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    load_dotenv(env_path)
    
    if not uri:
        print(f"   Skipping {label} (No URI provided)")
        return

    # Mask credential for logs
    masked_uri = uri.split("@")[-1] if "@" in uri else "localhost"
    print(f"   Connecting to {masked_uri} (DB: {db_name})...")
    
    client = AsyncIOMotorClient(uri)
    try:
        db = client[db_name]
        collections = await db.list_collection_names()
        
        if not collections:
            print(f"   ✅ {label} is already empty.")
            return

        print(f"   Found collections: {', '.join(collections)}")
        for col_name in collections:
            if col_name.startswith("system."):
                continue
            print(f"   🔥 Dropping collection: {col_name}...")
            await db[col_name].drop()
            
        print(f"   ✨ {label} cleared successfully!")
    except Exception as e:
        print(f"   ❌ Error clearing {label}: {e}")
    finally:
        client.close()

async def clear_redis(url: str):
    print(f"\nmagnifying glass Checking Redis...")
    if not url:
        print("   Skipping Redis (No URL provided)")
        return

    masked_url = url.split("@")[-1] if "@" in url else "localhost"
    print(f"   Connecting to {masked_url}...")
    
    try:
        r = redis.from_url(url, decode_responses=True)
        await r.flushdb()
        print("   ✨ Redis cleared successfully!")
        await r.close()
    except Exception as e:
        print(f"   ❌ Error clearing Redis: {e}")

async def clear_all():
    print("🗑️  STARTING COMPLETE DATABASE CLEANUP 🗑️")
    load_dotenv()
    
    # 1. Local/Main MongoDB
    mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DATABASE", "evotaion")
    await clear_mongo_db(mongo_uri, db_name, "Main MongoDB")
    
    # 2. Render/Production MongoDB (if explicitly set)
    render_uri = os.getenv("RENDER_MONGODB_URI") or os.getenv("PROD_MONGODB_URI")
    render_db_name = os.getenv("RENDER_MONGODB_DATABASE", db_name)
    if render_uri:
        await clear_mongo_db(render_uri, render_db_name, "Render/Prod MongoDB")
        
    # 3. Redis
    redis_url = os.getenv("REDIS_URL")
    await clear_redis(redis_url)
    
    print("\n✅ All cleanup tasks finished.")

if __name__ == "__main__":
    # Install redis if missing: pip install redis
    try:
        import redis
    except ImportError:
        print("Installing redis package...")
        os.system("pip install redis")
        
    asyncio.run(clear_all())
