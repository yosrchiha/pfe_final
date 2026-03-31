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
from app.routes import exports as exports_router

from app.routes import tests
from app.models.merge_request import MergeRequest
from app.routes import merge_requests
from app.routes import issues as issues_router
# backend/app/main.py
from app.routes import chat as chat_router
from app.routes import recommandations as reco_router
from app.routes import tickets

# Ajouter avec les autres routes
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
# backend/app/main.py

app.include_router(reco_router.router)
# backend/app/main.py

app.include_router(merge_requests.router)

app.include_router(tests.router)

app.include_router(issues_router.router)
app.include_router(chat_router.router)
# backend/app/main.py

app.include_router(exports_router.router)


# ... après les autres routers ...
app.include_router(tickets.router)

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
