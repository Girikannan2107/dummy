from motor.motor_asyncio import AsyncIOMotorClient
from core.config import settings

class DatabaseClient:
    client: AsyncIOMotorClient = None

    def connect(self):
        try:
            # We configure a short connection timeout so that it fails fast and transparently
            # falls back to the file system if MongoDB is not available on localhost.
            self.client = AsyncIOMotorClient(settings.MONGO_URI, serverSelectionTimeoutMS=2000, tlsAllowInvalidCertificates=True)
            print("MongoDB client initialized successfully.")
        except Exception as e:
            print(f"MongoDB initialization error: {e}")
            self.client = None

    def disconnect(self):
        if self.client:
            try:
                self.client.close()
            except Exception:
                pass
            self.client = None

db_client = DatabaseClient()