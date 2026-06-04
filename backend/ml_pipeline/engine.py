import fitz  # PyMuPDF
import base64
import json
import os
import mimetypes
import requests
from core.config import settings

class IntelligentDocumentProcessor:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")

    def process_document(self, file_path: str) -> dict:
        if not self.api_key:    
            return {"error": "Missing GEMINI_API_KEY. Please set the environment variable."}

        print(f"1. Reading Document: {file_path}")
        parts = []

        # Determine if the file is a PDF or an Image
        mime_type, _ = mimetypes.guess_type(file_path)
        
        try:
            if mime_type == 'application/pdf':
                doc = fitz.open(file_path)
                print(f"2. Extracting {len(doc)} pages as images for Gemini Vision...")
                for page_num in range(len(doc)):
                    page = doc.load_page(page_num)
                    pix = page.get_pixmap(dpi=200) 
                    img_data = pix.tobytes("jpeg")
                    img_base64 = base64.b64encode(img_data).decode('utf-8')
                    
                    parts.append({
                        "inlineData": {
                            "mimeType": "image/jpeg",
                            "data": img_base64
                        }
                    })
                doc.close()
                
            elif mime_type in ['image/jpeg', 'image/png']:
                print("2. Encoding single image for Gemini Vision...")
                with open(file_path, "rb") as image_file:
                    img_data = image_file.read()
                    img_base64 = base64.b64encode(img_data).decode('utf-8')
                    
                    parts.append({
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": img_base64
                        }
                    })
            else:
                 return {"error": f"Unsupported file type: {mime_type}. Please upload PDF, JPG, or PNG."}

        except Exception as e:
            return {"error": f"Failed to process file: {str(e)}"}

        # --- THE EXHAUSTIVE PROMPT ---
        prompt = """
You are an expert Foundry Production Plan OCR + Data Extraction AI.

TASK:
Extract ALL printed and handwritten data from multi-page pouring/manufacturing documents.

RULES:

1. Pages 1..N-1 = Production Plan pages.
2. Last page = Batch Summary page.
3. Handwritten values override printed values.
4. Ignore crossed-out values.
5. Extract all visible data exactly as written.
6. Material consumption lists may appear as handwritten numbered items; extract dynamically.
7. Preserve units (kg, Nos, °C, PM, etc.).
8. If blank, return "".
9. Return VALID JSON ONLY.
10. Do not summarize or explain.

JSON:

{
"queue_pages":[
{
"page_number":"",
"document_headers":{
"form_id":"",
"heat_no":"",
"planning_date":"",
"pouring_date_header":""
},

```
  "product_details":{
    "description":"",
    "customer":"",
    "grade":"",
    "casting_weight":"",
    "liquid_weight":"",
    "qty":"",
    "sample_bulk":"",
    "finish_type":"",
    "pattern_code":"",
    "pattern_serial_no":"",
    "pattern_type":"",
    "drawing_number":"",
    "part_no":"",
    "pcs_in_box":"",
    "no_of_core_boxes":"",
    "no_of_cores":"",
    "method_remarks":""
  },

  "sleeve_table":[
    {
      "sle_code":"",
      "sle_name":"",
      "slv_qty":""
    }
  ],

  "printed_qa_requirements":[],

  "handwritten_consumables_list":[
    {
      "item":"",
      "quantity":""
    }
  ],

  "inspection_parameters":{
    "hardness_range_mould":"",
    "hardness_range_core":"",
    "coating_baume_value":"",
    "core_oven_baking_on_time":"",
    "core_oven_baking_off_time":"",
    "core_oven_preheating_temp":"",
    "no_of_cores":"",
    "mould_coating":"",
    "core_coating":"",
    "lettering_checking":"",
    "mould_core_visual_checking":"",
    "mould_core_coating_application":"",
    "core_setting_wall_thickness":"",
    "mould_core_preheating":"",
    "templates_checking":"",
    "core_setting_inspector":"",
    "closing_inspector":"",
    "pouring_inspector":""
  },

  "pouring_details":{
    "pouring_date":"",
    "pouring_time":"",
    "pouring_qty":"",
    "pouring_sec":"",
    "tapping_temp":"",
    "pouring_temp":"",
    "laddle_temp":"",
    "pouring_weight":"",
    "core_making":""
  },

  "bottom_signatures":{
    "planned_by":"",
    "pattern_inspected_by":"",
    "qa_parameters_checked_by":"",
    "core_inspected_by":"",
    "mould_inspected_by":"",
    "closing_inspected_by":"",
    "pouring_inspected_by":"",
    "pre_production_inspected_by":""
  }
}
```

],

"batch_summary":[
{
"p_order":"",
"material_code":"",
"material_description":"",
"batch_no":"",
"t_qty":"",
"unit":"",
"b_qty":"",
"t_c_wt":""
}
]
}
"""

        
        # Make sure the prompt text is the very first item in the parts array
        parts.insert(0, {"text": prompt})

        print("3. Sending multi-page payload to Gemini API...")
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.api_key}"
            headers = {'Content-Type': 'application/json'}
            
            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.1 
                }
            }
            
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            result = response.json()
            ai_text_response = result['candidates'][0]['content']['parts'][0]['text'].strip()
            
            if ai_text_response.startswith("```"):
                ai_text_response = ai_text_response.lstrip("`").replace("json", "", 1).strip()
                if ai_text_response.endswith("```"):
                    ai_text_response = ai_text_response.rstrip("`").strip()
            
            return json.loads(ai_text_response)
            
        except requests.exceptions.RequestException as req_err:
             print(f"API Request Failed: {req_err}")
             if req_err.response is not None:
                 print(f"Response Content: {req_err.response.text}")
             return {"error": f"API Error: {str(req_err)}"}
        except Exception as e:
            return {"error": str(e)}