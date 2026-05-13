

from pydantic import BaseModel
from typing import Optional


# Pour créer un dépôt — le token est accepté en entrée
class DepotCreate(BaseModel):
    nom: str
    url_branche_principale: str
    url_branche_developpement: str
    token_gitlab: str  # reçu en clair, sera chiffré avant stockage


# Pour la réponse (lecture d'un dépôt) — le token N'est PAS inclus
class DepotResponse(BaseModel):
    id: int
    nom: str
    url_branche_principale: str
    url_branche_developpement: str
    proprietaire_id: int
    # ⚠️ token_gitlab volontairement absent : on ne renvoie jamais un token sensible dans l'API

    class Config:
        orm_mode = True


# Pour mettre à jour un dépôt
class DepotUpdate(BaseModel):
    nom: Optional[str] = None
    url_branche_principale: Optional[str] = None
    url_branche_developpement: Optional[str] = None
    token_gitlab: Optional[str] = None  # accepté en entrée seulement
    proprietaire_id: Optional[int] = None