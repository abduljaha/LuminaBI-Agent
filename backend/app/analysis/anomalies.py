import pandas as pd
import numpy as np

class AnomalyDetector:
    @staticmethod
    def detect_anomalies(df: pd.DataFrame, threshold: float = 3.0) -> list:
        """
        Detects statistical anomalies in numerical columns using Z-score.
        """
        anomalies = []
        
        # Select only numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            series = df[col].dropna()
            if len(series) < 5:  # Not enough data for statistical significance
                continue
                
            mean = series.mean()
            std = series.std()
            
            if std == 0:
                continue
                
            z_scores = (series - mean) / std
            outliers = df.loc[z_scores.abs() > threshold]
            
            if not outliers.empty:
                for idx, row in outliers.iterrows():
                    anomalies.append({
                        "column": col,
                        "value": float(row[col]),
                        "z_score": round(float(z_scores.loc[idx]), 2),
                        "severity": "high" if abs(z_scores.loc[idx]) > 4 else "medium",
                        "row_index": int(idx)
                    })
                    
        return anomalies
