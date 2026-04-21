from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Vérifie que l'URL est bien chargée
if not DATABASE_URL:
    raise ValueError("DATABASE_URL non défini ! Vérifie ton fichier .env")

# Création de l'engine SQLAlchemy
engine = create_engine(
    DATABASE_URL,
    echo=False,           # ← était True — loggait TOUT le SQL
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,   # vérifie la connexion avant usage
    pool_recycle=1800,
)

# Générateur de sessions
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base pour les modèles
Base = declarative_base()
# app/config/database.py (à la fin du fichier)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()