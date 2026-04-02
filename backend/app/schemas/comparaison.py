from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any, List

class ComparaisonBase(BaseModel):
    depot_id: int
    from_branch: str
    to_branch: str
    commits_count: int = 0
    files_json: Optional[Any] = None

class ComparaisonCreate(ComparaisonBase):
    pass

class ComparaisonResponse(ComparaisonBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True