# backend/app/routes/auth.py
#
# Modifications par rapport à la version originale :
#   1. login()   → enregistre un LoginEvent (success=True) + IP + User-Agent
#   2. logout()  → nouveau endpoint POST /auth/logout
#   3. /auth/me/logins → historique des connexions de l'utilisateur connecté
#
# Routes ADMIN (à ajouter dans Admin.py) sont à la fin de ce fichier
# dans le bloc "# ── BLOCS À COPIER DANS Admin.py ──"

from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import jwt, JWTError
from pydantic import BaseModel, EmailStr
import random
import requests

from app.config.database import SessionLocal, get_db
from app.models.user        import User
from app.models.login_event import LoginEvent
from app.schemas.user       import UserCreate, UserLogin, ForgotPassword, ResetPassword
from app.core.security      import hash_password, verify_password, create_access_token
from app.config.mail        import fm, MessageSchema
from app.config.settings    import settings
from fastapi.responses       import RedirectResponse
from fastapi.security        import OAuth2PasswordBearer

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── DB dependency ────────────────────────────────────────────────
def get_db_local():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Schemas locaux ───────────────────────────────────────────────
class UserResponse(BaseModel):
    id:         int
    email:      str
    username:   str
    role:       str
    is_active:  bool
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


class UserUpdateBody(BaseModel):
    username: str | None = None
    email:    EmailStr | None = None


class LoginEventOut(BaseModel):
    id:         int
    event_type: str
    ip_address: str | None = None
    user_agent: str | None = None
    success:    bool
    created_at: datetime
    logout_at:  datetime | None = None
    model_config = {"from_attributes": True}


# ── get_current_user ─────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db:    Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Impossible de valider l'identité",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


# ── Helper pour les routes qui lisent le token depuis Header ──────
def get_user_id_from_token(authorization: str | None, db: Session) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user.id


# ── Helper IP ─────────────────────────────────────────────────────
def _get_ip(request: Request) -> str:
    """Récupère l'IP réelle même derrière un reverse proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ══════════════════════════════════════════════════════════════════
# REGISTER
# ══════════════════════════════════════════════════════════════════
@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hash_password(user.password)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}


# ══════════════════════════════════════════════════════════════════
# LOGIN  ← modifié : enregistre le LoginEvent
# ══════════════════════════════════════════════════════════════════
@router.post("/login")
def login(user: UserLogin, request: Request, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    ip  = _get_ip(request)
    ua  = request.headers.get("User-Agent", "")[:512]

    # ── Échec d'authentification ──────────────────────────────────
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        if db_user:
            # On loggue l'échec uniquement si l'utilisateur existe
            ev = LoginEvent(
                user_id    = db_user.id,
                event_type = "login_failure",
                ip_address = ip,
                user_agent = ua,
                success    = False,
            )
            db.add(ev)
            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # ── Succès ────────────────────────────────────────────────────
    ev = LoginEvent(
        user_id    = db_user.id,
        event_type = "login_success",
        ip_address = ip,
        user_agent = ua,
        success    = True,
    )
    db.add(ev)
    db.commit()

    token = create_access_token({"sub": db_user.email})
    return {"access_token": token, "token_type": "bearer"}


# ══════════════════════════════════════════════════════════════════
# LOGOUT  ← nouveau
# ══════════════════════════════════════════════════════════════════
@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Enregistre l'événement de déconnexion.
    Le client doit supprimer son token localement (JWT stateless).
    """
    ip = _get_ip(request)
    ua = request.headers.get("User-Agent", "")[:512]

    # Trouver la session login_success la plus récente sans logout_at
    last_login = (
        db.query(LoginEvent)
        .filter(
            LoginEvent.user_id    == current_user.id,
            LoginEvent.event_type == "login_success",
            LoginEvent.logout_at  == None,
        )
        .order_by(LoginEvent.created_at.desc())
        .first()
    )
    now = datetime.utcnow()

    if last_login:
        # Marquer la session comme terminée
        last_login.logout_at = now

    # Créer l'événement logout
    ev = LoginEvent(
        user_id    = current_user.id,
        event_type = "logout",
        ip_address = ip,
        user_agent = ua,
        success    = True,
        logout_at  = now,
    )
    db.add(ev)
    db.commit()
    return {"message": "Déconnexion enregistrée"}


# ══════════════════════════════════════════════════════════════════
# MES CONNEXIONS — historique personnel
# ══════════════════════════════════════════════════════════════════
@router.get("/me/logins", response_model=list[LoginEventOut])
def my_logins(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retourne les N derniers événements de connexion de l'utilisateur connecté."""
    events = (
        db.query(LoginEvent)
        .filter(LoginEvent.user_id == current_user.id)
        .order_by(LoginEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return events


# ══════════════════════════════════════════════════════════════════
# ME
# ══════════════════════════════════════════════════════════════════
@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username or current_user.email.split("@")[0],
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )


# ══════════════════════════════════════════════════════════════════
# UPDATE
# ══════════════════════════════════════════════════════════════════
@router.put("/update", response_model=UserResponse)
def update_profile(
    body: UserUpdateBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if body.email and body.email != current_user.email:
        if db.query(User).filter(User.email == body.email).first():
            raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
        current_user.email = body.email

    if body.username and body.username.strip():
        current_user.username = body.username.strip()

    db.commit()
    db.refresh(current_user)

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
    )


# ══════════════════════════════════════════════════════════════════
# FORGOT / RESET PASSWORD
# ══════════════════════════════════════════════════════════════════
def generate_otp(length: int = 6) -> str:
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


@router.post("/forgot-password")
async def forgot_password(request: ForgotPassword, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")

    otp = generate_otp()
    user.otp = otp
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=10)
    db.commit()

    message = MessageSchema(
        subject="Votre code OTP pour réinitialisation",
        recipients=[user.email],
        body=f"""
        <h3>Bonjour {user.username}</h3>
        <p>Voici votre code OTP : <b>{otp}</b></p>
        <p>Il expire dans 10 minutes.</p>
        """,
        subtype="html"
    )
    try:
        await fm.send_message(message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impossible d'envoyer l'email: {str(e)}")
    return {"msg": f"OTP envoyé à {user.email}"}


@router.post("/reset-password")
async def reset_password(request: ResetPassword, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    if user.otp != request.otp:
        raise HTTPException(status_code=400, detail="Code OTP invalide")
    if not user.otp_expiry or datetime.utcnow() > user.otp_expiry:
        raise HTTPException(status_code=400, detail="Code OTP expiré")
    user.hashed_password = hash_password(request.password)
    user.otp = None
    user.otp_expiry = None
    db.commit()
    return {"msg": "Mot de passe réinitialisé avec succès"}


# ══════════════════════════════════════════════════════════════════
# GITLAB OAUTH
# ══════════════════════════════════════════════════════════════════
@router.get("/gitlab/login")
def gitlab_login():
    gitlab_auth_url = (
        "https://gitlab.com/oauth/authorize"
        f"?client_id={settings.GITLAB_CLIENT_ID}"
        "&response_type=code"
        f"&redirect_uri={settings.GITLAB_REDIRECT_URI}"
    )
    return RedirectResponse(gitlab_auth_url)


@router.get("/gitlab/callback")
def gitlab_callback(code: str, db: Session = Depends(get_db)):
    token_url = "https://gitlab.com/oauth/token"
    response = requests.post(token_url, data={
        "client_id":     settings.GITLAB_CLIENT_ID,
        "client_secret": settings.GITLAB_CLIENT_SECRET,
        "code":          code,
        "grant_type":    "authorization_code",
        "redirect_uri":  settings.GITLAB_REDIRECT_URI,
    })
    token_data = response.json()
    if "access_token" not in token_data:
        raise HTTPException(status_code=400, detail="Erreur OAuth GitLab")

    access_token = token_data.get("access_token")
    user_info = requests.get(
        "https://gitlab.com/api/v4/user",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    gitlab_user = user_info.json()
    email    = gitlab_user.get("email")
    username = gitlab_user.get("username") or gitlab_user.get("name") or email.split("@")[0]

    if not email:
        raise HTTPException(status_code=400, detail="Email non fourni par GitLab")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            username=username,
            hashed_password=hash_password("oauth_default")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.username or user.username == email:
        user.username = username
        db.commit()

    token = create_access_token({"sub": user.email})
    return RedirectResponse(f"http://localhost:3000/dashboard?token={token}")


# ══════════════════════════════════════════════════════════════════
# ── BLOCS À COPIER DANS backend/app/routes/Admin.py ──────────────
#
# 1. Ajouter l'import en tête de Admin.py :
#    from app.models.login_event import LoginEvent
#
# 2. Ajouter le schema Pydantic :
#
#   class LoginEventAdminOut(BaseModel):
#       id:         int
#       event_type: str
#       ip_address: str | None = None
#       user_agent: str | None = None
#       success:    bool
#       created_at: datetime
#       logout_at:  datetime | None = None
#       model_config = {"from_attributes": True}
#
# 3. Ajouter les 4 endpoints ci-dessous dans le router admin :
# ══════════════════════════════════════════════════════════════════

# ── /admin/users/{user_id}/stats ──────────────────────────────────
#
# @router.get("/users/{user_id}/stats")
# def get_user_stats(user_id: int, db: Session = Depends(get_db),
#                    authorization: str | None = Header(default=None)):
#     require_admin(authorization, db)
#     u = db.query(User).filter(User.id == user_id).first()
#     if not u:
#         raise HTTPException(status_code=404, detail="Utilisateur introuvable")
#
#     from app.models.login_event  import LoginEvent
#     from app.models.video_generee import VideoGeneree
#     from app.models.export_rapport import ExportRapport
#     from sqlalchemy import func
#
#     total_analyses = db.query(func.count(Analyse.id)).join(
#         DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id
#     ).filter(DepotAnalyse.user_id == user_id).scalar() or 0
#
#     total_videos = db.query(func.count(VideoGeneree.id)).filter(
#         VideoGeneree.user_id == user_id
#     ).scalar() or 0
#
#     total_rapports = db.query(func.count(ExportRapport.id)).filter(
#         ExportRapport.user_id == user_id
#     ).scalar() or 0
#
#     # Dernière activité = dernier login_event
#     last_ev = (db.query(LoginEvent)
#                .filter(LoginEvent.user_id == user_id, LoginEvent.success == True)
#                .order_by(LoginEvent.created_at.desc()).first())
#     derniere_activite = last_ev.created_at.isoformat() if last_ev else None
#
#     # Session active = login_success sans logout_at dans les 2h
#     from datetime import datetime, timedelta
#     cutoff = datetime.utcnow() - timedelta(hours=2)
#     sessions_actives = db.query(func.count(LoginEvent.id)).filter(
#         LoginEvent.user_id    == user_id,
#         LoginEvent.event_type == "login_success",
#         LoginEvent.logout_at  == None,
#         LoginEvent.created_at >= cutoff,
#     ).scalar() or 0
#
#     return {
#         "total_analyses":   total_analyses,
#         "total_videos":     total_videos,
#         "total_rapports":   total_rapports,
#         "sessions_actives": sessions_actives,
#         "derniere_activite": derniere_activite,
#     }
#
#
# ── /admin/users/{user_id}/analyses ──────────────────────────────
#
# @router.get("/users/{user_id}/analyses")
# def get_user_analyses(user_id: int, db: Session = Depends(get_db),
#                       authorization: str | None = Header(default=None)):
#     require_admin(authorization, db)
#     rows = (db.query(Analyse, DepotAnalyse)
#             .join(DepotAnalyse, Analyse.depot_analyse_id == DepotAnalyse.id)
#             .filter(DepotAnalyse.user_id == user_id)
#             .order_by(Analyse.created_at.desc())
#             .limit(50).all())
#     result = []
#     for a, da in rows:
#         vulns = a.vulnerabilites or []
#         result.append({
#             "id":               a.id,
#             "depot_nom":        da.nom,
#             "branche":          a.branche or "main",
#             "score_qualite":    a.score_qualite    or 0,
#             "score_securite":   a.score_securite   or 0,
#             "score_performance":a.score_performance or 0,
#             "statut":           a.statut,
#             "created_at":       a.created_at.isoformat() if a.created_at else None,
#             "nb_vulns":         len(vulns),
#         })
#     return result
#
#
# ── /admin/users/{user_id}/videos ────────────────────────────────
#
# @router.get("/users/{user_id}/videos")
# def get_user_videos(user_id: int, db: Session = Depends(get_db),
#                     authorization: str | None = Header(default=None)):
#     require_admin(authorization, db)
#     from app.models.video_generee import VideoGeneree
#     rows = (db.query(VideoGeneree)
#             .filter(VideoGeneree.user_id == user_id)
#             .order_by(VideoGeneree.created_at.desc())
#             .limit(50).all())
#     return [{
#         "id":          v.id,
#         "type_video":  getattr(v, "type_video", "rapport"),
#         "titre":       getattr(v, "titre", "Vidéo"),
#         "langue":      getattr(v, "langue", "fr"),
#         "nom_projet":  getattr(v, "nom_projet", None),
#         "created_at":  v.created_at.isoformat() if v.created_at else None,
#     } for v in rows]
#
#
# ── /admin/users/{user_id}/rapports ──────────────────────────────
#
# @router.get("/users/{user_id}/rapports")
# def get_user_rapports(user_id: int, db: Session = Depends(get_db),
#                       authorization: str | None = Header(default=None)):
#     require_admin(authorization, db)
#     from app.models.export_rapport import ExportRapport
#     rows = (db.query(ExportRapport)
#             .filter(ExportRapport.user_id == user_id)
#             .order_by(ExportRapport.created_at.desc())
#             .limit(50).all())
#     return [{
#         "id":        r.id,
#         "nom_projet":getattr(r, "nom_projet", "—"),
#         "created_at":r.created_at.isoformat() if r.created_at else None,
#         "nb_pages":  getattr(r, "nb_pages", None),
#     } for r in rows]
#
#
# ── /admin/users/{user_id}/logins ────────────────────────────────
#
# @router.get("/users/{user_id}/logins")
# def get_user_logins(user_id: int, limit: int = 30,
#                     db: Session = Depends(get_db),
#                     authorization: str | None = Header(default=None)):
#     require_admin(authorization, db)
#     from app.models.login_event import LoginEvent
#     rows = (db.query(LoginEvent)
#             .filter(LoginEvent.user_id == user_id)
#             .order_by(LoginEvent.created_at.desc())
#             .limit(limit).all())
#     return [{
#         "id":          r.id,
#         "event_type":  r.event_type,
#         "ip_address":  r.ip_address,
#         "user_agent":  r.user_agent,
#         "success":     r.success,
#         "created_at":  r.created_at.isoformat() if r.created_at else None,
#         "logout_at":   r.logout_at.isoformat()  if r.logout_at  else None,
#     } for r in rows]