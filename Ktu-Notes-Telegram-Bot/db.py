try:
    from motor.motor_asyncio import AsyncIOMotorClient
    MONGODB_AVAILABLE = True
except ImportError:
    AsyncIOMotorClient = None
    MONGODB_AVAILABLE = False
try:
    from bson import ObjectId
except Exception:
    ObjectId = None
from datetime import datetime, timedelta
import logging
import uuid
from config import MONGODB_URI, DATABASE_NAME, PENDING_EXPIRY_DAYS

logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        self.client = None
        self.db = None
    
    def _to_mongo_id(self, value):
        """Best-effort convert string id to ObjectId when available."""
        if value is None:
            return None
        if ObjectId is None:
            return value
        # If already ObjectId, return as is
        if isinstance(value, ObjectId):
            return value
        # Try convert from string
        try:
            return ObjectId(str(value))
        except Exception:
            return value
    
    async def connect(self):
        if not MONGODB_AVAILABLE:
            logger.warning("MongoDB not available, using in-memory storage")
            self.memory_store = {
                'categories': [],
                'resources': [],
                'pending_resources': [],
                'pending_categories': []
            }
            return
            
        try:
            # Add connection timeout and test the connection
            self.client = AsyncIOMotorClient(
                MONGODB_URI,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                socketTimeoutMS=5000
            )
            # Test the connection
            await self.client.admin.command('ping')
            self.db = self.client[DATABASE_NAME]
            await self.setup_indexes()
            logger.info("Successfully connected to MongoDB")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            logger.warning("Using in-memory storage instead")
            self.client = None
            self.db = None
            self.memory_store = {
                'categories': [],
                'resources': [],
                'pending_resources': [],
                'pending_categories': []
            }
    
    async def setup_indexes(self):
        try:
            await self.db.pending_resources.create_index("expires_at", expireAfterSeconds=0)
            await self.db.pending_categories.create_index("expires_at", expireAfterSeconds=0)
            logger.info("TTL indexes created successfully")
        except Exception as e:
            logger.error(f"Failed to create indexes: {e}")
    
    async def get_schemes(self):
        try:
            if hasattr(self, 'memory_store'):
                schemes = list(set(cat['scheme'] for cat in self.memory_store['categories']))
                logger.info(f"Retrieved {len(schemes)} schemes from memory")
                return sorted(schemes)
            else:
                schemes = await self.db.categories.distinct("scheme")
                logger.info(f"Retrieved {len(schemes)} schemes")
                return sorted(schemes)
        except Exception as e:
            logger.error(f"Error getting schemes: {e}")
            return []
    
    async def get_branches(self, scheme):
        try:
            if hasattr(self, 'memory_store'):
                branches = list(set(cat['branch'] for cat in self.memory_store['categories'] if cat['scheme'] == scheme))
                logger.info(f"Retrieved {len(branches)} branches for scheme {scheme} from memory")
                return sorted(branches)
            else:
                branches = await self.db.categories.distinct("branch", {"scheme": scheme})
                logger.info(f"Retrieved {len(branches)} branches for scheme {scheme}")
                return sorted(branches)
        except Exception as e:
            logger.error(f"Error getting branches: {e}")
            return []
    
    async def get_semesters(self, scheme, branch):
        try:
            if hasattr(self, 'memory_store'):
                semesters = list(set(cat['semester'] for cat in self.memory_store['categories'] if cat['scheme'] == scheme and cat['branch'] == branch))
                logger.info(f"Retrieved {len(semesters)} semesters for {scheme}/{branch} from memory")
                return sorted(semesters, key=str)
            else:
                semesters = await self.db.categories.distinct("semester", {"scheme": scheme, "branch": branch})
                logger.info(f"Retrieved {len(semesters)} semesters for {scheme}/{branch}")
                return sorted(semesters, key=int)
        except Exception as e:
            logger.error(f"Error getting semesters: {e}")
            return []
    
    async def get_subjects(self, scheme, branch, semester):
        try:
            if hasattr(self, 'memory_store'):
                subjects = list(set(cat['subject'] for cat in self.memory_store['categories'] 
                               if cat['scheme'] == scheme and cat['branch'] == branch and cat['semester'] == semester))
                logger.info(f"Retrieved {len(subjects)} subjects for {scheme}/{branch}/{semester} from memory")
                return sorted(subjects)
            else:
                subjects = await self.db.categories.distinct("subject", {
                    "scheme": scheme, 
                    "branch": branch, 
                    "semester": semester
                })
                logger.info(f"Retrieved {len(subjects)} subjects for {scheme}/{branch}/{semester}")
                return sorted(subjects)
        except Exception as e:
            logger.error(f"Error getting subjects: {e}")
            return []
    
    async def get_resources(self, scheme, branch, semester, subject, resource_type, module: str | None = None):
        try:
            if hasattr(self, 'memory_store'):
                resources = [r for r in self.memory_store['resources'] 
                           if r['scheme'] == scheme and r['branch'] == branch 
                           and r['semester'] == semester and r['subject'] == subject 
                           and r['type'] == resource_type and (module in (None, 'all') or r.get('module') == module)]
                logger.info(f"Retrieved {len(resources)} {resource_type} resources for {scheme}/{branch}/{semester}/{subject} (module={module}) from memory")
                return resources
            else:
                query = {
                    "scheme": scheme,
                    "branch": branch,
                    "semester": semester,
                    "subject": subject,
                    "type": resource_type
                }
                if module and module != 'all':
                    query["module"] = module
                resources = await self.db.resources.find(query).to_list(None)
                logger.info(f"Retrieved {len(resources)} {resource_type} resources for {scheme}/{branch}/{semester}/{subject} (module={module})")
                return resources
        except Exception as e:
            logger.error(f"Error getting resources: {e}")
            return []
    
    async def add_pending_resource(self, user_id, scheme, branch, semester, subject, resource_type, data, module: str | None = None):
        try:
            expires_at = datetime.utcnow() + timedelta(days=PENDING_EXPIRY_DAYS)
            resource = {
                "scheme": scheme,
                "branch": branch,
                "semester": semester,
                "subject": subject,
                "type": resource_type,
                "module": module,
                "data": data,
                "submitted_by": user_id,
                "submitted_at": datetime.utcnow(),
                "expires_at": expires_at
            }
            
            if hasattr(self, 'memory_store'):
                resource_id = str(uuid.uuid4())
                resource["_id"] = resource_id
                self.memory_store['pending_resources'].append(resource)
                logger.info(f"Added pending resource {resource_id} by user {user_id} to memory")
                return resource_id
            else:
                result = await self.db.pending_resources.insert_one(resource)
                logger.info(f"Added pending resource {result.inserted_id} by user {user_id}")
                return result.inserted_id
        except Exception as e:
            logger.error(f"Error adding pending resource: {e}")
            return None
    
    async def add_pending_category(self, user_id, scheme, branch, semester, subject):
        try:
            expires_at = datetime.utcnow() + timedelta(days=PENDING_EXPIRY_DAYS)
            category = {
                "scheme": scheme,
                "branch": branch,
                "semester": semester,
                "subject": subject,
                "submitted_by": user_id,
                "submitted_at": datetime.utcnow(),
                "expires_at": expires_at
            }
            
            if hasattr(self, 'memory_store'):
                category_id = str(uuid.uuid4())
                category["_id"] = category_id
                self.memory_store['pending_categories'].append(category)
                logger.info(f"Added pending category {category_id} by user {user_id} to memory")
                return category_id
            else:
                result = await self.db.pending_categories.insert_one(category)
                logger.info(f"Added pending category {result.inserted_id} by user {user_id}")
                return result.inserted_id
        except Exception as e:
            logger.error(f"Error adding pending category: {e}")
            return None
    
    async def get_pending_resources(self):
        try:
            if hasattr(self, 'memory_store'):
                resources = self.memory_store['pending_resources']
                logger.info(f"Retrieved {len(resources)} pending resources from memory")
                return resources
            else:
                resources = await self.db.pending_resources.find().to_list(None)
                logger.info(f"Retrieved {len(resources)} pending resources")
                return resources
        except Exception as e:
            logger.error(f"Error getting pending resources: {e}")
            return []
    
    async def get_pending_categories(self):
        try:
            if hasattr(self, 'memory_store'):
                categories = self.memory_store['pending_categories']
                logger.info(f"Retrieved {len(categories)} pending categories from memory")
                return categories
            else:
                categories = await self.db.pending_categories.find().to_list(None)
                logger.info(f"Retrieved {len(categories)} pending categories")
                return categories
        except Exception as e:
            logger.error(f"Error getting pending categories: {e}")
            return []
    
    async def approve_resource(self, resource_id):
        try:
            if hasattr(self, 'memory_store'):
                pending_resources = self.memory_store['pending_resources']
                resource = None
                for i, r in enumerate(pending_resources):
                    if r.get('_id') == resource_id:
                        resource = pending_resources.pop(i)
                        break
                
                if resource:
                    resource_copy = resource.copy()
                    for key in ['_id', 'submitted_by', 'submitted_at', 'expires_at']:
                        resource_copy.pop(key, None)
                    resource_copy['date_added'] = datetime.utcnow()
                    self.memory_store['resources'].append(resource_copy)
                    logger.info(f"Approved and moved resource {resource_id} in memory")
                    return True
            else:
                mongo_id = self._to_mongo_id(resource_id)
                resource = await self.db.pending_resources.find_one({"_id": mongo_id})
                if resource:
                    del resource["_id"]
                    del resource["submitted_by"]
                    del resource["submitted_at"]
                    del resource["expires_at"]
                    resource["date_added"] = datetime.utcnow()
                    
                    await self.db.resources.insert_one(resource)
                    await self.db.pending_resources.delete_one({"_id": mongo_id})
                    logger.info(f"Approved and moved resource {resource_id}")
                    return True
        except Exception as e:
            logger.error(f"Error approving resource: {e}")
        return False
    
    async def approve_category(self, category_id):
        try:
            if hasattr(self, 'memory_store'):
                pending_categories = self.memory_store['pending_categories']
                category = None
                for i, c in enumerate(pending_categories):
                    if c.get('_id') == category_id:
                        category = pending_categories.pop(i)
                        break
                
                if category:
                    category_copy = category.copy()
                    for key in ['_id', 'submitted_by', 'submitted_at', 'expires_at']:
                        category_copy.pop(key, None)
                    
                    # Check if category already exists
                    existing = any(c['scheme'] == category_copy['scheme'] and 
                                 c['branch'] == category_copy['branch'] and 
                                 c['semester'] == category_copy['semester'] and 
                                 c['subject'] == category_copy['subject'] 
                                 for c in self.memory_store['categories'])
                    
                    if not existing:
                        self.memory_store['categories'].append(category_copy)
                    
                    logger.info(f"Approved and moved category {category_id} in memory")
                    return True
            else:
                mongo_id = self._to_mongo_id(category_id)
                category = await self.db.pending_categories.find_one({"_id": mongo_id})
                if category:
                    del category["_id"]
                    del category["submitted_by"]
                    del category["submitted_at"]
                    del category["expires_at"]
                    
                    existing = await self.db.categories.find_one(category)
                    if not existing:
                        await self.db.categories.insert_one(category)
                    
                    await self.db.pending_categories.delete_one({"_id": mongo_id})
                    logger.info(f"Approved and moved category {category_id}")
                    return True
        except Exception as e:
            logger.error(f"Error approving category: {e}")
        return False
    
    async def reject_resource(self, resource_id):
        try:
            if hasattr(self, 'memory_store'):
                pending_resources = self.memory_store['pending_resources']
                for i, r in enumerate(pending_resources):
                    if r.get('_id') == resource_id:
                        pending_resources.pop(i)
                        logger.info(f"Rejected resource {resource_id} from memory")
                        return True
                return False
            else:
                mongo_id = self._to_mongo_id(resource_id)
                result = await self.db.pending_resources.delete_one({"_id": mongo_id})
                logger.info(f"Rejected resource {resource_id}")
                return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error rejecting resource: {e}")
            return False
    
    async def reject_category(self, category_id):
        try:
            if hasattr(self, 'memory_store'):
                pending_categories = self.memory_store['pending_categories']
                for i, c in enumerate(pending_categories):
                    if c.get('_id') == category_id:
                        pending_categories.pop(i)
                        logger.info(f"Rejected category {category_id} from memory")
                        return True
                return False
            else:
                mongo_id = self._to_mongo_id(category_id)
                result = await self.db.pending_categories.delete_one({"_id": mongo_id})
                logger.info(f"Rejected category {category_id}")
                return result.deleted_count > 0
        except Exception as e:
            logger.error(f"Error rejecting category: {e}")
            return False
    
    async def category_exists(self, scheme, branch, semester, subject):
        try:
            if hasattr(self, 'memory_store'):
                exists = any(c['scheme'] == scheme and c['branch'] == branch and 
                           c['semester'] == semester and c['subject'] == subject 
                           for c in self.memory_store['categories'])
                return exists
            else:
                exists = await self.db.categories.find_one({
                    "scheme": scheme,
                    "branch": branch,
                    "semester": semester,
                    "subject": subject
                })
                return exists is not None
        except Exception as e:
            logger.error(f"Error checking category existence: {e}")
            return False

    async def get_modules(self, scheme, branch, semester, subject):
        """Return distinct module labels for resources under the given path."""
        try:
            if hasattr(self, 'memory_store'):
                mods = list({r.get('module') for r in self.memory_store['resources']
                             if r['scheme'] == scheme and r['branch'] == branch and r['semester'] == semester and r['subject'] == subject and r.get('module')})
                return sorted(mods)
            else:
                mods = await self.db.resources.distinct("module", {
                    "scheme": scheme,
                    "branch": branch,
                    "semester": semester,
                    "subject": subject
                })
                # Filter out None values
                mods = [m for m in mods if m]
                return sorted(mods)
        except Exception as e:
            logger.error(f"Error getting modules: {e}")
            return []

db = Database()
