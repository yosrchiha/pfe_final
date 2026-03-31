# backend/app/services/pdf_service.py
import os
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_CENTER, TA_LEFT

# Essayer d'utiliser une police plus moderne si disponible
try:
    pdfmetrics.registerFont(TTFont('Inter', 'Inter-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('Inter-Bold', 'Inter-Bold.ttf'))
    FONT_REGULAR = 'Inter'
    FONT_BOLD = 'Inter-Bold'
except:
    FONT_REGULAR = 'Helvetica'
    FONT_BOLD = 'Helvetica-Bold'


def generer_rapport_pdf(analyse: dict, depot: dict, output_path: str = None) -> tuple:
    """
    Génère un rapport PDF à partir d'une analyse.

    Args:
        analyse: dict contenant les données de l'analyse
        depot: dict contenant les infos du dépôt
        output_path: chemin de sortie (optionnel)

    Returns:
        tuple: (chemin du fichier PDF généré, taille en octets)
    """
    if output_path is None:
        output_dir = "rapports"
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"{output_dir}/rapport_{analyse['id']}_{timestamp}.pdf"

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=2*cm,
        bottomMargin=2*cm
    )

    styles = getSampleStyleSheet()
    story = []

    # Styles personnalisés
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName=FONT_BOLD,
        fontSize=24,
        textColor=colors.HexColor('#0f172a'),
        alignment=TA_CENTER,
        spaceAfter=20
    )

    section_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Heading2'],
        fontName=FONT_BOLD,
        fontSize=16,
        textColor=colors.HexColor('#6366f1'),
        spaceBefore=20,
        spaceAfter=10
    )

    score_style = ParagraphStyle(
        'Score',
        parent=styles['Normal'],
        fontName=FONT_BOLD,
        fontSize=36,
        alignment=TA_CENTER
    )

    normal_style = ParagraphStyle(
        'Normal',
        parent=styles['Normal'],
        fontName=FONT_REGULAR,
        fontSize=10,
        leading=14
    )

    # ── En-tête ─────────────────────────────────────────────
    story.append(Paragraph("AuditPlatform", title_style))
    story.append(Paragraph(f"Rapport d'analyse — {depot.get('nom', 'Projet')}", section_style))
    story.append(Paragraph(f"Généré le {datetime.now().strftime('%d/%m/%Y à %H:%M')}", normal_style))
    story.append(Spacer(1, 20))

    # ── Informations du projet ─────────────────────────────
    story.append(Paragraph("📁 Informations du projet", section_style))

    info_data = [
        ["Nom du projet", depot.get('nom', 'N/A')],
        ["URL du projet", depot.get('project_url', 'N/A')],
        ["Branche analysée", analyse.get('branche', 'main')],
        ["Date de l'analyse", datetime.fromisoformat(analyse['created_at']).strftime('%d/%m/%Y %H:%M') if analyse.get('created_at') else 'N/A'],
        ["Modèle LLM", analyse.get('modele_llm', 'Llama 3.1 8B')],
        ["Analyse OWASP", "Activée" if analyse.get('owasp_enabled', True) else "Désactivée"],
    ]

    info_table = Table(info_data, colWidths=[5*cm, 10*cm])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), FONT_BOLD),
        ('FONTNAME', (1, 0), (1, -1), FONT_REGULAR),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 20))

    # ── Scores ─────────────────────────────────────────────
    story.append(Paragraph("📊 Scores", section_style))

    score_data = [
        ["Qualité", analyse.get('score_qualite', 0), f"{analyse.get('score_qualite', 0)}/100"],
        ["Sécurité", analyse.get('score_securite', 0), f"{analyse.get('score_securite', 0)}/100"],
        ["Performance", analyse.get('score_performance', 0), f"{analyse.get('score_performance', 0)}/100"],
    ]

    score_table = Table(score_data, colWidths=[5*cm, 4*cm, 4*cm])
    score_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (-1, -1), FONT_BOLD),
        ('FONTSIZE', (0, 0), (-1, -1), 12),
        ('ALIGN', (1, 0), (2, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 20))

    # ── Vulnérabilités ─────────────────────────────────────
    vulnerabilites = analyse.get('vulnerabilites', [])
    if vulnerabilites:
        story.append(Paragraph(f"⚠️ Vulnérabilités ({len(vulnerabilites)})", section_style))

        for v in vulnerabilites:
            sev_color = {
                "CRITIQUE": colors.HexColor('#ef4444'),
                "HAUTE": colors.HexColor('#f97316'),
                "MOYENNE": colors.HexColor('#eab308'),
                "FAIBLE": colors.HexColor('#10b981')
            }.get(v.get('severite', 'MOYENNE'), colors.HexColor('#64748b'))

            vuln_data = [
                [Paragraph(f"<b>{v.get('type', 'Vulnérabilité')}</b>", normal_style)],
                [Paragraph(f"Sévérité : {v.get('severite', 'N/A')}", normal_style)],
                [Paragraph(f"Fichier : {v.get('fichier', 'N/A')} — ligne {v.get('ligne', 'N/A')}", normal_style)],
                [Paragraph(f"Correction : {v.get('suggestion', 'N/A')}", normal_style)],
            ]

            vuln_table = Table(vuln_data, colWidths=[15*cm])
            vuln_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), FONT_REGULAR),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BACKGROUND', (0, 0), (0, 0), sev_color),
                ('TEXTCOLOR', (0, 0), (0, 0), colors.white),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ]))
            story.append(vuln_table)
            story.append(Spacer(1, 6))

    # ── Recommandations ───────────────────────────────────
    recommandations = analyse.get('recommandations', [])
    if recommandations:
        story.append(PageBreak())
        story.append(Paragraph("💡 Recommandations", section_style))

        for i, r in enumerate(recommandations, 1):
            rec_text = f"<b>{i}. {r.get('titre', 'Recommandation')}</b><br/>{r.get('description', 'N/A')}"
            story.append(Paragraph(rec_text, normal_style))
            story.append(Spacer(1, 8))

    # ── Pied de page ──────────────────────────────────────
    story.append(Spacer(1, 30))
    story.append(Paragraph(
        f"Rapport généré automatiquement par AuditPlatform · {datetime.now().strftime('%Y')}",
        ParagraphStyle('Footer', parent=normal_style, fontSize=8, textColor=colors.HexColor('#94a3b8'), alignment=TA_CENTER)
    ))

    # Génération du PDF
    doc.build(story)

    # Récupérer la taille du fichier
    taille = os.path.getsize(output_path)

    return output_path, taille