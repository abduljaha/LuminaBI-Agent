import re
import pandas as pd
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.dataset import Dataset
from app.data.universal_loader import UniversalDataLoader

class RelationshipDetector:
    COMMON_ID_PATTERNS = [
        r"^(id|_id)$",
        r".*_id$",
        r".*code$",
        r"^(key|_key)$",
        r"^(name|department|dept|category|region|country|state|city|date|timestamp)$"
    ]

    @staticmethod
    def _sanitize_table_name(name: str) -> str:
        clean = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower().split('.')[0])
        if clean and clean[0].isdigit():
            clean = f"t_{clean}"
        return clean or "tbl"

    @classmethod
    def detect_relationships(cls, datasets: List[Dataset]) -> Dict[str, Any]:
        """
        Scans schemas of all registered datasets to discover foreign key relationships,
        shared join keys, and table graph metadata.
        """
        tables = []
        table_dfs: Dict[int, pd.DataFrame] = {}
        
        # 1. Load schema metadata for each dataset
        for ds in datasets:
            t_name = cls._sanitize_table_name(ds.name)
            schema = ds.schema_info or {}
            columns = schema.get("columns", [])
            row_count = schema.get("row_count", 0)

            # Attempt to load small head sample to verify value overlaps
            df_sample = None
            if ds.file_path:
                try:
                    df, _ = UniversalDataLoader.load(ds.file_path, ds.name)
                    df_sample = df.head(500)
                    table_dfs[ds.id] = df_sample
                except Exception:
                    pass

            tables.append({
                "id": ds.id,
                "name": ds.name,
                "table_name": t_name,
                "row_count": row_count,
                "columns": columns, # [{"name": "col", "type": "int"}]
                "file_type": ds.file_type,
                "is_cleaned": ds.is_cleaned or False,
                "quality_score": ds.quality_score or 100
            })

        # 2. Cross-compare tables to discover join edges
        relationships = []
        for i in range(len(tables)):
            for j in range(i + 1, len(tables)):
                t1 = tables[i]
                t2 = tables[j]
                
                cols1 = {c.get("name", "").lower(): c for c in t1.get("columns", []) if isinstance(c, dict)}
                cols2 = {c.get("name", "").lower(): c for c in t2.get("columns", []) if isinstance(c, dict)}

                for col1_name, col1_info in cols1.items():
                    for col2_name, col2_info in cols2.items():
                        is_match = False
                        confidence = 0.0
                        reason = ""

                        # Exact name match (e.g., customer_id == customer_id)
                        if col1_name == col2_name and col1_name:
                            # Higher confidence if matches ID pattern
                            if any(re.match(pat, col1_name) for pat in cls.COMMON_ID_PATTERNS):
                                confidence = 0.95
                                reason = f"Exact matching key name: '{col1_name}'"
                            else:
                                confidence = 0.75
                                reason = f"Exact shared dimension column: '{col1_name}'"
                            is_match = True
                        
                        # Partial foreign key match (e.g. id == customer_id or user_id == id)
                        elif (col1_name == "id" and col2_name.endswith("_id")) or (col2_name == "id" and col1_name.endswith("_id")):
                            confidence = 0.85
                            reason = f"Primary/Foreign key pair: '{col1_name}' <-> '{col2_name}'"
                            is_match = True

                        if is_match:
                            # Verify value overlap if samples are available
                            overlap_pct = 0.0
                            df1 = table_dfs.get(t1["id"])
                            df2 = table_dfs.get(t2["id"])
                            if df1 is not None and df2 is not None:
                                actual_col1 = next((c.get("name") for c in t1.get("columns", []) if c.get("name", "").lower() == col1_name), None)
                                actual_col2 = next((c.get("name") for c in t2.get("columns", []) if c.get("name", "").lower() == col2_name), None)
                                if actual_col1 in df1.columns and actual_col2 in df2.columns:
                                    s1 = set(df1[actual_col1].dropna().astype(str).unique()[:100])
                                    s2 = set(df2[actual_col2].dropna().astype(str).unique()[:100])
                                    if s1 and s2:
                                        intersection = len(s1.intersection(s2))
                                        if intersection > 0:
                                            overlap_pct = round((intersection / min(len(s1), len(s2))) * 100, 1)
                                            confidence = min(0.99, confidence + (overlap_pct / 500))

                            relationships.append({
                                "source_table_id": t1["id"],
                                "source_table": t1["table_name"],
                                "source_column": col1_info.get("name"),
                                "target_table_id": t2["id"],
                                "target_table": t2["table_name"],
                                "target_column": col2_info.get("name"),
                                "cardinality": "N:1",
                                "confidence": round(confidence, 2),
                                "overlap_pct": overlap_pct,
                                "reason": reason
                            })

        # Sort relationships by confidence
        relationships.sort(key=lambda r: r["confidence"], reverse=True)

        return {
            "tables": tables,
            "relationships": relationships
        }
