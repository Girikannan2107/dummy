from pydantic import BaseModel, Field
from typing import List, Optional

# --- QUEUE DATA SCHEMAS (Pages 1 to N-1) ---
class ProductionPlan(BaseModel):
    heat_no: Optional[str] = Field(None, description="e.g., A09599-01")
    planning_date: Optional[str] = None
    pouring_date: Optional[str] = None
    customer: Optional[str] = None
    grade: Optional[str] = None
    casting_weight: Optional[str] = None

class QAParameters(BaseModel):
    hardness_mould: Optional[str] = Field(None, description="Extract the Mould Hardness value/range")
    hardness_core: Optional[str] = Field(None, description="Extract the Core Hardness value/range")

class PouringDetails(BaseModel):
    pouring_time: Optional[str] = None
    tapping_temp: Optional[str] = Field(None, description="Tapping Temperature (e.g., 1610°C)")
    pouring_temp: Optional[str] = Field(None, description="Pouring Temperature")
    laddle_temp: Optional[str] = Field(None, description="Laddle Temperature")
    pouring_weight: Optional[str] = None

class QueueCardData(BaseModel):
    page_number: int
    production_plan: ProductionPlan
    qa_parameters: QAParameters
    pouring_details: PouringDetails

# --- BATCH TABLE SCHEMA (Final Page) ---
class BatchTableRow(BaseModel):
    material_code: Optional[str] = None
    material_description: Optional[str] = None
    batch_no: Optional[str] = None
    t_qty: Optional[str] = Field(None, description="Total Quantity")
    unit: Optional[str] = None