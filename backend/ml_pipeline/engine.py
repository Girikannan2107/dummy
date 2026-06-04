import fitz  # PyMuPDF
import base64
import json
import os
import requests
from core.config import settings

class IntelligentDocumentProcessor:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        # Notice we removed Paddle, TrOCR, and the ImagePreprocessor 
        # Gemini Vision handles native document OCR exceptionally well on its own.

    def process_document(self, file_path: str) -> dict:
        if not self.api_key:    
            return {"error": "Missing GEMINI_API_KEY. Please set the environment variable or hardcode it in engine.py."}

        print(f"1. Opening PDF Document: {file_path}")
        
        try:
            doc = fitz.open(file_path)
        except Exception as e:
            return {"error": f"Failed to open PDF file: {str(e)}"}

        print(f"2. Extracting {len(doc)} pages as images for Gemini Vision...")
        parts = []
        
        # Define the system prompt with the exact nested schema your FastAPI export route expects
        prompt = """
        You are a Senior AI Data Extractor specializing in metallurgical manufacturing records.
        I am providing you with images of a multi-page manufacturing document.

        Rules:
        1. All pages EXCEPT the last one represent sequential production steps (Queue Data). Extract 'Heat No', 'Temperatures', and 'Weights' carefully. Pay attention to handwritten overrides.
        2. The LAST page is a billing/batch summary table. Extract rows matching 'Material Code', 'Description', 'Batch No', and 'Total Qty'.
        3. Output strictly according to the provided JSON schema. Do not include markdown code blocks.

        OUTPUT SCHEMA INSTRUCTIONS:
        Return strictly a valid JSON object matching this exact structure. Use "" if a field is missing.
        
        {
          "queue_pages": [
            {
              "page_number": 1,
              "production_plan": {
                "heat_no": "",
                "planning_date": "",
                "pouring_date": "",
                "customer": "",
                "grade": "",
                "casting_weight": ""
              },
              "qa_parameters": {
                "hardness_mould": "",
                "hardness_core": ""
              },
              "pouring_details": {
                "pouring_time": "",
                "tapping_temp": "",
                "pouring_temp": "",
                "laddle_temp": "",
                "pouring_weight": ""
              }
            }
          ],
          "batch_summary": [
            {
              "material_code": "",
              "material_description": "",
              "batch_no": "",
              "t_qty": "",
              "unit": ""
            }
          ]
        }
        """
        
        # Add the text prompt as the first part of the payload
        parts.append({"text": prompt})

        # Loop through the PDF, convert each page to a base64 JPEG, and append to the prompt parts
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            # DPI 200 is sufficient for Gemini Vision to read handwriting without bloating the payload size
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

        print("3. Sending multi-page payload to Gemini 2.5 Flash Vision API...")
        
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.api_key}"
            headers = {'Content-Type': 'application/json'}
            
            payload = {
                "contents": [{
                    "parts": parts
                }],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.1 # Low temperature for highly deterministic data extraction
                }
            }
            
            response = requests.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            result = response.json()
            ai_text_response = result['candidates'][0]['content']['parts'][0]['text'].strip()
            
            # Text Sanitization: Strip markdown indicators if appended
            if ai_text_response.startswith("```"):
                ai_text_response = ai_text_response.lstrip("`").replace("json", "", 1).strip()
                if ai_text_response.endswith("```"):
                    ai_text_response = ai_text_response.rstrip("`").strip()
            
            print("4. Successfully extracted and structured data.")
            return json.loads(ai_text_response)
            
        except Exception as e:
            print("--- CRITICAL API DIAGNOSTIC LOG ---")
            print(f"Exception Type: {type(e)}")
            print(f"Error Message: {str(e)}")
            if 'response' in locals():
                print(f"Gemini HTTP Status Code: {response.status_code}")
                print(f"Gemini Raw Body Response: {response.text}")
            print("-----------------------------------")
            return {"error": str(e)}