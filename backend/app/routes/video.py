# backend/app/routes/video.py
# ─────────────────────────────────────────────────────────────────────────────
#  Route VIDEO – Génère des vidéos explicatives via MoviePy + FFmpeg
#  Slides visuellement riches : dégradés, badges, barres, icônes PIL
#
#  pip install moviepy==1.0.3 pillow numpy edge-tts
#  sudo apt install ffmpeg
# ─────────────────────────────────────────────────────────────────────────────

import os
import math
import asyncio
import tempfile
import textwrap
from typing import Optional, List
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/video", tags=["Video"])

VIDEO_OUTPUT_DIR = Path(tempfile.gettempdir()) / "audit_videos"
VIDEO_OUTPUT_DIR.mkdir(exist_ok=True)


# ── Modèles ───────────────────────────────────────────────────────────────────

class VideoApplicationRequest(BaseModel):
    langue: Optional[str] = "fr"
    style:  Optional[str] = "modern"

class VideoVulnerabiliteRequest(BaseModel):
    type_vuln: str
    severite:  str
    fichier:   str
    ligne:     int
    suggestion: str
    langue: Optional[str] = "fr"

class VideoRapportRequest(BaseModel):
    nom_projet: str
    score_qualite:     Optional[int] = None
    score_securite:    Optional[int] = None
    score_performance: Optional[int] = None
    vulnerabilites:    Optional[List[dict]] = []
    recommandations:   Optional[List[dict]] = []
    langue: Optional[str] = "fr"


# ── Helpers de dessin PIL ─────────────────────────────────────────────────────

def _load_fonts():
    """Charge les polices DejaVu disponibles sous Linux/Mac/Windows."""
    from PIL import ImageFont
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    def try_load(path, size):
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            return None

    bold_path   = next((p for p in paths[0::2] if try_load(p, 10)), None)
    normal_path = next((p for p in paths[1::2] if try_load(p, 10)), None)
    fallback    = ImageFont.load_default()

    return {
        "title":    try_load(bold_path,   52) or fallback,
        "subtitle": try_load(bold_path,   34) or fallback,
        "body":     try_load(normal_path, 26) or fallback,
        "small":    try_load(normal_path, 20) or fallback,
        "micro":    try_load(normal_path, 16) or fallback,
        "badge":    try_load(bold_path,   22) or fallback,
        "score":    try_load(bold_path,   72) or fallback,
        "watermark":try_load(normal_path, 18) or fallback,
    }


def _hex(h: str):
    """#RRGGBB → (R,G,B)"""
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _blend(c1, c2, t):
    """Interpolation linéaire entre deux couleurs RGB."""
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def _draw_gradient_bg(draw, w, h, c_top, c_bot):
    """Fond dégradé vertical."""
    for y in range(h):
        t   = y / h
        col = _blend(c_top, c_bot, t)
        draw.line([(0, y), (w, y)], fill=col)


def _draw_rounded_rect(draw, x0, y0, x1, y1, r, fill, border=None, border_w=2):
    """Rectangle arrondi (PIL ne le supporte qu'avec rounded_rectangle)."""
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill,
                           outline=border, width=border_w if border else 0)


def _draw_circle(draw, cx, cy, r, fill):
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)


def _draw_progress_bar(draw, x, y, w, h, pct, color_fg, color_bg=(40, 50, 70), radius=8):
    """Barre de progression arrondie."""
    _draw_rounded_rect(draw, x, y, x + w, y + h, radius, color_bg)
    if pct > 0:
        fw = max(int(w * pct / 100), radius * 2)
        _draw_rounded_rect(draw, x, y, x + fw, y + h, radius, color_fg)


def _draw_shield(draw, cx, cy, size, color):
    """Icône bouclier dessinée en polygone."""
    s = size
    pts = [
        (cx,       cy - s),
        (cx + s,   cy - s // 2),
        (cx + s,   cy + s // 4),
        (cx,       cy + s),
        (cx - s,   cy + s // 4),
        (cx - s,   cy - s // 2),
    ]
    draw.polygon(pts, fill=color)
    # Coche intérieure
    check = [
        (cx - s // 3, cy + s // 8),
        (cx - s // 8, cy + s // 3),
        (cx + s // 3, cy - s // 5),
    ]
    draw.line(check, fill=(255, 255, 255), width=max(3, s // 8))


def _draw_warning_triangle(draw, cx, cy, size, color):
    """Triangle ⚠ rempli."""
    s = size
    pts = [(cx, cy - s), (cx + s, cy + s * 0.7), (cx - s, cy + s * 0.7)]
    draw.polygon(pts, fill=color)
    draw.rectangle([cx - 3, cy - s // 3, cx + 3, cy + s // 5], fill=(20, 20, 30))
    draw.ellipse([cx - 4, cy + s // 3, cx + 4, cy + s // 2], fill=(20, 20, 30))


def _draw_checkmark_circle(draw, cx, cy, r, color):
    """Cercle vert avec coche."""
    _draw_circle(draw, cx, cy, r, color)
    check = [
        (cx - r // 2, cy),
        (cx - r // 8, cy + r // 3),
        (cx + r // 2, cy - r // 3),
    ]
    draw.line(check, fill=(255, 255, 255), width=max(3, r // 6))


def _draw_code_icon(draw, cx, cy, size, color):
    """Icône </> code."""
    s = size
    # <
    draw.line([(cx - s // 2, cy - s // 3), (cx - s, cy),
               (cx - s // 2, cy + s // 3)], fill=color, width=max(3, s // 8))
    # >
    draw.line([(cx + s // 2, cy - s // 3), (cx + s, cy),
               (cx + s // 2, cy + s // 3)], fill=color, width=max(3, s // 8))
    # /
    draw.line([(cx + s // 4, cy - s // 2), (cx - s // 4, cy + s // 2)],
              fill=color, width=max(2, s // 10))


def _draw_star(draw, cx, cy, r, color):
    """Étoile 5 branches."""
    pts = []
    for i in range(10):
        angle = math.pi * i / 5 - math.pi / 2
        radius = r if i % 2 == 0 else r // 2
        pts.append((cx + radius * math.cos(angle),
                    cy + radius * math.sin(angle)))
    draw.polygon(pts, fill=color)


def _draw_badge(draw, x, y, text, bg_color, text_color, fonts, min_w=120):
    """Badge pill coloré."""
    f = fonts["badge"]
    bbox = draw.textbbox((0, 0), text, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    pw, ph = 20, 10
    bw = max(tw + pw * 2, min_w)
    bh = th + ph * 2
    _draw_rounded_rect(draw, x, y, x + bw, y + bh, bh // 2, bg_color)
    draw.text((x + (bw - tw) // 2, y + ph - 2), text, font=f, fill=text_color)
    return bw, bh


def _score_color(s):
    """Couleur RGB selon le score."""
    if s is None:          return (148, 163, 184)
    if s >= 75:            return (16, 185, 129)
    if s >= 50:            return (245, 158, 11)
    return (239, 68, 68)


def _severity_colors(sev: str):
    """(bg_rgba, text_rgb, accent_rgb) selon la sévérité."""
    m = {
        "CRITIQUE": ((239, 68,  68),  (255, 220, 220), (239, 68, 68)),
        "HAUTE":    ((249, 115, 22),  (255, 235, 210), (249, 115, 22)),
        "MOYENNE":  ((234, 179, 8),   (255, 245, 200), (234, 179, 8)),
        "FAIBLE":   ((16,  185, 129), (210, 255, 240), (16, 185, 129)),
    }
    return m.get(sev.upper(), ((99, 102, 241), (220, 220, 255), (99, 102, 241)))


# ── Créateurs de slides spécialisés ──────────────────────────────────────────

W, H = 1920, 1080
FONTS = None  # chargé à la première utilisation

BG_TOP    = (10, 12, 24)
BG_BOT    = (18, 24, 42)
CARD_COL  = (24, 32, 52)
ACCENT    = (99, 102, 241)
TEXT_W    = (248, 250, 252)
TEXT_M    = (148, 163, 184)


def _get_fonts():
    global FONTS
    if FONTS is None:
        FONTS = _load_fonts()
    return FONTS


def _base_frame():
    """Crée un canvas vierge avec fond dégradé."""
    from PIL import Image, ImageDraw
    img  = Image.new("RGB", (W, H), BG_TOP)
    draw = ImageDraw.Draw(img)
    _draw_gradient_bg(draw, W, H, BG_TOP, BG_BOT)
    return img, draw


def _top_bar(draw, accent, label=""):
    """Bande colorée en haut + label de section."""
    f = _get_fonts()
    draw.rectangle([0, 0, W, 8], fill=accent)
    if label:
        draw.text((40, 20), label, font=f["small"], fill=(*accent, 180))


def _watermark(draw):
    f = _get_fonts()
    draw.text((W - 260, H - 36), "Audit IA Platform", font=f["watermark"],
              fill=(*ACCENT, 120))
    # Petite barre en bas
    draw.rectangle([0, H - 4, W, H], fill=(*ACCENT, 60))


def _section_title(draw, text, y=80, accent=ACCENT):
    f = _get_fonts()
    # Trait coloré à gauche
    draw.rectangle([40, y - 4, 52, y + 60], fill=accent)
    draw.text((72, y), text, font=f["title"], fill=TEXT_W)
    return y + 80


def _subtitle(draw, text, y, color=None):
    f = _get_fonts()
    draw.text((72, y), text, font=f["subtitle"], fill=color or TEXT_M)
    return y + 50


def _body_text(draw, text, y, color=None, indent=72, max_w=90):
    f = _get_fonts()
    for line in textwrap.wrap(text, width=max_w):
        draw.text((indent, y), line, font=f["body"], fill=color or TEXT_M)
        y += 36
    return y + 6


def _bullet(draw, text, y, color=ACCENT, indent=72):
    f = _get_fonts()
    _draw_circle(draw, indent - 14, y + 13, 5, color)
    for i, line in enumerate(textwrap.wrap(text, width=85)):
        draw.text((indent, y + i * 34), line, font=f["body"],
                  fill=TEXT_W if i == 0 else TEXT_M)
    y += 34 * max(1, len(textwrap.wrap(text, width=85))) + 6
    return y


def _score_card(draw, img, x, y, label, value, w=340, h=220):
    """Card de score avec cercle coloré et barre."""
    from PIL import ImageDraw
    color = _score_color(value)
    # Fond card
    _draw_rounded_rect(draw, x, y, x + w, y + h, 20,
                       fill=CARD_COL, border=(*color, 80), border_w=2)
    # Valeur
    f = _get_fonts()
    val_str = str(value) if value is not None else "—"
    draw.text((x + w // 2 - 50, y + 18), val_str,
              font=f["score"], fill=color)
    draw.text((x + w // 2 - 18, y + 105), "/100",
              font=f["small"], fill=TEXT_M)
    # Label
    lbbox = draw.textbbox((0,0), label, font=f["subtitle"])
    lw = lbbox[2] - lbbox[0]
    draw.text((x + (w - lw) // 2, y + 138), label,
              font=f["subtitle"], fill=TEXT_W)
    # Barre de progression
    _draw_progress_bar(draw, x + 24, y + 186, w - 48, 14,
                       value or 0, color)
    return w, h


# ── Slides de contenu ─────────────────────────────────────────────────────────

def slide_title_platform(langue="fr"):
    """Slide d'ouverture spectaculaire."""
    img, draw = _base_frame()
    f = _get_fonts()

    # Cercles décoratifs de fond
    _draw_circle(draw, W - 180, 180, 280, (30, 40, 80))
    _draw_circle(draw, W - 180, 180, 200, (40, 50, 100))
    _draw_circle(draw, 100,     H - 100, 180, (25, 35, 70))

    # Icône bouclier centrale-droite
    _draw_shield(draw, W - 260, 260, 120, (*ACCENT, 200))

    # Dégradé accent en haut
    draw.rectangle([0, 0, W, 10], fill=ACCENT)
    # Ligne décorative latérale
    draw.rectangle([0, 10, 6, H], fill=(*ACCENT, 60))

    # Titre principal
    if langue == "fr":
        draw.text((90, 160), "Plateforme d'Audit IA",
                  font=f["title"], fill=TEXT_W)
        draw.text((90, 240), "Sécurisez votre code GitLab en quelques clics",
                  font=f["subtitle"], fill=TEXT_M)
    else:
        draw.text((90, 160), "AI Audit Platform",
                  font=f["title"], fill=TEXT_W)
        draw.text((90, 240), "Secure your GitLab code in a few clicks",
                  font=f["subtitle"], fill=TEXT_M)

    # 4 features dans des cards
    features_fr = [
        ("🔍", "Analyse OWASP", "Détection automatique\ndes vulnérabilités"),
        ("📊", "Scores détaillés", "Qualité · Sécurité\nPerformance"),
        ("🔗", "Intégration GitLab", "Issues & MR\nautomatiques"),
        ("🤖", "IA Générative", "Tests unitaires\net corrections"),
    ]
    features_en = [
        ("🔍", "OWASP Analysis", "Automatic vulnerability\ndetection"),
        ("📊", "Detailed Scores", "Quality · Security\nPerformance"),
        ("🔗", "GitLab Integration", "Automatic Issues\n& Merge Requests"),
        ("🤖", "Generative AI", "Unit tests\nand fixes"),
    ]
    features = features_fr if langue == "fr" else features_en

    card_w, card_h = 380, 180
    gap = 30
    total_w = 4 * card_w + 3 * gap
    start_x = (W - total_w) // 2

    for i, (icon, title, desc) in enumerate(features):
        cx = start_x + i * (card_w + gap)
        cy = 400
        _draw_rounded_rect(draw, cx, cy, cx + card_w, cy + card_h,
                           16, CARD_COL,
                           border=(*ACCENT, 100), border_w=1)
        # Bande colorée en haut de la card
        draw.rounded_rectangle([cx, cy, cx + card_w, cy + 6], radius=3,
                               fill=ACCENT)
        draw.text((cx + 16, cy + 18), icon,
                  font=f["subtitle"], fill=TEXT_W)
        draw.text((cx + 16, cy + 62), title,
                  font=f["badge"], fill=TEXT_W)
        for j, line in enumerate(desc.split("\n")):
            draw.text((cx + 16, cy + 96 + j * 28), line,
                      font=f["small"], fill=TEXT_M)

    # Badge "v2.0"
    _draw_badge(draw, 90, 310, "  v2.0  ",
                (*ACCENT, 200), (255, 255, 255), f, min_w=80)

    # Stats bar en bas
    draw.rectangle([0, H - 80, W, H - 4], fill=(16, 22, 40))
    stats = ["3 Types de scores", "OWASP Top 10", "TTS · Vidéo · PDF", "Multi-langue FR/EN"]
    sw = W // len(stats)
    for i, stat in enumerate(stats):
        sx = i * sw + sw // 2
        bbox = draw.textbbox((0, 0), stat, font=f["small"])
        tw   = bbox[2] - bbox[0]
        draw.text((sx - tw // 2, H - 62), stat, font=f["small"], fill=TEXT_M)
        if i > 0:
            draw.rectangle([i * sw, H - 72, i * sw + 1, H - 12],
                           fill=(50, 60, 90))

    _watermark(draw)
    return img


def slide_step(langue, step_num, icon_type, title_fr, title_en, bullets_fr, bullets_en, accent=ACCENT):
    """Slide d'une étape du workflow."""
    img, draw = _base_frame()
    f = _get_fonts()

    _top_bar(draw, accent,
             f"ÉTAPE {step_num}" if langue == "fr" else f"STEP {step_num}")

    # Numéro d'étape géant en fond (décoratif)
    big_num = str(step_num)
    draw.text((W - 200, 40), big_num, font=f["score"],
              fill=(*accent, 25))

    title = title_fr if langue == "fr" else title_en
    y = _section_title(draw, title, y=80, accent=accent)

    bullets = bullets_fr if langue == "fr" else bullets_en
    y += 10
    for b in bullets:
        y = _bullet(draw, b, y, color=accent)

    # Icône à droite
    if icon_type == "shield":
        _draw_shield(draw, W - 320, H // 2, 100, (*accent, 160))
    elif icon_type == "warning":
        _draw_warning_triangle(draw, W - 320, H // 2, 90, (*accent, 160))
    elif icon_type == "code":
        _draw_code_icon(draw, W - 320, H // 2, 100, (*accent, 160))
    elif icon_type == "check":
        _draw_checkmark_circle(draw, W - 320, H // 2, 100, (*accent, 160))

    _watermark(draw)
    return img


def slide_scores(score_q, score_s, score_p, nom_projet, langue="fr"):
    """Slide avec les 3 scores côte-à-côte."""
    img, draw = _base_frame()
    f = _get_fonts()

    _top_bar(draw, ACCENT,
             "RAPPORT D'ANALYSE" if langue == "fr" else "ANALYSIS REPORT")

    title = (f"Résultats — {nom_projet}" if langue == "fr"
             else f"Results — {nom_projet}")
    _section_title(draw, title, y=60, accent=ACCENT)

    labels = (["Qualité", "Sécurité", "Performance"] if langue == "fr"
              else ["Quality", "Security", "Performance"])

    cw, ch = 420, 260
    gap    = 60
    total_w = 3 * cw + 2 * gap
    sx     = (W - total_w) // 2
    sy     = 220

    for i, (label, value) in enumerate(zip(labels, [score_q, score_s, score_p])):
        _score_card(draw, img, sx + i * (cw + gap), sy, label, value, cw, ch)

    # Analyse globale
    avg = None
    vals = [v for v in [score_q, score_s, score_p] if v is not None]
    if vals:
        avg = int(sum(vals) / len(vals))

    if avg is not None:
        y_analysis = sy + ch + 60
        label_text = ("Score moyen global" if langue == "fr"
                      else "Overall average score")
        draw.text((sx, y_analysis), label_text,
                  font=f["subtitle"], fill=TEXT_M)
        _draw_progress_bar(draw, sx, y_analysis + 50, total_w, 22,
                           avg, _score_color(avg))
        avg_str = f"{avg}/100"
        draw.text((sx + total_w + 20, y_analysis + 44), avg_str,
                  font=f["badge"], fill=_score_color(avg))

        if avg >= 75:
            msg_fr = "✓ Code de bonne qualité"
            msg_en = "✓ Good quality code"
        elif avg >= 50:
            msg_fr = "⚠ Des améliorations sont nécessaires"
            msg_en = "⚠ Improvements are needed"
        else:
            msg_fr = "⛔ Corrections urgentes requises"
            msg_en = "⛔ Urgent corrections required"
        msg = msg_fr if langue == "fr" else msg_en
        draw.text((sx, y_analysis + 90), msg,
                  font=f["subtitle"], fill=_score_color(avg))

    _watermark(draw)
    return img


def slide_vuln_overview(vulns, langue="fr"):
    """Slide récapitulatif des vulnérabilités avec compteurs visuels."""
    img, draw = _base_frame()
    f = _get_fonts()

    critiques = [v for v in vulns if v.get("severite") == "CRITIQUE"]
    hautes    = [v for v in vulns if v.get("severite") == "HAUTE"]
    moyennes  = [v for v in vulns if v.get("severite") == "MOYENNE"]
    faibles   = [v for v in vulns if v.get("severite") == "FAIBLE"]

    accent_c = (239, 68, 68)
    _top_bar(draw, accent_c,
             "VULNÉRABILITÉS DÉTECTÉES" if langue == "fr"
             else "DETECTED VULNERABILITIES")

    title = (f"{len(vulns)} vulnérabilité(s) détectée(s)" if langue == "fr"
             else f"{len(vulns)} vulnerability(ies) detected")
    _section_title(draw, title, y=60, accent=accent_c)

    # 4 compteurs en cards
    sev_data = [
        ("CRITIQUE", len(critiques), (239, 68,  68)),
        ("HAUTE",    len(hautes),    (249, 115, 22)),
        ("MOYENNE",  len(moyennes),  (234, 179,  8)),
        ("FAIBLE",   len(faibles),   (16,  185, 129)),
    ]
    labels_fr = ["CRITIQUE", "HAUTE", "MOYENNE", "FAIBLE"]
    labels_en = ["CRITICAL", "HIGH",  "MEDIUM",  "LOW"]
    labels    = labels_fr if langue == "fr" else labels_en

    cw, ch = 340, 180
    gap    = 28
    total  = 4 * cw + 3 * gap
    sx     = (W - total) // 2

    for i, ((sev, count, color), label) in enumerate(zip(sev_data, labels)):
        cx = sx + i * (cw + gap)
        cy = 220
        _draw_rounded_rect(draw, cx, cy, cx + cw, cy + ch, 16,
                           CARD_COL, border=(*color, 120), border_w=2)
        draw.rectangle([cx, cy, cx + cw, cy + 6], fill=color)
        # Nombre
        n_str = str(count)
        nbbox = draw.textbbox((0, 0), n_str, font=f["score"])
        nw    = nbbox[2] - nbbox[0]
        draw.text((cx + (cw - nw) // 2, cy + 20), n_str,
                  font=f["score"], fill=color if count > 0 else TEXT_M)
        # Label
        lbbox = draw.textbbox((0, 0), label, font=f["badge"])
        lw    = lbbox[2] - lbbox[0]
        draw.text((cx + (cw - lw) // 2, cy + 110), label,
                  font=f["badge"], fill=TEXT_W)

    # Liste des 5 premières vulnérabilités
    y = 450
    sub = ("Top vulnérabilités :" if langue == "fr"
           else "Top vulnerabilities:")
    draw.text((sx, y), sub, font=f["subtitle"], fill=TEXT_M)
    y += 44

    for v in vulns[:6]:
        sev   = v.get("severite", "?")
        ttype = v.get("type",     "?")
        fich  = v.get("fichier",  "?").split("/")[-1]
        ligne = v.get("ligne",    "?")
        _, text_c, accent_c2 = _severity_colors(sev)
        # Badge sévérité
        bw, bh = _draw_badge(draw, sx, y,
                              f"  {sev}  ", accent_c2, (255, 255, 255), f)
        draw.text((sx + bw + 16, y + 4), f"{ttype}",
                  font=f["badge"], fill=TEXT_W)
        info = (f"📄 {fich} — ligne {ligne}" if langue == "fr"
                else f"📄 {fich} — line {ligne}")
        draw.text((sx + bw + 16, y + 34), info,
                  font=f["small"], fill=TEXT_M)
        y += 70

    _watermark(draw)
    return img


def slide_vuln_detail(type_vuln, severite, fichier, ligne, suggestion, langue="fr"):
    """Slide détaillé d'une seule vulnérabilité."""
    img, draw = _base_frame()
    f = _get_fonts()

    sev_bg, sev_text, sev_accent = _severity_colors(severite)
    _top_bar(draw, sev_accent,
             "VULNÉRABILITÉ" if langue == "fr" else "VULNERABILITY")

    # Badge sévérité large
    bw, bh = _draw_badge(draw, 72, 70,
                         f"  ⚠  {severite}  ", sev_accent,
                         (255, 255, 255), f, min_w=200)

    # Titre type
    draw.text((72, 120), type_vuln, font=f["title"], fill=TEXT_W)

    # Fichier + ligne
    info = (f"Fichier : {fichier}   •   Ligne : {ligne}" if langue == "fr"
            else f"File: {fichier}   •   Line: {ligne}")
    draw.text((72, 200), info, font=f["body"], fill=TEXT_M)

    # Séparateur
    draw.rectangle([72, 248, W - 72, 252], fill=(*sev_accent, 80))

    # Explication gauche
    left_title = "Risques associés" if langue == "fr" else "Associated Risks"
    draw.text((72, 270), left_title, font=f["subtitle"], fill=sev_accent)

    exp = _owasp_explanation(type_vuln, langue)
    y = 320
    for line in exp:
        y = _bullet(draw, line, y, color=sev_accent)

    # Card correction droite
    mid = W // 2 + 40
    crd_w = W - mid - 60
    _draw_rounded_rect(draw, mid, 260, mid + crd_w, H - 80, 20,
                       CARD_COL, border=(*sev_accent, 80), border_w=2)
    draw.rectangle([mid, 260, mid + crd_w, 268], fill=sev_accent)

    fix_title = "💡 Correction suggérée" if langue == "fr" else "💡 Suggested Fix"
    draw.text((mid + 24, 278), fix_title,
              font=f["subtitle"], fill=sev_accent)

    fy = 330
    for line in textwrap.wrap(suggestion, width=42):
        draw.text((mid + 24, fy), line, font=f["body"], fill=TEXT_W)
        fy += 36

    # Bonnes pratiques
    fy += 20
    bp_title = "✓ Bonnes pratiques" if langue == "fr" else "✓ Best Practices"
    draw.text((mid + 24, fy), bp_title, font=f["badge"], fill=(16, 185, 129))
    fy += 36
    for bp in _best_practices(type_vuln, langue)[:4]:
        draw.text((mid + 24, fy), f"  • {bp}", font=f["small"], fill=TEXT_M)
        fy += 30

    # Icône avertissement
    _draw_warning_triangle(draw, mid - 80, H - 100, 40, sev_accent)

    _watermark(draw)
    return img


def slide_recommendations(recos, langue="fr"):
    """Slide des recommandations avec check-marks verts."""
    img, draw = _base_frame()
    f = _get_fonts()

    green = (16, 185, 129)
    _top_bar(draw, green,
             "RECOMMANDATIONS" if langue == "fr" else "RECOMMENDATIONS")

    title = (f"{len(recos)} recommandation(s) d'amélioration" if langue == "fr"
             else f"{len(recos)} improvement recommendation(s)")
    _section_title(draw, title, y=60, accent=green)

    if not recos:
        _draw_checkmark_circle(draw, W // 2, H // 2 - 40, 80, green)
        msg = "✅ Code optimal — Aucune recommandation" if langue == "fr" else "✅ Optimal code — No recommendations"
        mbbox = draw.textbbox((0, 0), msg, font=f["subtitle"])
        mw    = mbbox[2] - mbbox[0]
        draw.text((W // 2 - mw // 2, H // 2 + 60), msg,
                  font=f["subtitle"], fill=green)
    else:
        # 2 colonnes
        mid  = W // 2
        left = recos[0::2][:5]
        right = recos[1::2][:5]

        def draw_recos(lst, x_start, y_start):
            y = y_start
            for r in lst:
                titre = r.get("titre", "?")
                desc  = r.get("description", "")
                _draw_checkmark_circle(draw, x_start + 20, y + 14, 16, green)
                draw.text((x_start + 50, y), titre,
                          font=f["badge"], fill=TEXT_W)
                y += 32
                for line in textwrap.wrap(desc, width=55)[:2]:
                    draw.text((x_start + 50, y), line,
                              font=f["small"], fill=TEXT_M)
                    y += 26
                y += 14

        draw_recos(left,  80,     200)
        draw_recos(right, W // 2, 200)

    _watermark(draw)
    return img


def slide_action_plan(vulns, recos, langue="fr"):
    """Slide plan d'action final avec étapes numérotées."""
    img, draw = _base_frame()
    f = _get_fonts()

    purple = (139, 92, 246)
    _top_bar(draw, purple,
             "PLAN D'ACTION" if langue == "fr" else "ACTION PLAN")

    title = "Plan d'action recommandé" if langue == "fr" else "Recommended Action Plan"
    _section_title(draw, title, y=60, accent=purple)

    critiques = [v for v in vulns if v.get("severite") == "CRITIQUE"]
    hautes    = [v for v in vulns if v.get("severite") == "HAUTE"]

    steps_fr = [
        ("1", (239, 68, 68),   "Corriger les vulnérabilités CRITIQUES",
         f"Priorité absolue — {len(critiques)} vulnérabilité(s) à corriger immédiatement"
         if critiques else "✓ Aucune vulnérabilité critique"),
        ("2", (249, 115, 22),  "Traiter les vulnérabilités HAUTES",
         f"{len(hautes)} vulnérabilité(s) haute(s) à résoudre rapidement"
         if hautes else "✓ Aucune vulnérabilité haute"),
        ("3", (99, 102, 241),  "Appliquer les recommandations",
         f"{len(recos)} amélioration(s) de qualité à intégrer"),
        ("4", (16, 185, 129),  "Relancer l'analyse",
         "Vérifier que toutes les corrections ont été appliquées"),
        ("5", (59, 130, 246),  "Intégrer au CI/CD",
         "Configurer des analyses automatiques à chaque commit"),
    ]
    steps_en = [
        ("1", (239, 68, 68),   "Fix CRITICAL vulnerabilities",
         f"Top priority — {len(critiques)} vulnerability(ies) to fix immediately"
         if critiques else "✓ No critical vulnerabilities"),
        ("2", (249, 115, 22),  "Fix HIGH severity vulnerabilities",
         f"{len(hautes)} high severity vulnerability(ies) to fix quickly"
         if hautes else "✓ No high severity vulnerabilities"),
        ("3", (99, 102, 241),  "Apply recommendations",
         f"Integrate {len(recos)} quality improvement(s)"),
        ("4", (16, 185, 129),  "Re-run the analysis",
         "Verify that all fixes have been applied correctly"),
        ("5", (59, 130, 246),  "Integrate into CI/CD",
         "Set up automatic analysis on every commit"),
    ]
    steps = steps_fr if langue == "fr" else steps_en

    y = 200
    for num, color, title_s, desc in steps:
        # Cercle numéro
        _draw_circle(draw, 100, y + 24, 28, color)
        num_bbox = draw.textbbox((0, 0), num, font=f["badge"])
        nw = num_bbox[2] - num_bbox[0]
        draw.text((100 - nw // 2, y + 12), num, font=f["badge"],
                  fill=(255, 255, 255))
        # Ligne de connexion
        if num != "5":
            draw.rectangle([98, y + 52, 102, y + 110], fill=(*color, 80))

        draw.text((150, y + 6),  title_s, font=f["badge"], fill=TEXT_W)
        draw.text((150, y + 36), desc,    font=f["small"], fill=TEXT_M)
        y += 110

    # Icône étoile résultat
    _draw_star(draw, W - 260, H // 2, 90, (*purple, 60))
    _draw_star(draw, W - 260, H // 2, 70, (*purple, 100))

    _watermark(draw)
    return img


def slide_closing(langue="fr"):
    """Slide de fin avec appel à l'action."""
    img, draw = _base_frame()
    f = _get_fonts()

    # Cercles décoratifs
    _draw_circle(draw, W // 2, H // 2, 420, (20, 28, 54))
    _draw_circle(draw, W // 2, H // 2, 340, (26, 36, 64))
    _draw_circle(draw, W // 2, H // 2, 260, (32, 44, 76))

    _draw_shield(draw, W // 2, H // 2 - 60, 90, (*ACCENT, 220))

    draw.rectangle([0, 0, W, 8], fill=ACCENT)

    if langue == "fr":
        main = "Votre code est plus sûr."
        sub  = "Continuez à analyser régulièrement pour maintenir un haut niveau de sécurité."
        cta  = "🔄 Relancez une analyse sur votre prochain commit"
    else:
        main = "Your code is more secure."
        sub  = "Keep analyzing regularly to maintain a high level of security."
        cta  = "🔄 Run a new analysis on your next commit"

    mbbox = draw.textbbox((0, 0), main, font=f["title"])
    mw = mbbox[2] - mbbox[0]
    draw.text(((W - mw) // 2, H // 2 + 80), main,
              font=f["title"], fill=TEXT_W)

    sbbox = draw.textbbox((0, 0), sub, font=f["body"])
    sw = sbbox[2] - sbbox[0]
    draw.text(((W - sw) // 2, H // 2 + 150), sub,
              font=f["body"], fill=TEXT_M)

    # Badge CTA
    cbbox = draw.textbbox((0, 0), cta, font=f["badge"])
    cw2 = cbbox[2] - cbbox[0]
    cx  = (W - cw2 - 60) // 2
    _draw_rounded_rect(draw, cx, H // 2 + 210, cx + cw2 + 60,
                       H // 2 + 264, 16, ACCENT)
    draw.text((cx + 30, H // 2 + 222), cta,
              font=f["badge"], fill=(255, 255, 255))

    _watermark(draw)
    return img


# ── Données OWASP ─────────────────────────────────────────────────────────────

def _owasp_explanation(type_vuln: str, lang: str) -> list:
    data = {
        "SQL_INJECTION": {
            "fr": ["Permet d'insérer du SQL malveillant dans vos requêtes",
                   "Risque : vol, modification ou suppression de données",
                   "Peut compromettre toute la base de données"],
            "en": ["Allows inserting malicious SQL into your queries",
                   "Risk: theft, modification or deletion of data",
                   "Can compromise the entire database"],
        },
        "XSS": {
            "fr": ["Injection de JavaScript malveillant dans les pages",
                   "Risque : vol de sessions, phishing, redirections",
                   "Affecte tous les utilisateurs connectés"],
            "en": ["Malicious JavaScript injection into pages",
                   "Risk: session theft, phishing, redirections",
                   "Affects all connected users"],
        },
        "HARDCODED_SECRET": {
            "fr": ["Clé API, mot de passe ou token écrit dans le code",
                   "Risque : accès non autorisé si le code est partagé",
                   "Exposé à quiconque accède au dépôt"],
            "en": ["API key, password or token written in code",
                   "Risk: unauthorized access if code is shared",
                   "Exposed to anyone with repository access"],
        },
        "BROKEN_AUTH": {
            "fr": ["Mécanisme d'authentification défaillant",
                   "Risque : compromission de comptes utilisateurs",
                   "Permet l'usurpation d'identité"],
            "en": ["Defective authentication mechanism",
                   "Risk: user account compromise",
                   "Allows identity theft"],
        },
        "CSRF": {
            "fr": ["Force un utilisateur à effectuer des actions non voulues",
                   "Risque : transactions frauduleuses, modifications de données",
                   "Exploite la session active de l'utilisateur"],
            "en": ["Forces a user to perform unwanted actions",
                   "Risk: fraudulent transactions, data changes",
                   "Exploits the user's active session"],
        },
    }
    default = {
        "fr": ["Faille de sécurité exposant votre application",
               "Risque d'accès non autorisé ou de fuite de données",
               "Correction requise selon les standards OWASP"],
        "en": ["Security flaw exposing your application",
               "Risk of unauthorized access or data leak",
               "Fix required according to OWASP standards"],
    }
    vuln_data = data.get(type_vuln.upper().replace("-", "_"), default)
    return vuln_data.get(lang, default.get(lang, default["fr"]))


def _best_practices(type_vuln: str, lang: str) -> list:
    data = {
        "SQL_INJECTION": {
            "fr": ["Requêtes préparées (paramétrisées)",
                   "Ne jamais concaténer d'entrées utilisateur",
                   "ORM avec protection intégrée",
                   "Principe du moindre privilège DB"],
            "en": ["Prepared (parameterized) statements",
                   "Never concatenate user inputs",
                   "ORM with built-in protection",
                   "Least privilege DB principle"],
        },
        "XSS": {
            "fr": ["Échapper toutes les données affichées",
                   "Content Security Policy (CSP)",
                   "Validation des entrées côté serveur",
                   "Frameworks avec auto-échappement"],
            "en": ["Escape all displayed data",
                   "Content Security Policy (CSP)",
                   "Server-side input validation",
                   "Frameworks with auto-escaping"],
        },
        "HARDCODED_SECRET": {
            "fr": ["Variables d'environnement (.env)",
                   "Gestionnaire de secrets (Vault, AWS SM)",
                   "Invalider immédiatement les secrets exposés",
                   "Audits réguliers des dépôts"],
            "en": ["Environment variables (.env)",
                   "Secrets manager (Vault, AWS SM)",
                   "Immediately invalidate exposed secrets",
                   "Regular repository audits"],
        },
    }
    default = {
        "fr": ["Valider toutes les entrées utilisateur",
               "Principe du moindre privilège",
               "Mises à jour régulières des dépendances",
               "Tests de sécurité automatisés"],
        "en": ["Validate all user inputs",
               "Least privilege principle",
               "Regular dependency updates",
               "Automated security testing"],
    }
    vuln_data = data.get(type_vuln.upper().replace("-", "_"), default)
    return vuln_data.get(lang, default.get(lang, default["fr"]))


# ── TTS helper ───────────────────────────────────────────────────────────────

async def _tts(text: str, langue: str) -> str:
    import edge_tts
    voices = {"fr": "fr-FR-DeniseNeural", "en": "en-US-AriaNeural"}
    voice  = voices.get(langue, voices["fr"])
    tmp    = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3",
                                         prefix="vid_tts_")
    tmp.close()
    communicate = edge_tts.Communicate(text=text, voice=voice)
    await communicate.save(tmp.name)
    return tmp.name


def _compose(frames_dur: list, audio_path: str, output_path: str):
    import numpy as np
    from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips

    clips = []
    for pil_img, dur in frames_dur:
        arr  = np.array(pil_img)
        clip = ImageClip(arr, duration=dur)
        clips.append(clip)

    video = concatenate_videoclips(clips, method="compose")
    audio = AudioFileClip(audio_path)

    if audio.duration > video.duration:
        extra = audio.duration - video.duration
        last  = clips[-1].set_duration(clips[-1].duration + extra)
        clips[-1] = last
        video = concatenate_videoclips(clips, method="compose")

    video = video.set_audio(audio)
    video.write_videofile(output_path, codec="libx264", audio_codec="aac",
                          fps=24, preset="medium", threads=4,
                          verbose=False, logger=None)
    video.close()
    audio.close()
    for c in clips:
        c.close()


# ── Service principal ─────────────────────────────────────────────────────────

class VideoGeneratorService:

    async def generate_application_video(self, langue: str = "fr") -> str:
        output = str(VIDEO_OUTPUT_DIR / f"presentation_{langue}.mp4")

        if langue == "fr":
            narrations = [
                ("Bienvenue sur la Plateforme d'Audit IA. Notre solution analyse automatiquement "
                 "la sécurité de vos dépôts GitLab, détecte les vulnérabilités OWASP, "
                 "et génère des rapports détaillés avec scores de qualité, sécurité et performance."),
                ("Pour commencer, connectez votre dépôt GitLab. Renseignez l'URL du projet, "
                 "votre token d'accès personnel, choisissez la branche à analyser, "
                 "puis lancez l'analyse en un clic."),
                ("Notre intelligence artificielle scanne l'intégralité de votre code source. "
                 "Elle détecte les injections SQL, les failles XSS et CSRF, "
                 "les secrets codés en dur comme les clés API, "
                 "et les composants avec des vulnérabilités connues."),
                ("À l'issue de l'analyse, un rapport complet est généré avec trois scores : "
                 "qualité, sécurité et performance, ainsi que des recommandations prioritaires "
                 "pour corriger les problèmes détectés."),
                ("La plateforme s'intègre directement à votre workflow GitLab. "
                 "Elle crée automatiquement des issues pour chaque vulnérabilité, "
                 "génère des merge requests avec les corrections proposées, "
                 "et peut même créer des tests unitaires automatiquement."),
                ("Votre code est maintenant plus sûr. "
                 "Continuez à analyser régulièrement pour maintenir un haut niveau de sécurité."),
            ]
            bullets_step1_fr = [
                "Entrez l'URL de votre dépôt GitLab",
                "Fournissez votre token d'accès personnel",
                "Choisissez la branche à analyser",
                "Lancez l'analyse en un seul clic",
            ]
            bullets_step2_fr = [
                "Injection SQL, XSS, CSRF, Path Traversal",
                "Secrets codés en dur (clés API, tokens)",
                "Mauvaises configurations de sécurité",
                "Composants avec vulnérabilités connues (CVE)",
            ]
            bullets_step3_fr = [
                "Score qualité : maintenabilité du code",
                "Score sécurité : niveau de protection OWASP",
                "Score performance : efficacité du code",
                "Recommandations prioritaires de correction",
            ]
            bullets_step4_fr = [
                "Création automatique d'Issues par vulnérabilité",
                "Génération de Merge Requests avec corrections",
                "Tests unitaires générés par l'IA",
                "Webhooks pour synchronisation temps réel",
            ]
        else:
            narrations = [
                ("Welcome to the AI Audit Platform. Our solution automatically analyzes "
                 "the security of your GitLab repositories, detects OWASP vulnerabilities, "
                 "and generates detailed reports with quality, security, and performance scores."),
                ("To get started, connect your GitLab repository. Enter the project URL, "
                 "your personal access token, choose the branch to analyze, "
                 "and launch the analysis with one click."),
                ("Our artificial intelligence scans your entire source code. "
                 "It detects SQL injections, XSS and CSRF flaws, "
                 "hardcoded secrets like API keys, "
                 "and components with known vulnerabilities."),
                ("After the analysis, a complete report is generated with three scores: "
                 "quality, security, and performance, along with priority recommendations "
                 "to fix the detected issues."),
                ("The platform integrates directly with your GitLab workflow. "
                 "It automatically creates issues for each vulnerability, "
                 "generates merge requests with proposed fixes, "
                 "and can even automatically create unit tests."),
                ("Your code is now more secure. "
                 "Keep analyzing regularly to maintain a high level of security."),
            ]
            bullets_step1_fr = [
                "Enter your GitLab repository URL",
                "Provide your personal access token",
                "Select the branch to analyze",
                "Launch the analysis in one click",
            ]
            bullets_step2_fr = [
                "SQL Injection, XSS, CSRF, Path Traversal",
                "Hardcoded secrets (API keys, tokens)",
                "Security misconfigurations",
                "Components with known vulnerabilities (CVE)",
            ]
            bullets_step3_fr = [
                "Quality score: code maintainability",
                "Security score: OWASP protection level",
                "Performance score: code efficiency",
                "Priority correction recommendations",
            ]
            bullets_step4_fr = [
                "Automatic issue creation per vulnerability",
                "Merge Request generation with fixes",
                "AI-generated unit tests",
                "Webhooks for real-time sync",
            ]

        step_titles = {
            "fr": [
                ("GitLab Connection", "Connexion GitLab"),
                ("Automated Analysis", "Analyse Automatique"),
                ("Audit Report", "Rapport d'Audit"),
                ("GitLab Integration", "Intégration GitLab"),
            ],
            "en": [
                ("GitLab Connection", "GitLab Connection"),
                ("Automated Analysis", "Automated Analysis"),
                ("Audit Report", "Audit Report"),
                ("GitLab Integration", "GitLab Integration"),
            ],
        }

        frames = [
            (slide_title_platform(langue), 9),
            (slide_step(langue, 1, "code",
                        "Connexion GitLab", "GitLab Connection",
                        bullets_step1_fr, bullets_step1_fr,
                        accent=ACCENT), 8),
            (slide_step(langue, 2, "warning",
                        "Analyse Automatique", "Automated Analysis",
                        bullets_step2_fr, bullets_step2_fr,
                        accent=(249, 115, 22)), 8),
            (slide_step(langue, 3, "shield",
                        "Rapport d'Audit", "Audit Report",
                        bullets_step3_fr, bullets_step3_fr,
                        accent=(16, 185, 129)), 8),
            (slide_step(langue, 4, "check",
                        "Intégration GitLab", "GitLab Integration",
                        bullets_step4_fr, bullets_step4_fr,
                        accent=(59, 130, 246)), 8),
            (slide_closing(langue), 7),
        ]

        full_narration = " ".join(narrations)
        audio_path = await _tts(full_narration, langue)
        _compose(frames, audio_path, output)
        os.unlink(audio_path)
        return output

    async def generate_vulnerability_video(self, req: VideoVulnerabiliteRequest) -> str:
        lang   = req.langue if req.langue in ("fr", "en") else "fr"
        output = str(VIDEO_OUTPUT_DIR / f"vuln_{req.type_vuln.lower()}_{req.ligne}.mp4")
        fname  = req.fichier.split("/")[-1]

        if lang == "fr":
            narrations = [
                (f"Vulnérabilité de type {req.type_vuln} détectée, niveau {req.severite}. "
                 f"Elle se trouve dans le fichier {fname}, à la ligne {req.ligne}."),
                (" ".join(_owasp_explanation(req.type_vuln, "fr")) +
                 " Cette faille peut exposer votre application à des risques importants."),
                f"Pour corriger cette vulnérabilité : {req.suggestion}",
                ("Voici les bonnes pratiques à appliquer pour éviter ce type de faille. "
                 "Appliquez ces règles systématiquement dans votre code."),
            ]
        else:
            narrations = [
                (f"{req.type_vuln} vulnerability detected, severity {req.severite}. "
                 f"Found in file {fname}, at line {req.ligne}."),
                (" ".join(_owasp_explanation(req.type_vuln, "en")) +
                 " This flaw may expose your application to significant risks."),
                f"To fix this vulnerability: {req.suggestion}",
                ("Here are the best practices to apply to avoid this type of flaw. "
                 "Apply these rules systematically in your code."),
            ]

        # Slide bonnes pratiques
        bp_lines = _best_practices(req.type_vuln, lang)
        bp_title = "Bonnes pratiques" if lang == "fr" else "Best Practices"
        bp_frame_img, bp_draw = _base_frame()
        f = _get_fonts()
        sev_bg, sev_text, sev_accent = _severity_colors(req.severite)
        _top_bar(bp_draw, (16, 185, 129),
                 "BONNES PRATIQUES" if lang == "fr" else "BEST PRACTICES")
        _section_title(bp_draw, bp_title, y=60, accent=(16, 185, 129))
        y = 200
        for bp in bp_lines:
            _draw_checkmark_circle(bp_draw, 90, y + 14, 18, (16, 185, 129))
            bp_draw.text((130, y + 2), bp, font=f["body"], fill=TEXT_W)
            y += 50
        _watermark(bp_draw)

        frames = [
            (slide_vuln_detail(req.type_vuln, req.severite,
                               req.fichier, req.ligne, req.suggestion, lang), 10),
            (slide_vuln_detail(req.type_vuln, req.severite,
                               req.fichier, req.ligne, req.suggestion, lang), 9),
            (slide_vuln_detail(req.type_vuln, req.severite,
                               req.fichier, req.ligne, req.suggestion, lang), 8),
            (bp_frame_img, 7),
        ]

        full_narration = " ".join(narrations)
        audio_path = await _tts(full_narration, lang)
        _compose(frames, audio_path, output)
        os.unlink(audio_path)
        return output

    async def generate_rapport_video(self, req: VideoRapportRequest) -> str:
        lang   = req.langue if req.langue in ("fr", "en") else "fr"
        output = str(VIDEO_OUTPUT_DIR /
                     f"rapport_{req.nom_projet.lower().replace(' ', '_')}.mp4")

        vulns    = req.vulnerabilites or []
        recos    = req.recommandations or []
        critiques = [v for v in vulns if v.get("severite") == "CRITIQUE"]
        hautes    = [v for v in vulns if v.get("severite") == "HAUTE"]

        def v(n): return n if n is not None else "N/A"
        def vfr(n): return n if n is not None else "non disponible"

        if lang == "fr":
            narrations = [
                (f"Rapport d'audit pour le projet {req.nom_projet}. "
                 f"Score qualité : {vfr(req.score_qualite)} sur cent. "
                 f"Score sécurité : {vfr(req.score_securite)} sur cent. "
                 f"Score performance : {vfr(req.score_performance)} sur cent."),
                (f"L'analyse a détecté {len(vulns)} vulnérabilités au total. "
                 + (f"{len(critiques)} sont critiques et nécessitent une correction immédiate. "
                    if critiques else "Aucune vulnérabilité critique détectée. ")
                 + (f"{len(hautes)} sont de sévérité haute." if hautes else "")),
                (f"{len(recos)} recommandations ont été générées. "
                 + ("Les principales sont : " + ", ".join(r.get("titre", "") for r in recos[:3]) + "."
                    if recos else "Votre code est déjà optimal.")),
                ("Voici le plan d'action recommandé. "
                 + ("Commencez par corriger les vulnérabilités critiques. " if critiques else "")
                 + "Appliquez les recommandations, puis relancez une analyse pour vérifier."),
            ]
        else:
            narrations = [
                (f"Audit report for project {req.nom_projet}. "
                 f"Quality score: {v(req.score_qualite)} out of one hundred. "
                 f"Security score: {v(req.score_securite)} out of one hundred. "
                 f"Performance score: {v(req.score_performance)} out of one hundred."),
                (f"The analysis detected {len(vulns)} vulnerabilities in total. "
                 + (f"{len(critiques)} are critical and require immediate fixing. "
                    if critiques else "No critical vulnerabilities detected. ")
                 + (f"{len(hautes)} are high severity." if hautes else "")),
                (f"{len(recos)} recommendations were generated. "
                 + ("Main ones: " + ", ".join(r.get("titre", "") for r in recos[:3]) + "."
                    if recos else "Your code is already optimal.")),
                ("Here is the recommended action plan. "
                 + ("Start by fixing critical vulnerabilities. " if critiques else "")
                 + "Apply recommendations, then re-run the analysis to verify."),
            ]

        frames = [
            (slide_scores(req.score_qualite, req.score_securite,
                          req.score_performance, req.nom_projet, lang), 10),
            (slide_vuln_overview(vulns, lang), 11),
            (slide_recommendations(recos, lang), 10),
            (slide_action_plan(vulns, recos, lang), 10),
        ]

        full_narration = " ".join(narrations)
        audio_path = await _tts(full_narration, lang)
        _compose(frames, audio_path, output)
        os.unlink(audio_path)
        return output


video_service = VideoGeneratorService()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/application",
             summary="Génère une vidéo de présentation de la plateforme")
async def video_application(req: VideoApplicationRequest):
    try:
        path = await video_service.generate_application_video(req.langue)
        return FileResponse(path, media_type="video/mp4",
                            filename=f"presentation_audit_ia_{req.langue}.mp4")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur vidéo : {str(e)}")


@router.post("/vulnerabilite",
             summary="Génère une vidéo explicative d'une vulnérabilité")
async def video_vulnerabilite(req: VideoVulnerabiliteRequest):
    try:
        path = await video_service.generate_vulnerability_video(req)
        return FileResponse(path, media_type="video/mp4",
                            filename=f"vuln_{req.type_vuln.lower()}_{req.ligne}.mp4")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur vidéo : {str(e)}")


@router.post("/rapport",
             summary="Génère une vidéo de résumé d'un rapport d'audit")
async def video_rapport(req: VideoRapportRequest):
    try:
        path = await video_service.generate_rapport_video(req)
        return FileResponse(path, media_type="video/mp4",
                            filename=f"rapport_{req.nom_projet.lower().replace(' ', '_')}.mp4")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur vidéo : {str(e)}")


@router.get("/status", summary="Vérifie les dépendances vidéo")
async def video_status():
    import subprocess
    status  = {"ffmpeg": False, "moviepy": False, "pillow": False, "edge_tts": False}
    details = {}

    try:
        r = subprocess.run(["ffmpeg", "-version"], capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            status["ffmpeg"] = True
            details["ffmpeg_version"] = r.stdout.split("\n")[0]
    except Exception:
        details["ffmpeg_error"] = "FFmpeg non trouvé. sudo apt install ffmpeg"

    for lib, key in [("moviepy", "moviepy"), ("PIL", "pillow"), ("edge_tts", "edge_tts")]:
        try:
            m = __import__(lib)
            status[key] = True
            details[f"{key}_version"] = getattr(m, "__version__", "ok")
        except ImportError:
            details[f"{key}_error"] = f"pip install {lib}"

    return {"ready": all(status.values()), "dependencies": status, "details": details}