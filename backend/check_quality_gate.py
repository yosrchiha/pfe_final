import json
import os
import sys

# Fonction pour vérifier le seuil de qualité
def check_quality_gate():
    print("Vérification de la porte qualité...")
    
    # Récupérer le seuil de qualité depuis les variables d'environnement GitLab CI/CD
    # ou utiliser une valeur par défaut si non définie
    quality_threshold = int(os.getenv("QUALITY_THRESHOLD", 70))
    
    try:
        with open("audit_report.json", "r") as f:
            audit_report = json.load(f)
            
        score_qualite = audit_report.get("score_qualite", 0)
        
        print(f"Score de qualité obtenu: {score_qualite}")
        print(f"Seuil de qualité configuré: {quality_threshold}")
        
        if score_qualite < quality_threshold:
            print(f"ERREUR: Le score de qualité ({score_qualite}) est inférieur au seuil requis ({quality_threshold}).")
            sys.exit(1) # Échec du pipeline
        else:
            print(f"SUCCÈS: Le score de qualité ({score_qualite}) atteint le seuil requis ({quality_threshold}).")
            sys.exit(0) # Succès du pipeline
            
    except FileNotFoundError:
        print("ERREUR: Le fichier audit_report.json n'a pas été trouvé. L'audit LLM a-t-il échoué ou n'a-t-il pas été exécuté ?")
        sys.exit(1)
    except json.JSONDecodeError:
        print("ERREUR: Impossible de lire le fichier audit_report.json. Le format est-il correct ?")
        sys.exit(1)
    except Exception as e:
        print(f"ERREUR inattendue lors de la vérification de la porte qualité: {e}")
        sys.exit(1)

if __name__ == "__main__":
    check_quality_gate()