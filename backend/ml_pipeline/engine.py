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
                    pix = page.get_pixmap(dpi=100)
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
        prompt = """Extract all printed and handwritten data from this Foundry Ladle Pouring document. 
Handwritten > printed. Ignore crossed-out items. Preserve units.
Return strictly valid JSON matching this exact skeleton structure. Let the AI dynamically create the inner keys for details and parameters based on the document's contents:

{
  "document_metadata": { "form_id": "", "heat_no": "", "date": "" },
  "product_details": { }, 
  "inspection_parameters": { },
  "pouring_details": { },
  "tables": {
    "sleeves": [ { "code": "", "qty": "" } ],
    "consumables": [ { "item": "", "qty": "" } ],
    "batch_summary": [ ]
  },
  "signatures": { }
}"""
        
        # Make sure the prompt text is the very first item in the parts array
        parts.insert(0, {"text": prompt})

        print("3. Sending multi-page payload to Gemini API...")
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.api_key}"
            headers = {'Content-Type': 'application/json'} # <-- This was missing
            
            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.1 
                }
            }
            
            response = requests.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                print("Status:", response.status_code)
                print("Response:", response.text)
                return {
                    "error": response.text
                }            
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