"""Schemas d'API pour le module de configuration GitLab CI/CD."""

from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


class PipelineOptionsBase(BaseModel):
    depot_analyse_id: int = Field(..., gt=0)
    target_branch: Optional[str] = Field(default=None, min_length=1, max_length=255)
    tests_enabled: bool = True
    coverage_enabled: bool = True
    security_enabled: bool = True
    quality_enabled: bool = True
    coverage_threshold: int = Field(default=70, ge=0, le=100)

    @model_validator(mode="after")
    def validate_options(self):
        if self.coverage_enabled and not self.tests_enabled:
            raise ValueError("La couverture nécessite l'activation des tests.")
        if not any((self.tests_enabled, self.security_enabled, self.quality_enabled)):
            raise ValueError("Activez au moins un contrôle CI/CD.")
        return self


class PipelinePreviewRequest(PipelineOptionsBase):
    """Demande de génération sans modification du dépôt GitLab."""


class PipelinePublishRequest(PipelineOptionsBase):
    """Demande de publication via branche dédiée et Merge Request."""

    replace_existing_pipeline: bool = False


class PipelineDepotResponse(BaseModel):
    id: int
    nom: str
    project_url: str
    branche: str


class PipelinePreviewResponse(BaseModel):
    depot_analyse_id: int
    project_name: str
    target_branch: str
    languages: List[str]
    has_existing_pipeline: bool
    existing_pipeline_content: Optional[str] = None
    yaml_content: str
    warning: Optional[str] = None


class PipelinePublishResponse(BaseModel):
    depot_analyse_id: int
    project_name: str
    target_branch: str
    source_branch: str
    languages: List[str]
    file_path: str
    replaced_existing_pipeline: bool
    merge_request_iid: int
    merge_request_url: str
    merge_request_status: str


class PipelineJobResponse(BaseModel):
    id: int
    name: str
    stage: str
    status: str
    web_url: Optional[str] = None


class PipelineStatusResponse(BaseModel):
    depot_analyse_id: int
    ref: str
    found: bool
    pipeline_id: Optional[int] = None
    status: Optional[str] = None
    source: Optional[str] = None
    web_url: Optional[str] = None
    coverage: Optional[float] = None
    jobs: List[PipelineJobResponse] = Field(default_factory=list)
    message: Optional[str] = None

class PipelineJobDetailResponse(PipelineJobResponse):
    duration: Optional[float] = None
    started_at: Optional[str] = None
    finished_at: Optional[str] = None
    allow_failure: Optional[bool] = None


class PipelineHistoryItemResponse(BaseModel):
    id: int
    status: Optional[str] = None
    ref: Optional[str] = None
    source: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    duration: Optional[float] = None
    coverage: Optional[float] = None
    web_url: Optional[str] = None
    jobs: List[PipelineJobDetailResponse] = Field(default_factory=list)


class PipelineHistoryResponse(BaseModel):
    depot_analyse_id: int
    project_name: str
    pipelines: List[PipelineHistoryItemResponse] = Field(default_factory=list)

