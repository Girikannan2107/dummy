from pydantic import BaseModel, Field
from typing import List, Optional, Any

# --- QUEUE PAGE MODELS ---
class DocumentHeaders(BaseModel):
    form_id: Optional[str] = None
    heat_no: Optional[str] = None
    planning_date: Optional[str] = None
    pouring_date_header: Optional[str] = None

class ProductDetails(BaseModel):
    description: Optional[str] = None
    customer: Optional[str] = None
    grade: Optional[str] = None
    casting_weight: Optional[str] = None
    liquid_weight: Optional[str] = None
    qty: Optional[str] = None
    sample_bulk: Optional[str] = None
    finish_type: Optional[str] = None
    pattern_code: Optional[str] = None
    pattern_serial_no: Optional[str] = None
    pattern_type: Optional[str] = None
    drawing_number: Optional[str] = None
    part_no: Optional[str] = None
    pcs_in_box: Optional[str] = None
    no_of_core_boxes: Optional[str] = None
    no_of_cores: Optional[str] = None
    method_remarks: Optional[str] = None

class SleeveTableItem(BaseModel):
    sle_code: Optional[str] = None
    sle_name: Optional[str] = None
    slv_qty: Optional[str] = None

class ConsumableItem(BaseModel):
    item: Optional[str] = None
    quantity: Optional[str] = None

class InspectionParameters(BaseModel):
    hardness_range_mould: Optional[str] = None
    hardness_range_core: Optional[str] = None
    coating_baume_value: Optional[str] = None
    core_oven_baking_on_time: Optional[str] = None
    core_oven_baking_off_time: Optional[str] = None
    core_oven_preheating_temp: Optional[str] = None
    no_of_cores: Optional[str] = None
    mould_coating: Optional[str] = None
    core_coating: Optional[str] = None
    lettering_checking: Optional[str] = None
    mould_core_visual_checking: Optional[str] = None
    mould_core_coating_application: Optional[str] = None
    core_setting_wall_thickness: Optional[str] = None
    mould_core_preheating: Optional[str] = None
    templates_checking: Optional[str] = None
    core_setting_inspector: Optional[str] = None
    closing_inspector: Optional[str] = None
    pouring_inspector: Optional[str] = None

class PouringDetails(BaseModel):
    pouring_date: Optional[str] = None
    pouring_time: Optional[str] = None
    pouring_qty: Optional[str] = None
    pouring_sec: Optional[str] = None
    tapping_temp: Optional[str] = None
    pouring_temp: Optional[str] = None
    laddle_temp: Optional[str] = None
    pouring_weight: Optional[str] = None
    core_making: Optional[str] = None

class BottomSignatures(BaseModel):
    planned_by: Optional[str] = None
    pattern_inspected_by: Optional[str] = None
    qa_parameters_checked_by: Optional[str] = None
    core_inspected_by: Optional[str] = None
    mould_inspected_by: Optional[str] = None
    closing_inspected_by: Optional[str] = None
    pouring_inspected_by: Optional[str] = None
    pre_production_inspected_by: Optional[str] = None

class QueueCardData(BaseModel):
    page_number: int
    document_headers: Optional[DocumentHeaders] = None
    product_details: Optional[ProductDetails] = None
    sleeve_table: Optional[List[SleeveTableItem]] = []
    printed_qa_requirements: Optional[List[str]] = []
    handwritten_consumables_list: Optional[List[ConsumableItem]] = []
    inspection_parameters: Optional[InspectionParameters] = None
    pouring_details: Optional[PouringDetails] = None
    bottom_signatures: Optional[BottomSignatures] = None

# --- BATCH TABLE PAGE MODEL ---
class BatchTableRow(BaseModel):
    p_order: Optional[str] = None
    material_code: Optional[str] = None
    material_description: Optional[str] = None
    batch_no: Optional[str] = None
    t_qty: Optional[str] = None
    unit: Optional[str] = None
    b_qty: Optional[str] = None
    t_c_wt: Optional[str] = None

# --- ROOT RESPONSE MODEL ---
class DocumentExtractionResult(BaseModel):
    queue_pages: List[QueueCardData]
    batch_summary: List[BatchTableRow]