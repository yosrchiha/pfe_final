# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config.database import Base, engine

# ── Imports des modèles ───────────────────────────────────
from app.models.user         import User
from app.models.depot        import Depot
from app.models.depot_analyse import DepotAnalyse
from app.models.analyse      import Analyse

# ── Imports des routes ────────────────────────────────────
from app.routes              import auth, depots
from app.routes.explorer     import router as explorer_router
from app.routes.Admin        import router as admin_router
from app.routes.analyses     import router as analyses_router


# ── Application ──────────────────────────────────────────
app = FastAPI(title="Plateforme Audit GitLab API")

# ── CORS — DOIT ÊTRE EN PREMIER ──────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Routes ───────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(depots.router)
app.include_router(explorer_router)
app.include_router(admin_router)
app.include_router(analyses_router)

# ── Création des tables ──────────────────────────────────
@app.on_event("startup")
async def startup():
    print("Création des tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables créées !")

# ── Route racine ─────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Plateforme Audit GitLab API"}
