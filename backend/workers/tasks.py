import asyncio
import fitz  # PyMuPDF for handling PDF page splitting
from celery import Celery
from core.config import settings
from ml_pipeline.engine import IntelligentDocumentProcessor
from motor.motor_asyncio import AsyncIOMotorClient

# Initialize Celery connected to Redis
celery_app = Celery(
    "idp_worker",
    broker=settings.REDIS_URI,
    backend=settings.REDIS_URI
)

# Initialize the ML Engine globally so models stay loaded in memory
print("Loading ML Models into Worker Memory...")
ocr_engine = IntelligentDocumentProcessor()

async def save_results_to_db(task_id: str, data: dict):
    """Async helper to save structured 6-page JSON output to MongoDB."""
    client = AsyncIOMotorClient(settings.MONGO_URI)
    db = client[settings.DB_NAME]
    
    document_record = {
        "task_id": task_id,
        "status": "COMPLETED",
        "extracted_data": {
            "queue_pages": data.get("queue_pages", []),
            "batch_summary": data.get("batch_summary", [])
        }
    }
    
    await db.processed_documents.insert_one(document_record)
    client.close()

@celery_app.task(bind=True, name="process_document")
def process_document_task(self, file_path: str):
    """
    The background task that runs the OCR pipeline, splitting the logic 
    between Queue Pages (1-5) and Batch Table Page (6).
    """
    try:
        # 1. Open the PDF 
        doc = fitz.open(file_path)
        
        queue_pages_data = []
        batch_summary_data = []

        # 2. Iterate through pages and route to the correct extraction logic
        for page_num in range(len(doc)):
            # Convert page to image bytes for the OCR engine
            page = doc.load_page(page_num)
            pix = page.get_pixmap(dpi=300) # 300 DPI for better OCR accuracy
            img_bytes = pix.tobytes("png")
            
            # Pages 1 to 5 (Indexes 0 to 4) -> Processing as Queue Cards
            if page_num < 5:
                # We assume you update IntelligentDocumentProcessor to have this method
                page_result = ocr_engine.process_queue_page(img_bytes, page_number=page_num + 1)
                queue_pages_data.append(page_result)
            
            # Page 6 (Index 5) -> Processing as Tabular Batch Summary
            elif page_num == 5:
                # We assume you update IntelligentDocumentProcessor to have this method
                batch_summary_data = ocr_engine.process_batch_page(img_bytes)

        # 3. Aggregate the results into our new dual-layout schema
        extracted_results = {
            "queue_pages": queue_pages_data,
            "batch_summary": batch_summary_data
        }
        
        # 4. Save to Database (handling async Mongo in a sync Celery thread)
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
        loop.run_until_complete(save_results_to_db(self.request.id, extracted_results))
        
        return {"status": "success", "data": extracted_results}
        
    except Exception as e:
        # Log the error and fail the task gracefully
        return {"status": "error", "message": str(e)}