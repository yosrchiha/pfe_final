# 🎬 Génération de Vidéos — Documentation Complète

## Vue d'ensemble

Ce module ajoute la génération automatique de **vidéos MP4 explicatives** à votre plateforme d'audit IA, en utilisant **MoviePy** et **FFmpeg**.

---

## 📦 MoviePy — C'est quoi ?

**MoviePy** est une bibliothèque Python open-source pour la création et l'édition de vidéos.

### Ce que MoviePy peut faire :
- Créer des **clips vidéo depuis des images Python** (PIL/NumPy arrays)
- **Concaténer** des clips en séquence
- **Superposer** des pistes audio sur de la vidéo
- Appliquer des **effets et transitions**
- Gérer la **synchronisation audio/vidéo** automatiquement

### Ce que MoviePy ne fait PAS :
- MoviePy **ne encode pas lui-même** les vidéos
- Il délègue l'encodage à **FFmpeg**

```python
# Exemple basique MoviePy
from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips
import numpy as np

# Créer un clip depuis un array NumPy (image PIL convertie)
arr = np.array(pil_image)
clip = ImageClip(arr, duration=5)  # 5 secondes

# Charger un audio
audio = AudioFileClip("narration.mp3")

# Composer et exporter
video = clip.set_audio(audio)
video.write_videofile("output.mp4", codec="libx264", audio_codec="aac")
#                                    ↑                ↑
#                              FFmpeg encode      FFmpeg encode
#                              la vidéo H.264     l'audio AAC
```

---

## 🎞️ FFmpeg — C'est quoi ?

**FFmpeg** est un outil système (écrit en C) ultra-puissant pour le traitement de médias.

### Ce que FFmpeg fait :
- **Encoder** la vidéo finale (H.264, H.265, VP9...)
- **Encoder** l'audio (AAC, MP3, Opus...)
- **Muxer** (combiner) vidéo + audio dans un container MP4
- Appliquer des **filtres vidéo/audio** complexes
- **Convertir** entre formats (MP4, WebM, MKV...)
- **Optimiser** la taille du fichier final

### Relation MoviePy ↔ FFmpeg :

```
[Code Python MoviePy]
       ↓
  Orchestre les clips
  Crée les frames PIL
  Synchronise audio/vidéo
       ↓
  Appelle FFmpeg en sous-processus
       ↓
[FFmpeg encode en H.264/AAC]
       ↓
  [Fichier MP4 final]
```

### Installation de FFmpeg :

```bash
# Linux (Ubuntu/Debian)
sudo apt update && sudo apt install ffmpeg -y

# Mac
brew install ffmpeg

# Windows
# Télécharger depuis https://ffmpeg.org/download.html
# Ajouter au PATH système

# Vérifier l'installation
ffmpeg -version
```

---

## 🔄 Flux complet de génération d'une vidéo

```
1. [Frontend] Utilisateur clique "Générer Vidéo"
       ↓
2. [Frontend] POST /video/vulnerabilite avec données de la vuln
       ↓
3. [Backend - FastAPI] Reçoit la requête
       ↓
4. [VideoGeneratorService] Prépare le contenu :
   - Définit les slides (titre, corps, durée)
   - Construit la narration textuelle complète
       ↓
5. [edge-tts] Génère l'audio MP3 de la narration (gratuit, Microsoft Neural TTS)
       ↓
6. [PIL/Pillow] Crée les frames PNG (slides) avec texte et mise en page
       ↓
7. [MoviePy] Compose la vidéo :
   - Convertit chaque frame PIL → ImageClip avec durée
   - Concatène tous les clips en séquence
   - Charge l'audio MP3 comme AudioFileClip
   - Ajuste la durée vidéo = durée audio
   - Attache l'audio à la vidéo
       ↓
8. [FFmpeg via MoviePy] Encode le fichier MP4 final :
   - Codec vidéo : libx264 (H.264) — compatible partout
   - Codec audio : aac — standard MP4
   - FPS : 24 images/seconde
   - Preset : medium (balance vitesse/qualité)
       ↓
9. [FastAPI] Retourne le fichier MP4 via FileResponse
       ↓
10. [Frontend] Crée un Blob URL et affiche le VideoPlayer
```

---

## 📁 Fichiers à intégrer

```
video_generation/
├── backend/
│   └── app/
│       └── routes/
│           └── video.py                 ← NOUVEAU fichier route
├── frontend/
│   ├── components/
│   │   ├── VideoPlayer.tsx              ← NOUVEAU composant lecteur
│   │   └── VideoGeneratorModal.tsx      ← NOUVEAU composant modal
│   └── hooks/
│       └── useVideoGenerator.ts         ← NOUVEAU hook React
└── docs/
    ├── README.md                        ← Ce fichier
    └── PATCH_INSTRUCTIONS.ts            ← Modifications à faire
```

---

## ⚡ Installation des dépendances

### Backend (Python) :

```bash
cd backend
pip install moviepy==1.0.3 Pillow numpy imageio==2.25.1 imageio-ffmpeg==0.4.9 edge-tts
```

> **Note :** `imageio-ffmpeg` installe automatiquement FFmpeg pour Python.
> Mais pour de meilleures performances, **installez aussi FFmpeg système** (voir ci-dessus).

### Dépendances à ajouter dans `requirements.txt` :

```
moviepy==1.0.3
Pillow>=9.0.0
numpy>=1.21.0
edge-tts>=6.1.0
imageio==2.25.1
imageio-ffmpeg==0.4.9
```

---

## 🔧 Intégration Backend (main.py)

Ajouter dans `backend/app/main.py` :

```python
# Import (avec les autres imports de routes)
from app.routes import video as video_router

# Registration (avec les autres app.include_router)
app.include_router(video_router.router)
```

---

## 🖥️ Intégration Frontend (rapport/page.tsx)

### 1. Import du modal :
```tsx
import VideoGeneratorModal from "@/app/components/VideoGeneratorModal";
```

### 2. State :
```tsx
const [showVideoModal, setShowVideoModal] = useState(false);
```

### 3. Bouton dans la topbar (après le bouton TTS "Lire le résumé") :
```tsx
<button
  onClick={() => setShowVideoModal(true)}
  style={{
    padding: "8px 16px",
    background: "rgba(16,185,129,0.08)",
    border: "1px solid rgba(16,185,129,0.35)",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    color: "#10b981",
    display: "flex",
    alignItems: "center",
    gap: 6,
  }}
>
  🎬 {ttsLangue === "fr" ? "Générer Vidéo" : "Generate Video"}
</button>
```

### 4. Modal (juste avant le dernier `</>`) :
```tsx
{showVideoModal && (
  <VideoGeneratorModal
    rapport={rapport}
    nomProjet={nomProjet}
    isDark={isDark}
    ttsLangue={ttsLangue}
    onClose={() => setShowVideoModal(false)}
  />
)}
```

---

## 🎬 Types de vidéos générées

| Type | Endpoint | Durée | Description |
|------|----------|-------|-------------|
| Présentation App | `POST /video/application` | ~50s | Présentation complète de la plateforme |
| Vulnérabilité | `POST /video/vulnerabilite` | ~35s | Explication d'une faille OWASP |
| Rapport | `POST /video/rapport` | ~70s | Synthèse du rapport d'audit |

### Vérification des dépendances :
```
GET /video/status
```
Retourne l'état de FFmpeg, MoviePy, Pillow et edge-tts.

---

## 📐 Spécifications techniques des vidéos

| Paramètre | Valeur |
|-----------|--------|
| Résolution | 1280 × 720 (720p HD) |
| FPS | 24 |
| Codec vidéo | H.264 (libx264) |
| Codec audio | AAC 192k |
| Container | MP4 |
| Preset FFmpeg | medium |
| Thème | Sombre (#0f1117) avec accents couleur |
| Police | DejaVu Sans (incluse dans Linux) |

---

## ⏱️ Temps de génération estimés

| Type | Temps |
|------|-------|
| Présentation App (~50s) | 20-40 secondes |
| Vulnérabilité (~35s) | 15-25 secondes |
| Rapport (~70s) | 30-60 secondes |

> **Note :** Les temps varient selon les performances du serveur.
> La génération audio TTS nécessite une connexion internet (edge-tts utilise les serveurs Microsoft).

---

## 🐛 Dépannage

### FFmpeg non trouvé :
```bash
# Vérifier
ffmpeg -version

# Si non trouvé sur Linux :
sudo apt install ffmpeg -y

# Ou utiliser imageio-ffmpeg (FFmpeg embarqué Python) :
pip install imageio-ffmpeg
```

### Erreur de police (DejaVu) :
```bash
# Linux
sudo apt install fonts-dejavu -y
```

### Erreur MoviePy `ImageMagick` :
MoviePy peut optionnellement utiliser ImageMagick pour les effets texte avancés.
Ce module n'utilise pas ImageMagick — uniquement PIL/Pillow pour les frames.

### Test rapide en ligne de commande :
```python
# test_video.py
import asyncio
from app.routes.video import video_service

async def test():
    path = await video_service.generate_application_video("fr")
    print(f"Vidéo générée : {path}")

asyncio.run(test())
```

---

## 🔐 Sécurité

- Les vidéos générées sont stockées dans un répertoire temporaire système (`/tmp/audit_videos/`)
- Les fichiers sont réutilisés si déjà générés (cache par nom de fichier)
- Pour production : ajouter une authentification JWT sur les endpoints `/video/*`
- Pour production : nettoyer régulièrement le répertoire de cache vidéo

---

## 📊 Architecture complète TTS + Vidéo

```
Plateforme Audit IA
├── Audio (TTS) ─────── edge-tts → MP3
│   ├── /tts/vulnerabilite
│   └── /tts/texte
│
└── Vidéo ───────────── PIL + MoviePy + FFmpeg → MP4
    ├── /video/application
    ├── /video/vulnerabilite
    └── /video/rapport
```
