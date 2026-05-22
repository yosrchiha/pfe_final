# backend/app/models/__init__.py

# Toujours importer User en premier
from app.models.user import User

# Modèles principaux utilisés par Celery / analyses
from app.models.analyse import Analyse
from app.models.depot_analyse import DepotAnalyse
from app.models.vulnerabilite import Vulnerabilite
from app.models.recommandation import Recommandation

# Modèles liés aux fonctionnalités ajoutées
from app.models.analyse_fichier import AnalyseFichier
from app.models.chat_message import ChatMessage
from app.models.corre_diff import CorreDiff
from app.models.correction import Correction
from app.models.exploration import Exploration
from app.models.export_rapport import ExportRapport
from app.models.feedback import Feedback
from app.models.mr_exploration import MrExploration
from app.models.video_generee import VideoGeneree