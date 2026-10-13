import re
import json
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Tuple, Optional

class DataCleaner:
    """
    Intelligent Data Quality Auditor, Exploratory Data Analysis (EDA) engine,
    and Automated Data Cleaning Pipeline.
    Directly addresses:
    - 01 Missing Values (Infer, Ignore, Delete)
    - 02 Duplicate Records (De-duplicate)
    - 03 Incorrect Data Types (Currency, Percent, Commas, Dates, Booleans)
    - 04 Outliers (IQR / Z-score: Delete, Flag, Cap)
    - 05 Inconsistent Formats (Whitespace, Casing, Formatting artifacts)
    - 06 Irrelevant Data (Constant columns, completely empty rows/cols)
    """

    NULL_SENTINELS = {
        "", " ", "na", "n/a", "null", "none", "nan", "nil", "unknown",
        "?", "-", "--", "---", "#n/a", "n.a.", "not available", "missing"
    }

    CURRENCY_SYMBOLS = {'$', '€', '£', '¥', '\u20b9'}

    @classmethod
    def audit_dataset(cls, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Deep exploratory data analysis & data anomaly audit.
        Evaluates the 6 Core Anomalies and generates a quality hygiene score.
        """
        total_rows = len(df)
        total_cols = len(df.columns)

        if total_rows == 0 or total_cols == 0:
            return {
                "is_clean": False,
                "quality_score": 0,
                "status": "EMPTY",
                "summary": "Dataset contains no usable rows or columns.",
                "total_rows": total_rows,
                "total_columns": total_cols,
                "anomalies": {
                    "missing_values": {
                        "total_missing_cells": 0,
                        "missing_percentage": 100.0,
                        "columns_with_missing": {},
                        "empty_rows": 0,
                        "empty_columns": []
                    },
                    "duplicate_records": {
                        "duplicate_rows": 0,
                        "duplicate_percentage": 0.0
                    },
                    "incorrect_data_types": [],
                    "outliers": [],
                    "inconsistent_formats": {
                        "whitespace_issues_count": 0,
                        "whitespace_columns": [],
                        "casing_inconsistencies": []
                    },
                    "irrelevant_data": {
                        "constant_columns": [],
                        "empty_columns": []
                    }
                },
                "eda_profile": {
                    "numeric_metrics": {},
                    "categorical_metrics": {}
                },
                "recommendations": ["Upload a dataset containing valid rows and columns."]
            }

        # 1. Missing Values Analysis
        total_cells = total_rows * total_cols
        missing_by_col = {}
        empty_cols = []
        total_missing_cells = 0

        for col in df.columns:
            series = df[col]
            # Detect both pandas nulls and string sentinel nulls
            is_pd_null = series.isnull()
            if not pd.api.types.is_numeric_dtype(series):
                is_sentinel = series.astype(str).str.strip().str.lower().isin(cls.NULL_SENTINELS)
                combined_null = is_pd_null | is_sentinel
            else:
                combined_null = is_pd_null

            null_count = int(combined_null.sum())
            if null_count > 0:
                pct = round((null_count / total_rows) * 100, 2)
                missing_by_col[str(col)] = {
                    "count": null_count,
                    "percentage": pct,
                    "action_needed": "Delete column" if pct > 80 else ("Infer (Median/Mode)" if pct < 50 else "Infer or Delete rows")
                }
                total_missing_cells += null_count
                if null_count == total_rows:
                    empty_cols.append(str(col))

        overall_missing_pct = round((total_missing_cells / total_cells) * 100, 2) if total_cells > 0 else 0
        empty_rows = int(df.isnull().all(axis=1).sum())

        # 2. Duplicate Records Analysis
        duplicate_rows_count = int(df.duplicated().sum())
        duplicate_pct = round((duplicate_rows_count / total_rows) * 100, 2) if total_rows > 0 else 0

        # 3. Incorrect Data Types Detection
        type_mismatches = []
        for col in df.columns:
            series = df[col]
            if not pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_datetime64_any_dtype(series) and not pd.api.types.is_bool_dtype(series):
                # Filter out nulls and sentinels to analyze real values
                str_vals = series.dropna().astype(str).str.strip()
                non_null_vals = [v for v in str_vals if v.lower() not in cls.NULL_SENTINELS]
                if not non_null_vals:
                    continue

                sample = non_null_vals[:50]

                # A. Currency check ($1,200.50, €500, etc.)
                curr_matches = sum(1 for v in sample if any(c in v for c in cls.CURRENCY_SYMBOLS) and any(c.isdigit() for c in v))
                # B. Percentage check (25%, 0.5%, etc.)
                pct_matches = sum(1 for v in sample if '%' in v and any(c.isdigit() for c in v))
                # C. Thousand-separator comma check (1,000, 1,200.50, etc.)
                def is_comma_num(v: str) -> bool:
                    if ',' in v:
                        clean = v.replace(',', '').strip()
                        for sym in cls.CURRENCY_SYMBOLS:
                            clean = clean.replace(sym, '')
                        try:
                            float(clean)
                            return True
                        except ValueError:
                            pass
                    return False

                comma_matches = sum(1 for v in sample if is_comma_num(v))

                if (curr_matches / len(sample)) >= 0.5:
                    type_mismatches.append({
                        "column": str(col),
                        "current_type": "string / text",
                        "detected_actual_type": "Currency (Numeric)",
                        "issue": "Numbers stored with currency symbols ($/€/£). Math aggregations fail until cleaned.",
                        "sample": sample[:3]
                    })
                elif (pct_matches / len(sample)) >= 0.5:
                    type_mismatches.append({
                        "column": str(col),
                        "current_type": "string / text",
                        "detected_actual_type": "Percentage (Numeric)",
                        "issue": "Percentages stored as string literals with '%' symbol.",
                        "sample": sample[:3]
                    })
                elif (comma_matches / len(sample)) >= 0.5:
                    type_mismatches.append({
                        "column": str(col),
                        "current_type": "string / text",
                        "detected_actual_type": "Numeric (Comma-separated)",
                        "issue": "Numbers with comma separators stored as text strings.",
                        "sample": sample[:3]
                    })

                # D. Dates stored as string
                date_matches = 0
                for v in sample:
                    if re.match(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}", v) or re.match(r"^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", v) or re.match(r"^[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}", v):
                        date_matches += 1
                if (date_matches / len(sample)) >= 0.6:
                    type_mismatches.append({
                        "column": str(col),
                        "current_type": "string / text",
                        "detected_actual_type": "Date / Timestamp",
                        "issue": "Dates stored as unparsed text strings. Temporal filtering and trends require date parsing.",
                        "sample": sample[:3]
                    })

                # E. Booleans stored as strings
                bool_vals = {"true", "false", "yes", "no", "y", "n", "t", "f"}
                bool_matches = sum(1 for v in sample if v.lower() in bool_vals)
                if (bool_matches / len(sample)) >= 0.8:
                    type_mismatches.append({
                        "column": str(col),
                        "current_type": "string / text",
                        "detected_actual_type": "Boolean (True/False)",
                        "issue": "Boolean flags stored as text.",
                        "sample": sample[:3]
                    })

        # 4. Outliers Detection (IQR Method)
        outliers_detected = []
        numeric_summary = {}

        for col in df.columns:
            if pd.api.types.is_numeric_dtype(df[col]) and not pd.api.types.is_bool_dtype(df[col]):
                num_series = df[col].dropna()
                if len(num_series) >= 5:
                    q1 = float(num_series.quantile(0.25))
                    q3 = float(num_series.quantile(0.75))
                    iqr = q3 - q1
                    lower_bound = q1 - 1.5 * iqr
                    upper_bound = q3 + 1.5 * iqr

                    outlier_mask = (num_series < lower_bound) | (num_series > upper_bound)
                    outlier_count = int(outlier_mask.sum())
                    if outlier_count > 0:
                        outlier_samples = num_series[outlier_mask].head(3).tolist()
                        outliers_detected.append({
                            "column": str(col),
                            "outlier_count": outlier_count,
                            "percentage": round((outlier_count / len(num_series)) * 100, 2),
                            "lower_bound": round(lower_bound, 2),
                            "upper_bound": round(upper_bound, 2),
                            "sample_values": [round(float(v), 2) for v in outlier_samples],
                            "recommendation": "Cap (Winsorize) or Flag"
                        })

                    numeric_summary[str(col)] = {
                        "min": round(float(num_series.min()), 2),
                        "max": round(float(num_series.max()), 2),
                        "mean": round(float(num_series.mean()), 2),
                        "median": round(float(num_series.median()), 2),
                        "std": round(float(num_series.std()), 2) if len(num_series) > 1 else 0,
                        "outlier_count": outlier_count
                    }

        # 5. Inconsistent Formats & Whitespace
        whitespace_issues = 0
        whitespace_cols = []
        casing_issues = []

        for col in df.columns:
            if not pd.api.types.is_numeric_dtype(df[col]):
                clean_str = df[col].dropna().astype(str)
                # Whitespace checks
                has_spaces = (clean_str != clean_str.str.strip()).sum()
                if has_spaces > 0:
                    whitespace_issues += int(has_spaces)
                    whitespace_cols.append(str(col))

                # Capitalization inconsistency check (e.g., 'Male', 'male', 'MALE' in same column)
                non_sentinels = [v for v in clean_str.str.strip() if v.lower() not in cls.NULL_SENTINELS]
                unique_orig = set(non_sentinels)
                unique_lower = {v.lower() for v in unique_orig}
                if len(unique_orig) > len(unique_lower):
                    diff_count = len(unique_orig) - len(unique_lower)
                    casing_issues.append({
                        "column": str(col),
                        "variations_count": diff_count,
                        "example": list(unique_orig)[:4]
                    })

        # 6. Irrelevant Data / Constant Columns
        constant_cols = []
        for col in df.columns:
            if df[col].nunique(dropna=False) <= 1:
                constant_cols.append(str(col))

        # Categorical Summary for EDA
        categorical_summary = {}
        for col in df.columns:
            if not pd.api.types.is_numeric_dtype(df[col]):
                series = df[col].dropna()
                val_counts = series.value_counts().head(5).to_dict()
                categorical_summary[str(col)] = {
                    "unique_values": int(series.nunique()),
                    "top_values": [{ "label": str(k), "count": int(v) } for k, v in val_counts.items()]
                }

        # Quality Hygiene Scoring (0 - 100)
        penalty = 0.0
        # Duplicate penalty (up to 25 pts)
        penalty += min(25.0, (duplicate_rows_count / total_rows) * 100 * 2.0)
        # Missing values penalty (up to 30 pts)
        penalty += min(30.0, overall_missing_pct * 2.0)
        # Type mismatch penalty (up to 25 pts)
        penalty += min(25.0, len(type_mismatches) * 10.0)
        # Whitespace & casing penalty (up to 15 pts)
        penalty += min(15.0, (len(whitespace_cols) + len(casing_issues)) * 5.0)
        # Outlier penalty (up to 10 pts)
        if len(outliers_detected) > 0:
            penalty += min(10.0, len(outliers_detected) * 4.0)

        quality_score = max(10, min(100, round(100.0 - penalty)))

        # Cleanliness threshold: Clean if score >= 90 and zero severe anomalies
        is_clean = (quality_score >= 90) and (duplicate_rows_count == 0) and (overall_missing_pct < 2.0) and (len(type_mismatches) == 0)

        # Actionable recommendations matching techniques from Image 1 & Image 3
        recommendations: List[str] = []
        if duplicate_rows_count > 0:
            recommendations.append(f"01 Remove {duplicate_rows_count} duplicate record(s) (De-duplication).")
        if outliers_detected:
            recommendations.append(f"02 Cap or flag {len(outliers_detected)} column(s) with statistical outliers (IQR).")
        if constant_cols or empty_cols:
            recommendations.append(f"03 Remove {len(constant_cols) + len(empty_cols)} irrelevant or empty column(s).")
        if casing_issues or whitespace_cols:
            recommendations.append("04 Standardize text capitalization and trim whitespace inconsistencies.")
        if type_mismatches:
            recommendations.append(f"05 Convert {len(type_mismatches)} column(s) to proper data types (currency/dates/numeric).")
        if missing_by_col:
            recommendations.append(f"09 Handle missing values across {len(missing_by_col)} column(s) (Infer median/mode).")

        if not recommendations:
            recommendations.append("Dataset is clean, consistent, and ready for deep AI analytical queries.")

        summary_text = (
            f"Dataset has a Quality Hygiene Score of {quality_score}/100. "
            f"Status: {'CLEAN & READY FOR ANALYSIS' if is_clean else 'RAW / UNPROCESSED (Requires Cleaning)'}. "
            f"Found {duplicate_rows_count} duplicate(s), {overall_missing_pct}% missing cells, "
            f"{len(type_mismatches)} type misalignment(s), and {len(outliers_detected)} outlier column(s)."
        )

        return {
            "is_clean": is_clean,
            "quality_score": quality_score,
            "status": "CLEAN" if is_clean else "UNPROCESSED_RAW",
            "summary": summary_text,
            "total_rows": total_rows,
            "total_columns": total_cols,
            "anomalies": {
                "missing_values": {
                    "total_missing_cells": total_missing_cells,
                    "missing_percentage": overall_missing_pct,
                    "columns_with_missing": missing_by_col,
                    "empty_rows": empty_rows,
                    "empty_columns": empty_cols
                },
                "duplicate_records": {
                    "duplicate_rows": duplicate_rows_count,
                    "duplicate_percentage": duplicate_pct
                },
                "incorrect_data_types": type_mismatches,
                "outliers": outliers_detected,
                "inconsistent_formats": {
                    "whitespace_issues_count": whitespace_issues,
                    "whitespace_columns": whitespace_cols,
                    "casing_inconsistencies": casing_issues
                },
                "irrelevant_data": {
                    "constant_columns": constant_cols,
                    "empty_columns": empty_cols
                }
            },
            "eda_profile": {
                "numeric_metrics": numeric_summary,
                "categorical_metrics": categorical_summary
            },
            "recommendations": recommendations
        }

    @classmethod
    def clean_dataset(
        cls,
        df: pd.DataFrame,
        options: Optional[Dict[str, Any]] = None
    ) -> Tuple[pd.DataFrame, List[str], Dict[str, Any]]:
        """
        Executes automated, multi-stage data cleaning based on Image 1 & Image 3:
        01 Remove duplicates
        02 Detect & handle outliers (Cap / Flag / Delete)
        03 Remove irrelevant data (empty rows/cols, constant columns)
        04 Standardize capitalization & whitespace
        05 Convert data types (clean currency, %, numeric strings, dates, booleans)
        06 Clear formatting artifacts & sentinels
        07 Fix typographical errors & casing variations
        09 Handle missing values (Infer median/mode, Delete, or Ignore)

        Returns:
            cleaned_df: pd.DataFrame
            changelog: list of descriptive action strings
            after_audit: audit dictionary reflecting cleaned state
        """
        opts = options or {}
        handle_duplicates = opts.get("handle_duplicates", True)
        handle_missing = opts.get("handle_missing", "infer") # "infer", "delete", "ignore"
        handle_outliers = opts.get("handle_outliers", "cap") # "cap", "delete", "flag", "ignore"
        fix_types = opts.get("fix_data_types", True)
        normalize_dates = opts.get("normalize_dates", True)
        standardize_text = opts.get("standardize_text", True)
        remove_irrelevant = opts.get("remove_irrelevant", True)
        standardize_names = opts.get("standardize_names", True)

        cleaned_df = df.copy()
        changelog: List[str] = []

        # 00. Standardize Column Names
        if standardize_names:
            old_cols = list(cleaned_df.columns)
            new_cols = []
            for idx, c in enumerate(old_cols):
                name = str(c).strip()
                name = re.sub(r"[^\w\s]", "", name)
                name = re.sub(r"\s+", "_", name).lower()
                name = re.sub(r"_+", "_", name).strip("_")
                new_cols.append(name if name else f"col_{idx+1}")
            
            # Ensure unique column names (deduplicate duplicate headers)
            col_counts = {}
            unique_cols = []
            for c in new_cols:
                if c in col_counts:
                    col_counts[c] += 1
                    unique_cols.append(f"{c}_{col_counts[c]}")
                else:
                    col_counts[c] = 0
                    unique_cols.append(c)

            if unique_cols != old_cols:
                cleaned_df.columns = unique_cols
                changelog.append(f"Standardized {len(unique_cols)} column names to snake_case format.")

        # 01. Remove Duplicates
        if handle_duplicates and len(cleaned_df) > 1:
            before_rows = len(cleaned_df)
            deduped = cleaned_df.drop_duplicates()
            # If all rows were duplicates, preserve at least 1 row to prevent empty table
            if len(deduped) > 0:
                dropped_dups = before_rows - len(deduped)
                cleaned_df = deduped
                if dropped_dups > 0:
                    changelog.append(f"01 Remove duplicates: Eliminated {dropped_dups} duplicate record(s).")
            else:
                cleaned_df = cleaned_df.head(1)

        # 03. Remove Irrelevant Data (Completely empty rows & columns, single-value constant columns)
        if remove_irrelevant:
            # Drop empty columns ONLY if at least 1 column remains
            all_null_cols = [c for c in cleaned_df.columns if cleaned_df[c].isnull().all()]
            if all_null_cols:
                if len(all_null_cols) < len(cleaned_df.columns):
                    cleaned_df = cleaned_df.drop(columns=all_null_cols)
                    changelog.append(f"03 Remove irrelevant data: Dropped {len(all_null_cols)} completely empty column(s) ({', '.join(all_null_cols[:4])}{'...' if len(all_null_cols) > 4 else ''}).")
                else:
                    changelog.append(f"03 Preserved {len(all_null_cols)} column(s) to retain schema structure.")

            # Drop empty rows ONLY if at least 1 row remains
            before_empty_rows = len(cleaned_df)
            non_empty_rows = cleaned_df.dropna(how='all')
            if len(non_empty_rows) > 0:
                cleaned_df = non_empty_rows
                dropped_empty = before_empty_rows - len(cleaned_df)
                if dropped_empty > 0:
                    changelog.append(f"03 Remove irrelevant data: Dropped {dropped_empty} completely blank row(s).")
            else:
                changelog.append("03 Retained structure for empty rows; values will be populated during imputation.")

            # Drop zero-variance constant columns ONLY if at least 1 column remains
            const_cols = [c for c in cleaned_df.columns if cleaned_df[c].nunique(dropna=False) <= 1]
            if const_cols and len(const_cols) < len(cleaned_df.columns):
                cleaned_df = cleaned_df.drop(columns=const_cols)
                changelog.append(f"03 Remove irrelevant data: Removed {len(const_cols)} constant single-value column(s) ({', '.join(const_cols[:4])}{'...' if len(const_cols) > 4 else ''}).")

        # 06. Clear Formatting & Sentinels (Convert 'N/A', '?', '-' to actual NaN)
        for col in cleaned_df.columns:
            if not pd.api.types.is_numeric_dtype(cleaned_df[col]):
                # Replace sentinels with NaN
                cleaned_df[col] = cleaned_df[col].apply(
                    lambda v: np.nan if pd.isna(v) or (isinstance(v, str) and v.strip().lower() in cls.NULL_SENTINELS) else v
                )

        # 04. Standardize Capitalization, Whitespace & Text
        if standardize_text:
            text_cleaned = 0
            for col in cleaned_df.columns:
                if not pd.api.types.is_numeric_dtype(cleaned_df[col]):
                    # Trim spaces
                    cleaned_df[col] = cleaned_df[col].apply(
                        lambda v: v.strip() if isinstance(v, str) else v
                    )
                    text_cleaned += 1
            if text_cleaned > 0:
                changelog.append(f"04 Clear formatting & whitespace: Trimmed leading/trailing spaces across {text_cleaned} text column(s).")

        # 05. Convert Data Types (Currency, Percentages, Numbers with commas, Dates, Booleans)
        if fix_types:
            type_conversions = 0
            for col in list(cleaned_df.columns):
                if not pd.api.types.is_numeric_dtype(cleaned_df[col]):
                    non_nulls = cleaned_df[col].dropna()
                    if len(non_nulls) == 0:
                        continue

                    sample = [str(v).strip() for v in non_nulls.head(50) if str(v).strip().lower() not in cls.NULL_SENTINELS]
                    if not sample:
                        continue

                    # Currency check
                    curr_matches = sum(1 for v in sample if any(c in v for c in cls.CURRENCY_SYMBOLS) and any(c.isdigit() for c in v))
                    # Percent check
                    pct_matches = sum(1 for v in sample if '%' in v and any(c.isdigit() for c in v))
                    # Comma number check
                    def clean_comma_num(v: str) -> Optional[float]:
                        clean = v.replace(',', '').strip()
                        for s in cls.CURRENCY_SYMBOLS:
                            clean = clean.replace(s, '')
                        clean = clean.replace('%', '')
                        try:
                            return float(clean)
                        except ValueError:
                            return None

                    if (curr_matches / len(sample)) >= 0.5:
                        def parse_curr(v):
                            if pd.isna(v): return np.nan
                            res = clean_comma_num(str(v))
                            return res if res is not None else np.nan
                        cleaned_df[col] = cleaned_df[col].apply(parse_curr)
                        changelog.append(f"05 Convert data type: Stripped currency symbols in '{col}' and converted to Float numeric.")
                        type_conversions += 1

                    elif (pct_matches / len(sample)) >= 0.5:
                        def parse_pct(v):
                            if pd.isna(v): return np.nan
                            res = clean_comma_num(str(v))
                            return (res / 100.0) if res is not None else np.nan
                        cleaned_df[col] = cleaned_df[col].apply(parse_pct)
                        changelog.append(f"05 Convert data type: Parsed percentages in '{col}' and converted to decimal Float numeric.")
                        type_conversions += 1

                    elif sum(1 for v in sample if ',' in v and clean_comma_num(v) is not None) / len(sample) >= 0.5:
                        cleaned_df[col] = cleaned_df[col].apply(lambda v: clean_comma_num(str(v)) if pd.notna(v) else np.nan)
                        changelog.append(f"05 Convert data type: Converted comma-formatted numbers in '{col}' to numeric.")
                        type_conversions += 1

                    # Date detection & parsing
                    elif normalize_dates:
                        date_matches = sum(1 for v in sample if re.match(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}", v) or re.match(r"^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}", v))
                        if len(sample) > 0 and (date_matches / len(sample)) >= 0.6:
                            try:
                                cleaned_df[col] = pd.to_datetime(cleaned_df[col], errors='coerce')
                                changelog.append(f"05 Convert data type: Standardized date formats in '{col}' to ISO datetime.")
                                type_conversions += 1
                            except Exception:
                                pass

                    # Boolean detection
                    bool_map = {"true": True, "false": False, "yes": True, "no": False, "y": True, "n": False, "1": True, "0": False}
                    str_lower = [v.lower() for v in sample]
                    if len(str_lower) > 0 and (sum(1 for v in str_lower if v in bool_map) / len(str_lower)) >= 0.8:
                        cleaned_df[col] = cleaned_df[col].apply(lambda v: bool_map.get(str(v).strip().lower(), np.nan) if pd.notna(v) else np.nan)
                        changelog.append(f"05 Convert data type: Converted boolean flags in '{col}' to true/false booleans.")
                        type_conversions += 1

        # 07. Standardize Categorical Typographical Casing (e.g. 'Electronics' vs 'electronics')
        for col in cleaned_df.columns:
            if not pd.api.types.is_numeric_dtype(cleaned_df[col]):
                non_nulls = cleaned_df[col].dropna()
                if len(non_nulls) > 0:
                    cleaned_df[col] = cleaned_df[col].apply(
                        lambda x: x.strip().title() if pd.notna(x) and isinstance(x, str) and not ('@' in x or 'http' in x) else x
                    )

        # 09. Handle Missing Values (Infer, Delete, or Ignore)
        if handle_missing == "infer":
            imputed_cols = 0
            for col in cleaned_df.columns:
                null_count = int(cleaned_df[col].isnull().sum())
                if null_count > 0:
                    try:
                        if pd.api.types.is_numeric_dtype(cleaned_df[col]) and not pd.api.types.is_bool_dtype(cleaned_df[col]):
                            median_val = cleaned_df[col].median()
                            if pd.notna(median_val):
                                cleaned_df[col] = cleaned_df[col].fillna(round(float(median_val), 2))
                            else:
                                cleaned_df[col] = cleaned_df[col].fillna(0)
                            imputed_cols += 1
                        elif pd.api.types.is_bool_dtype(cleaned_df[col]):
                            mode_series = cleaned_df[col].mode()
                            fill_val = mode_series.iloc[0] if len(mode_series) > 0 else False
                            cleaned_df[col] = cleaned_df[col].fillna(fill_val)
                            imputed_cols += 1
                        elif pd.api.types.is_datetime64_any_dtype(cleaned_df[col]):
                            cleaned_df[col] = cleaned_df[col].ffill().bfill()
                            if cleaned_df[col].isnull().any():
                                cleaned_df[col] = cleaned_df[col].fillna(pd.Timestamp.now())
                            imputed_cols += 1
                        else:
                            mode_val = cleaned_df[col].mode()
                            fill_val = mode_val.iloc[0] if len(mode_val) > 0 and pd.notna(mode_val.iloc[0]) and str(mode_val.iloc[0]).strip() else "Unspecified"
                            cleaned_df[col] = cleaned_df[col].fillna(fill_val)
                            imputed_cols += 1
                    except Exception:
                        cleaned_df[col] = cleaned_df[col].fillna("Unspecified")
                        imputed_cols += 1
            if imputed_cols > 0:
                changelog.append(f"09 Handle missing values: Imputed missing values across {imputed_cols} column(s) using median (numerical) & mode (categorical).")

        elif handle_missing == "delete":
            before_drop = len(cleaned_df)
            non_null_df = cleaned_df.dropna()
            if len(non_null_df) > 0:
                cleaned_df = non_null_df
                dropped = before_drop - len(cleaned_df)
                if dropped > 0:
                    changelog.append(f"09 Handle missing values: Dropped {dropped} row(s) containing missing values.")
            else:
                # Fallback: if deleting all rows would wipe the dataset, impute instead
                for col in cleaned_df.columns:
                    if pd.api.types.is_numeric_dtype(cleaned_df[col]) and not pd.api.types.is_bool_dtype(cleaned_df[col]):
                        cleaned_df[col] = cleaned_df[col].fillna(0)
                    else:
                        cleaned_df[col] = cleaned_df[col].fillna("Unspecified")
                changelog.append("09 Handle missing values: Imputed values instead of deleting all rows to avoid empty dataset.")

        # 02. Handle Outliers (Delete, Cap/Winsorize, or Flag)
        if handle_outliers in ["cap", "delete", "flag"]:
            outlier_actions = 0
            for col in cleaned_df.columns:
                if pd.api.types.is_numeric_dtype(cleaned_df[col]) and not pd.api.types.is_bool_dtype(cleaned_df[col]):
                    num_series = cleaned_df[col].replace([np.inf, -np.inf], np.nan).dropna()
                    if len(num_series) >= 5:
                        try:
                            q1 = float(num_series.quantile(0.25))
                            q3 = float(num_series.quantile(0.75))
                            iqr = q3 - q1
                            lower = q1 - 1.5 * iqr
                            upper = q3 + 1.5 * iqr

                            outlier_mask = (cleaned_df[col] < lower) | (cleaned_df[col] > upper)
                            count = int(outlier_mask.sum())

                            if count > 0:
                                if handle_outliers == "cap":
                                    # Winsorize extreme values to bounds
                                    cleaned_df[col] = cleaned_df[col].clip(lower=round(lower, 2), upper=round(upper, 2))
                                    outlier_actions += 1
                                elif handle_outliers == "flag":
                                    # Add indicator column
                                    cleaned_df[f"is_outlier_{col}"] = outlier_mask
                                    outlier_actions += 1
                                elif handle_outliers == "delete":
                                    # Drop rows with extreme outliers only if table wouldn't become empty
                                    non_outliers = cleaned_df[~outlier_mask]
                                    if len(non_outliers) > 0:
                                        cleaned_df = non_outliers
                                        outlier_actions += 1
                        except Exception:
                            pass

            if outlier_actions > 0:
                if handle_outliers == "cap":
                    changelog.append(f"02 Handle outliers: Winsorized/capped extreme statistical outliers across {outlier_actions} numeric column(s) to IQR thresholds.")
                elif handle_outliers == "flag":
                    changelog.append(f"02 Handle outliers: Added outlier indicator flags across {outlier_actions} column(s).")
                elif handle_outliers == "delete":
                    changelog.append(f"02 Handle outliers: Removed extreme outlier rows across {outlier_actions} column(s).")

        # ABSOLUTE SAFETY GUARANTEE: Dataset must never be left empty or schema-less
        if len(cleaned_df.columns) == 0:
            cleaned_df = df.copy()
            if len(cleaned_df.columns) == 0:
                cleaned_df = pd.DataFrame({"col_1": ["Unspecified"]})
        if len(cleaned_df) == 0:
            default_row = {c: (0 if pd.api.types.is_numeric_dtype(cleaned_df[c]) else "Unspecified") for c in cleaned_df.columns}
            cleaned_df = pd.DataFrame([default_row])

        # Ensure no lingering NaNs remain after cleaning
        for col in cleaned_df.columns:
            if cleaned_df[col].isnull().any():
                if pd.api.types.is_numeric_dtype(cleaned_df[col]) and not pd.api.types.is_bool_dtype(cleaned_df[col]):
                    cleaned_df[col] = cleaned_df[col].fillna(0)
                else:
                    cleaned_df[col] = cleaned_df[col].fillna("Unspecified")

        if not changelog:
            changelog.append("Dataset passed all quality checks. No destructive transformations required.")

        # Re-audit the cleaned dataframe
        after_audit = cls.audit_dataset(cleaned_df)

        return cleaned_df, changelog, after_audit
