import os
import json
from datetime import datetime
from typing import Dict, Any, List
from io import BytesIO

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

class ReportGenerator:
    """
    Generates professional Markdown and PDF analysis reports.
    """

    @staticmethod
    def generate_markdown(
        query: str,
        dataset_name: str,
        insights: str,
        validated_sql: str = "",
        query_result: Dict[str, Any] = None,
        anomalies: List[Dict[str, Any]] = None,
        confidence_score: float = 0.0,
        reviewer_approved: bool = True
    ) -> str:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        status_text = "Verified Grounded" if reviewer_approved else "Review Required"
        
        md_lines = [
            f"# Executive Data Analysis Report",
            f"**Generated:** {timestamp} | **Dataset:** `{dataset_name}`",
            f"**Validation Status:** {status_text} (Confidence: {int(confidence_score * 100)}%)\n",
            f"---",
            f"## Business Question",
            f"> {query}\n",
            f"## Executive Insights & Recommendations",
            f"{insights}\n",
        ]

        if validated_sql:
            md_lines.extend([
                f"## Synthesized SQL Query",
                f"```sql",
                f"{validated_sql.strip()}",
                f"```\n"
            ])

        if anomalies and len(anomalies) > 0:
            md_lines.extend([
                f"## Statistical Anomalies Detected",
                f"The system discovered {len(anomalies)} anomaly/outlier(s):"
            ])
            for an in anomalies:
                md_lines.append(f"- **Column `{an.get('column')}`**: Value `{an.get('value')}` ({an.get('reason', 'Statistical Outlier')})")
            md_lines.append("")

        if query_result and query_result.get("rows"):
            rows = query_result.get("rows", [])
            cols = query_result.get("columns", [])
            md_lines.append(f"## Data Extract ({len(rows)} sample rows)")
            header = "| " + " | ".join(cols) + " |"
            sep = "| " + " | ".join(["---"] * len(cols)) + " |"
            md_lines.append(header)
            md_lines.append(sep)
            for row in rows[:15]:
                row_str = "| " + " | ".join([str(row.get(c, "")) for c in cols]) + " |"
                md_lines.append(row_str)
            md_lines.append("")

        md_lines.append("---\n*Automated report compiled by AI Data Analyst Agent.*")
        return "\n".join(md_lines)

    @staticmethod
    def generate_pdf(
        query: str,
        dataset_name: str,
        insights: str,
        validated_sql: str = "",
        query_result: Dict[str, Any] = None,
        anomalies: List[Dict[str, Any]] = None,
        confidence_score: float = 0.0,
        reviewer_approved: bool = True
    ) -> bytes:
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        
        # Custom palette & typography styles
        primary_color = colors.HexColor("#1e1b4b") # deep indigo
        accent_color = colors.HexColor("#4f46e5")  # indigo 600
        slate_color = colors.HexColor("#475569")   # slate 600
        border_color = colors.HexColor("#e2e8f0")

        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=22,
            leading=26,
            textColor=primary_color,
            spaceAfter=6
        )

        meta_style = ParagraphStyle(
            'ReportMeta',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=9,
            leading=12,
            textColor=slate_color,
            spaceAfter=14
        )

        h2_style = ParagraphStyle(
            'Heading2',
            parent=styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=16,
            textColor=accent_color,
            spaceBefore=12,
            spaceAfter=6
        )

        body_style = ParagraphStyle(
            'Body',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=10,
            leading=14,
            textColor=colors.HexColor("#1e293b"),
            spaceAfter=8
        )

        code_style = ParagraphStyle(
            'Code',
            parent=styles['Normal'],
            fontName='Courier',
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#0f172a"),
            backColor=colors.HexColor("#f1f5f9"),
            borderPadding=6,
            spaceAfter=8
        )

        story = []

        # 1. Header & Title
        story.append(Paragraph("AI Data Analyst • Executive Report", title_style))
        timestamp = datetime.now().strftime("%B %d, %Y - %H:%M:%S")
        status_badge = "Verified by Critic" if reviewer_approved else "Review Needed"
        meta_text = f"<b>Generated:</b> {timestamp} &nbsp;|&nbsp; <b>Dataset:</b> {dataset_name} &nbsp;|&nbsp; <b>Status:</b> {status_badge} ({int(confidence_score * 100)}% Confidence)"
        story.append(Paragraph(meta_text, meta_style))
        story.append(HRFlowable(width="100%", thickness=1, color=border_color, spaceBefore=0, spaceAfter=12))

        # 2. Query Section
        story.append(Paragraph("Business Objective", h2_style))
        story.append(Paragraph(f"<i>\"{query}\"</i>", body_style))
        story.append(Spacer(1, 6))

        # 3. Insights
        story.append(Paragraph("Executive Insights & Findings", h2_style))
        # Clean insights formatting for PDF
        clean_insights = insights.replace("\n\n", "<br/><br/>").replace("\n", "<br/>")
        story.append(Paragraph(clean_insights, body_style))
        story.append(Spacer(1, 6))

        # 4. Synthesized SQL
        if validated_sql:
            story.append(Paragraph("Validated SQL Query", h2_style))
            escaped_sql = validated_sql.replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
            story.append(Paragraph(escaped_sql, code_style))
            story.append(Spacer(1, 6))

        # 5. Anomalies
        if anomalies and len(anomalies) > 0:
            story.append(Paragraph("Identified Statistical Outliers", h2_style))
            for an in anomalies:
                an_text = f"• <b>Column {an.get('column')}:</b> {an.get('value')} ({an.get('reason', 'Outlier')})"
                story.append(Paragraph(an_text, body_style))
            story.append(Spacer(1, 6))

        # 6. Data Extract Table
        if query_result and query_result.get("rows"):
            story.append(Paragraph("Query Execution Data Sample", h2_style))
            cols = query_result.get("columns", [])[:6] # Top 6 columns for width
            rows = query_result.get("rows", [])[:10]

            table_data = [[Paragraph(f"<b>{c}</b>", body_style) for c in cols]]
            for r in rows:
                table_data.append([Paragraph(str(r.get(c, "-")), body_style) for c in cols])

            col_width = (doc.width) / len(cols) if cols else 100
            t = Table(table_data, colWidths=[col_width] * len(cols))
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f8fafc")),
                ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#334155")),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('GRID', (0,0), (-1,-1), 0.5, border_color),
            ]))
            story.append(t)

        doc.build(story)
        pdf_data = buffer.getvalue()
        buffer.close()
        return pdf_data
