# app/schemas/depot.py (anciennement repository.py)
from pydantic import BaseModel
from typing import Optional

# Pour créer un dépôt
class DepotCreate(BaseModel):
    nom: str
    url_branche_principale: str
    url_branche_developpement: str
    token_gitlab: str
    proprietaire_id: int

# Pour la réponse (lecture d'un dépôt)
class DepotResponse(BaseModel):
    id: int
    nom: str
    url_branche_principale: str
    url_branche_developpement: str
    token_gitlab: str
    proprietaire_id: int

    class Config:
        orm_mode = True

# Pour mettre à jour un dépôt (optionnel)
class DepotUpdate(BaseModel):
    nom: Optional[str] = None
    url_branche_principale: Optional[str] = None
    url_branche_developpement: Optional[str] = None
    token_gitlab: Optional[str] = None
    proprietaire_id: Optional[int] = None
    