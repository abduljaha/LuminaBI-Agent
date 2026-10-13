import os
import re
import json
import csv
import io
import pandas as pd
import numpy as np
import xml.etree.ElementTree as ET
from typing import Tuple, Dict, Any, Optional

class UniversalDataLoader:
    """
    Universal Ingestion Engine that parses and converts any file format
    (CSV, TSV, Excel, JSON, JSONL, Parquet, XML, HTML, and semi-structured Text)
    into a structured pandas DataFrame.
    Features robust error recovery and automatic fallback mechanisms.
    """

    SUPPORTED_EXTENSIONS = [
        "csv", "tsv", "tab", "txt", "dat", "log",
        "xlsx", "xls", "xlsm", "xlsb",
        "json", "jsonl", "ndjson",
        "parquet", "pq",
        "xml", "html", "htm"
    ]

    _df_cache: Dict[str, Tuple[float, pd.DataFrame, str]] = {}

    @classmethod
    def clear_cache(cls, file_path: Optional[str] = None):
        """Clears cached DataFrame in memory for a specific file or all files."""
        if file_path:
            abs_p = os.path.abspath(file_path)
            cls._df_cache.pop(abs_p, None)
        else:
            cls._df_cache.clear()

    @classmethod
    def load(cls, file_path: str, original_filename: Optional[str] = None) -> Tuple[pd.DataFrame, str]:
        """
        Loads data from file_path regardless of format with in-memory caching.
        Prioritizes the actual file extension on disk, falling back gracefully across parsers.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        # Check in-memory cache
        abs_path = os.path.abspath(file_path)
        mtime = os.path.getmtime(file_path)
        if abs_path in cls._df_cache:
            cached_mtime, cached_df, cached_fmt = cls._df_cache[abs_path]
            if cached_mtime == mtime:
                return cached_df.copy(), cached_fmt

        def _cache_and_return(loaded_df: pd.DataFrame, loaded_fmt: str) -> Tuple[pd.DataFrame, str]:
            cls._df_cache[abs_path] = (mtime, loaded_df, loaded_fmt)
            return loaded_df.copy(), loaded_fmt

        # Check disk extension first, then original filename
        disk_ext = file_path.lower().split('.')[-1] if '.' in file_path else ''
        orig_ext = original_filename.lower().split('.')[-1] if (original_filename and '.' in original_filename) else ''
        
        # Priority order of formats to attempt
        ext_to_check = disk_ext if disk_ext in cls.SUPPORTED_EXTENSIONS else orig_ext

        # 1. If disk file is explicitly CSV or TSV, read as CSV first
        if disk_ext in ['csv', 'tsv', 'tab', 'txt']:
            try:
                df = cls._try_read_delimited(file_path)
                if df is not None and len(df.columns) >= 1:
                    return _cache_and_return(cls._post_process(df), "csv" if disk_ext == 'csv' else "delimited")
            except Exception:
                pass

        # 2. Try Excel files if extension suggests Excel
        if ext_to_check in ['xlsx', 'xls', 'xlsm', 'xlsb']:
            try:
                df = pd.read_excel(file_path)
                return _cache_and_return(cls._post_process(df), "excel")
            except Exception:
                try:
                    df = pd.read_excel(file_path, engine='openpyxl')
                    return _cache_and_return(cls._post_process(df), "excel")
                except Exception:
                    # Fallback to delimited CSV if Excel parsing fails (e.g., CSV saved with .xlsx extension)
                    pass

        # 3. Try Parquet
        if ext_to_check in ['parquet', 'pq']:
            try:
                df = pd.read_parquet(file_path)
                return _cache_and_return(cls._post_process(df), "parquet")
            except Exception:
                pass

        # 4. Try JSON Lines
        if ext_to_check in ['jsonl', 'ndjson']:
            try:
                df = pd.read_json(file_path, lines=True)
                return _cache_and_return(cls._post_process(df), "jsonl")
            except Exception:
                rows = []
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        for line in f:
                            l = line.strip()
                            if l:
                                try:
                                    rows.append(json.loads(l))
                                except Exception:
                                    pass
                    if rows:
                        df = pd.json_normalize(rows)
                        return _cache_and_return(cls._post_process(df), "jsonl")
                except Exception:
                    pass

        # 5. Try standard JSON
        if ext_to_check == 'json':
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    raw_data = json.load(f)

                if isinstance(raw_data, list):
                    df = pd.json_normalize(raw_data)
                elif isinstance(raw_data, dict):
                    found_records = False
                    for key in ['data', 'items', 'records', 'results', 'rows', 'payload']:
                        if key in raw_data and isinstance(raw_data[key], list) and len(raw_data[key]) > 0:
                            df = pd.json_normalize(raw_data[key])
                            found_records = True
                            break
                    if not found_records:
                        try:
                            df = pd.DataFrame(raw_data)
                        except Exception:
                            df = pd.json_normalize([raw_data])
                else:
                    df = pd.DataFrame([{"value": raw_data}])
                return _cache_and_return(cls._post_process(df), "json")
            except Exception:
                pass

        # 6. Try XML
        if ext_to_check == 'xml':
            try:
                tree = ET.parse(file_path)
                root = tree.getroot()
                records = []
                children = list(root)
                if children:
                    for child in children:
                        row = dict(child.attrib)
                        for sub in child:
                            text_val = (sub.text or "").strip()
                            row[sub.tag] = text_val
                        if not row and child.text and child.text.strip():
                            row[child.tag] = child.text.strip()
                        if row:
                            records.append(row)
                else:
                    records.append(dict(root.attrib))

                if records:
                    df = pd.DataFrame(records)
                    return _cache_and_return(cls._post_process(df), "xml")
            except Exception:
                pass

        # 7. Try HTML tables
        if ext_to_check in ['html', 'htm']:
            try:
                tables = pd.read_html(file_path)
                if tables:
                    df = max(tables, key=lambda t: len(t))
                    return _cache_and_return(cls._post_process(df), "html")
            except Exception:
                pass

        # 8. Multi-format Universal Fallback: Delimited Text Parser
        df = cls._try_read_delimited(file_path)
        if df is not None and len(df.columns) >= 1:
            return _cache_and_return(cls._post_process(df), "csv")

        # 9. Fallback: try Excel if not already tried
        if ext_to_check not in ['xlsx', 'xls', 'xlsm', 'xlsb']:
            try:
                df = pd.read_excel(file_path)
                return _cache_and_return(cls._post_process(df), "excel")
            except Exception:
                pass

        # 10. Unstructured Key-Value / Log Lines Fallback
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                lines = [line.strip() for line in f.readlines() if line.strip()]

            if lines:
                kv_records = []
                for line in lines:
                    pairs = re.findall(r'(\w+)[:=]([^\s,;]+|"[^"]*")', line)
                    if pairs:
                        kv_records.append({k: v.strip('"') for k, v in pairs})

                if len(kv_records) >= max(1, len(lines) // 2):
                    df = pd.DataFrame(kv_records)
                    return _cache_and_return(cls._post_process(df), "unstructured_kv")

                df = pd.DataFrame({"line_number": range(1, len(lines) + 1), "raw_text": lines})
                return _cache_and_return(cls._post_process(df), "unstructured_text")
        except Exception as e:
            raise ValueError(f"Could not parse file content: {str(e)}")


        raise ValueError("Unsupported or corrupted file format. Unable to parse into a data table.")

    @classmethod
    def _try_read_delimited(cls, file_path: str) -> Optional[pd.DataFrame]:
        """Attempts reading delimited text using multiple encodings and separators."""
        encodings = ['utf-8', 'utf-8-sig', 'latin1', 'cp1252', 'iso-8859-1']
        delimiters = [None, ',', '\t', ';', '|']

        sample_bytes = None
        try:
            with open(file_path, 'rb') as f:
                sample_bytes = f.read(65536)
        except Exception:
            return None

        best_encoding = 'utf-8'
        for enc in encodings:
            try:
                sample_bytes.decode(enc)
                best_encoding = enc
                break
            except UnicodeDecodeError:
                continue

        for sep in delimiters:
            for enc in [best_encoding, 'utf-8', 'latin1']:
                try:
                    kwargs = {
                        'filepath_or_buffer': file_path,
                        'encoding': enc,
                        'on_bad_lines': 'skip'
                    }
                    if sep is None:
                        kwargs['sep'] = None
                        kwargs['engine'] = 'python'
                    else:
                        kwargs['sep'] = sep

                    df = pd.read_csv(**kwargs)
                    if df is not None and len(df.columns) >= 1:
                        return df
                except Exception:
                    continue
        return None

    @classmethod
    def _post_process(cls, df: pd.DataFrame) -> pd.DataFrame:
        """Sanitizes columns and drops completely empty artifacts."""
        if df.empty:
            return df
        
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = ['_'.join(str(c) for c in col).strip() for col in df.columns]
        else:
            df.columns = [str(c).strip() for c in df.columns]

        clean_cols = []
        for idx, col in enumerate(df.columns):
            if not col or col.startswith('Unnamed:'):
                clean_cols.append(f"column_{idx+1}")
            else:
                clean_cols.append(col)
        df.columns = clean_cols

        return df
