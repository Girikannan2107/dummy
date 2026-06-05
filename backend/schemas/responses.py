from pydantic import BaseModel
from typing import Optional, Any

class TaskResponse(BaseModel):
    message: str
    task_id: str
    filename: str

class StatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[Any] = None
    error: Optional[str] = None