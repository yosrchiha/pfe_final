# backend/app/schemas/video_generee.py

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.video_generee import TypeVideo


class VideoGenereeOut(BaseModel):
    id:                int
    user_id:           int
    type_video:        TypeVideo
    titre:             str
    nom_projet:        Optional[str]
    langue:            str
    score_qualite:     Optional[int]
    score_securite:    Optional[int]
    score_performance: Optional[int]
    created_at:        datetime
    # L'URL de streaming sera construite côté route

    # ✅ CORRECT
class Config:
    from_attributes = True

class VideoGenereeDetail(VideoGenereeOut):
    contexte_json: Optional[str]
    stream_url:    str   # Injectée par la route