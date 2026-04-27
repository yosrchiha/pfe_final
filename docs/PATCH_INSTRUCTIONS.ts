// ═══════════════════════════════════════════════════════════════════════════
//  PATCH — rapport/page.tsx
//  Modifications à apporter pour intégrer la génération de vidéos
//
//  3 zones à modifier dans rapport/page.tsx :
//  1. Imports (en haut du fichier)
//  2. State (dans le composant)
//  3. Bouton "Générer une vidéo" dans la topbar
//  4. Rendu du modal (à la fin avant le dernier </>)
// ═══════════════════════════════════════════════════════════════════════════


// ── ZONE 1 : Ajouter ces imports au début du fichier ─────────────────────────
// Après les imports existants, ajouter :

import VideoGeneratorModal from "@/app/components/VideoGeneratorModal";


// ── ZONE 2 : Ajouter ce state dans le composant ──────────────────────────────
// Dans la liste des useState, ajouter :

const [showVideoModal, setShowVideoModal] = useState(false);


// ── ZONE 3 : Ajouter le bouton dans la topbar ────────────────────────────────
// Dans la div des boutons de la topbar, après le bouton "🔊 Lire le résumé",
// ajouter ce bloc :

/*
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
*/


// ── ZONE 4 : Ajouter le modal à la fin du JSX ────────────────────────────────
// Juste avant le dernier </> de return, ajouter :

/*
{showVideoModal && (
  <VideoGeneratorModal
    rapport={rapport}
    nomProjet={nomProjet}
    isDark={isDark}
    ttsLangue={ttsLangue}
    onClose={() => setShowVideoModal(false)}
  />
)}
*/


// ═══════════════════════════════════════════════════════════════════════════
//  PATCH — backend/app/main.py
//  Ajouter le router vidéo
// ═══════════════════════════════════════════════════════════════════════════

/*
// Ajouter l'import :
from app.routes import video as video_router

// Ajouter le router (avec les autres app.include_router) :
app.include_router(video_router.router)
*/


// ═══════════════════════════════════════════════════════════════════════════
//  PATCH — backend/requirements.txt
//  Ajouter les nouvelles dépendances
// ═══════════════════════════════════════════════════════════════════════════

/*
moviepy==1.0.3
Pillow>=9.0.0
numpy>=1.21.0
edge-tts>=6.1.0
imageio==2.25.1
imageio-ffmpeg==0.4.9
*/
