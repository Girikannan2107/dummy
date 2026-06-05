from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from database.connection import db_client
from api.v1 import documents, webhooks

# 1. DEFINE DATABASE STARTUP/SHUTDOWN
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Connect to MongoDB at startup
    db_client.connect()
    yield
    # Disconnect from MongoDB at shutdown
    db_client.disconnect()

# 2. CREATE THE APP ONCE
app = FastAPI(
    title=settings.PROJECT_NAME or "Intelligent Document Processing API",
    version="2.1",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# 3. ADD CORS MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    # Restrict this to your actual Vercel/Frontend domains in production
    allow_origins=["http://localhost:5173", "https://your-app-name.vercel.app"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. MOUNT STATIC FILES FOR UPLOADS PREVIEW
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# 5. INCLUDE ROUTERS
app.include_router(
    documents.router, 
    prefix=f"{settings.API_V1_STR}", 
    tags=["Documents"]
)
app.include_router(
    webhooks.router, 
    prefix=f"{settings.API_V1_STR}", 
    tags=["Webhooks"]
)

# 6. ROOT AND HEALTH ENDPOINTS
@app.get("/")
async def root():
    return {"message": "IDP Engine is running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": settings.PROJECT_NAME or "IDP Engine"}