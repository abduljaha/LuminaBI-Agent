import pandas as pd
import numpy as np

class DataProfiler:
    @staticmethod
    def profile_dataframe(df: pd.DataFrame) -> dict:
        """
        Generates a comprehensive profile of a pandas DataFrame.
        """
        profile = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": []
        }
        
        for col in df.columns:
            col_series = df[col]
            col_type = str(col_series.dtype)
            null_count = int(col_series.isnull().sum())
            null_percentage = float(null_count / len(df)) * 100 if len(df) > 0 else 0
            
            col_info = {
                "name": col,
                "type": col_type,
                "null_count": null_count,
                "null_percentage": round(null_percentage, 2),
                "unique_values": int(col_series.nunique())
            }
            
            # Numeric stats
            if pd.api.types.is_numeric_dtype(col_series):
                desc = col_series.describe()
                col_info.update({
                    "min": float(desc.get("min", 0)) if not pd.isna(desc.get("min")) else None,
                    "max": float(desc.get("max", 0)) if not pd.isna(desc.get("max")) else None,
                    "mean": float(desc.get("mean", 0)) if not pd.isna(desc.get("mean")) else None,
                    "median": float(col_series.median()) if not pd.isna(col_series.median()) else None,
                    "std_dev": float(desc.get("std", 0)) if not pd.isna(desc.get("std")) else None,
                })
            
            profile["columns"].append(col_info)
            
        return profile
