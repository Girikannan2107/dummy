from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import StreamingResponse
from fastapi.concurrency import run_in_threadpool
from core.config import settings
from ml_pipeline.engine import IntelligentDocumentProcessor
from api.dependencies import get_db
from database.repository import DocumentRepository
import aiofiles
import os
import uuid
import io
import pandas as pd

router = APIRouter()

# Load the ML engine directly into the API memory (Bypassing Celery/Redis)
print("Loading ML Models directly into FastAPI...")
ocr_engine = IntelligentDocumentProcessor()

@router.post("/documents/process")
async def upload_and_process_document(file: UploadFile = File(...), db = Depends(get_db)):
    """
    Accepts an industrial scan and processes it IMMEDIATELY, 
    returning the extracted JSON data and storing it in the database.
    """
    allowed_types = ["image/jpeg", "image/png", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use JPG, PNG, or PDF.")

    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    # Save file
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)

    try:
        # Assumes ocr_engine.process_document now handles the 6-page PDF splitting 
        # and returns {"queue_pages": [...], "batch_summary": [...]}
        extracted_results = await run_in_threadpool(ocr_engine.process_document, file_path)
        
        # Enhanced debugging log
        print(f"DEBUG - Extracted results payload: {extracted_results}")
        
        if isinstance(extracted_results, dict) and "error" in extracted_results:
            raise HTTPException(
                status_code=422, 
                detail=f"AI Extraction Pipeline Error: {extracted_results['error']}"
            )
            
        # Save to database (MongoDB)
        task_id = uuid.uuid4().hex
        repo = DocumentRepository(db)
        # Ensure it saves the new dual-schema structure
        await repo.save_document(task_id, extracted_results)
        
        return {
            "message": "Document processed successfully",
            "filename": unique_filename,
            "task_id": task_id,
            "data": extracted_results 
        }
    except HTTPException as he:
        # Do not let our explicit HTTP exceptions get swallowed by the generic 500 block
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed inside route: {str(e)}")

@router.get("/documents")
async def get_all_processed_documents(db = Depends(get_db)):
    """
    Retrieves all processed document records from the database.
    """
    try:
        repo = DocumentRepository(db)
        records = await repo.get_all_documents()
        return records
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve records: {str(e)}")

@router.get("/documents/export")
async def export_all_data_to_excel(db = Depends(get_db)):
    """
    Aggregates all processed document records and converts them to a multi-sheet Excel file.
    Sheet 1: Queue Data (Pages 1-5)
    Sheet 2: Batch Summary (Page 6)
    """
    if db is None:
        raise HTTPException(status_code=500, detail="Database connection is not initialized.")
        
    try:
        collection = db["processed_documents"]
        
        # Fetch all documents that have extracted data
        cursor = collection.find({"extracted_data": {"$exists": True}})
        documents = await cursor.to_list(length=10000)

        queue_rows = []
        batch_rows = []

        # Parse the JSON structure into flat rows for Excel
        for doc in documents:
            data = doc.get("extracted_data", {})
            
            # 1. Flatten Queue Pages
            for page in data.get("queue_pages", []):
                prod = page.get("production_plan", {})
                qa = page.get("qa_parameters", {})
                pour = page.get("pouring_details", {})
                
                queue_rows.append({
                    "Task ID": doc.get("task_id", "N/A"),
                    "Page No": page.get("page_number", ""),
                    "Heat No": prod.get("heat_no", ""),
                    "Planning Date": prod.get("planning_date", ""),
                    "Pouring Date": prod.get("pouring_date", ""),
                    "Customer": prod.get("customer", ""),
                    "Grade": prod.get("grade", ""),
                    "Casting Wt": prod.get("casting_weight", ""),
                    "Mould Hardness": qa.get("hardness_mould", ""),
                    "Core Hardness": qa.get("hardness_core", ""),
                    "Pouring Time": pour.get("pouring_time", ""),
                    "Tapping Temp": pour.get("tapping_temp", ""),
                    "Pouring Temp": pour.get("pouring_temp", ""),
                    "Laddle Temp": pour.get("laddle_temp", ""),
                    "Pouring Wt": pour.get("pouring_weight", "")
                })
            
            # 2. Flatten Batch Summary Table
            for row in data.get("batch_summary", []):
                batch_rows.append({
                    "Task ID": doc.get("task_id", "N/A"),
                    "Material Code": row.get("material_code", ""),
                    "Material Description": row.get("material_description", ""),
                    "Batch No": row.get("batch_no", ""),
                    "Total Qty": row.get("t_qty", ""),
                    "Unit": row.get("unit", "")
                })

        # Convert to Pandas DataFrames
        df_queue = pd.DataFrame(queue_rows) if queue_rows else pd.DataFrame(columns=["Heat No", "Pouring Date", "Customer"])
        df_batch = pd.DataFrame(batch_rows) if batch_rows else pd.DataFrame(columns=["Material Code", "Batch No", "Total Qty"])
            
        # Write to memory buffer
        buffer = io.BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df_queue.to_excel(writer, index=False, sheet_name='Production Queue (P1-P5)')
            df_batch.to_excel(writer, index=False, sheet_name='Batch Summary (P6)')
            
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=manufacturing_records.xlsx"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export data: {str(e)}")

@router.get("/documents/status/{task_id}")
async def get_processing_status(task_id: str):
    return {"task_id": task_id, "status": "SYNC_MODE_ACTIVE", "message": "Redis is disabled. Check the main /process route for output."}