# app/routes/auth.py

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import jwt, JWTError
from pydantic import BaseModel, EmailStr
import random
import requests

from app.config.database import SessionLocal
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, ForgotPassword, ResetPassword
from app.core.security import hash_password, verify_password, create_access_token
from app.config.mail import fm, MessageSchema
from app.config.settings import settings
from fastapi.responses import RedirectResponse
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/auth", tags=["Auth"])


# ── DB dependency ────────────────────────────────────────────────
def get_db():
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
# LOGIN
# ══════════════════════════════════════════════════════════════════
@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": db_user.email})
    return {"access_token": token, "token_type": "bearer"}


# ══════════════════════════════════════════════════════════════════
# ME — profil de l'utilisateur connecté
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
# UPDATE — modifier username et/ou email
# ══════════════════════════════════════════════════════════════════
@router.put("/update", response_model=UserResponse)
def update_profile(
    body: UserUpdateBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Vérifier unicité email si changement
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
        # Corriger un username vide s'il existe déjà
        user.username = username
        db.commit()

    token = create_access_token({"sub": user.email})
    return RedirectResponse(f"http://localhost:3000/dashboard?token={token}")