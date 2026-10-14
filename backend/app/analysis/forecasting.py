import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from app.services.llm_service import LLMProvider
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

class PredictiveForecaster:
    @staticmethod
    def forecast(
        df: pd.DataFrame,
        date_col: Optional[str] = None,
        metric_col: Optional[str] = None,
        horizon: int = 30
    ) -> Dict[str, Any]:
        """
        Executes sub-second statistical time-series forecasting with 80% & 95% confidence bands.
        Uses Holt's linear exponential smoothing with error variance expansion over future horizon.
        """
        # 1. Identify date/time column
        if not date_col or date_col not in df.columns:
            date_candidates = []
            for col in df.columns:
                col_lower = col.lower()
                if any(k in col_lower for k in ["date", "time", "day", "month", "year", "period", "timestamp"]):
                    date_candidates.append(col)
                elif pd.api.types.is_datetime64_any_dtype(df[col]):
                    date_candidates.append(col)
            
            # Test string columns for date parsing
            if not date_candidates:
                for col in df.select_dtypes(include=['object', 'string']).columns:
                    sample = df[col].dropna().head(10).astype(str)
                    try:
                        pd.to_datetime(sample)
                        date_candidates.append(col)
                        break
                    except Exception:
                        pass
            
            date_col = date_candidates[0] if date_candidates else None

        # 2. Identify numeric metric column
        if not metric_col or metric_col not in df.columns:
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            if not numeric_cols:
                raise ValueError("No numeric metric column found in dataset for time-series forecasting.")
            metric_col = numeric_cols[0]

        # 3. Clean and prepare time-series series
        clean_df = df.copy()
        is_real_date = False

        if date_col:
            try:
                clean_df["_parsed_date"] = pd.to_datetime(clean_df[date_col], errors='coerce')
                clean_df = clean_df.dropna(subset=["_parsed_date", metric_col]).sort_values("_parsed_date")
                if len(clean_df) >= 3:
                    is_real_date = True
            except Exception:
                is_real_date = False

        if not is_real_date:
            # Fallback to sequential chronological index
            clean_df = clean_df.dropna(subset=[metric_col]).reset_index(drop=True)
            clean_df["_parsed_date"] = [datetime.today() - timedelta(days=(len(clean_df) - i)) for i in range(len(clean_df))]
            date_col = date_col or "Period"

        # Aggregate if multiple entries exist per date
        ts_df = clean_df.groupby(clean_df["_parsed_date"].dt.strftime("%Y-%m-%d"))[metric_col].mean().reset_index()
        ts_df.columns = ["date", "actual"]

        # If too many points, sample evenly to keep visualization ultra-crisp (max 60 historical points)
        if len(ts_df) > 60:
            step = len(ts_df) // 60
            ts_df = ts_df.iloc[::step].reset_index(drop=True)

        y = ts_df["actual"].values.astype(float)
        n = len(y)
        if n < 2:
            raise ValueError("Insufficient historical data points to generate forecast.")

        # 4. Holt's Linear Exponential Smoothing Model
        # Level equation: L_t = alpha * Y_t + (1 - alpha) * (L_{t-1} + b_{t-1})
        # Trend equation: b_t = beta * (L_t - L_{t-1}) + (1 - beta) * b_{t-1}
        alpha = 0.4
        beta = 0.2

        level = y[0]
        trend = (y[-1] - y[0]) / max(1, n - 1)
        residuals = []

        fitted_values = [level]
        for t in range(1, n):
            prev_level = level
            prev_trend = trend
            y_t = y[t]

            level = alpha * y_t + (1 - alpha) * (prev_level + prev_trend)
            trend = beta * (level - prev_level) + (1 - beta) * prev_trend
            fitted = prev_level + prev_trend
            fitted_values.append(fitted)
            residuals.append(y_t - fitted)

        # Standard deviation of residuals
        std_err = float(np.std(residuals)) if residuals else float(np.std(y)) * 0.1
        if std_err == 0:
            std_err = max(1.0, float(abs(level) * 0.05))

        # 5. Project future steps
        horizon = min(180, max(7, int(horizon)))
        
        # Calculate date interval
        last_date = datetime.strptime(ts_df["date"].iloc[-1], "%Y-%m-%d")
        if n > 1:
            try:
                first_date = datetime.strptime(ts_df["date"].iloc[0], "%Y-%m-%d")
                avg_interval_days = max(1, int((last_date - first_date).days / (n - 1)))
            except Exception:
                avg_interval_days = 1
        else:
            avg_interval_days = 1

        forecast_points = []
        combined_series = []

        # Populate historical items
        for i, row in ts_df.iterrows():
            combined_series.append({
                "date": row["date"],
                "actual": round(float(row["actual"]), 2),
                "forecast": None,
                "upper_95": None,
                "lower_95": None,
                "upper_80": None,
                "lower_80": None,
                "is_projected": False
            })

        # Connect historical with first forecast point seamlessly
        current_date = last_date
        for h in range(1, horizon + 1):
            current_date += timedelta(days=avg_interval_days)
            date_str = current_date.strftime("%Y-%m-%d")

            # Project level + trend * h
            proj_val = max(0.0, float(level + trend * h))
            
            # Expanding uncertainty bounds over horizon
            uncertainty_mult = math.sqrt(h)
            bound_80 = 1.28 * std_err * uncertainty_mult
            bound_95 = 1.96 * std_err * uncertainty_mult

            upper_80 = round(proj_val + bound_80, 2)
            lower_80 = max(0.0, round(proj_val - bound_80, 2))
            upper_95 = round(proj_val + bound_95, 2)
            lower_95 = max(0.0, round(proj_val - bound_95, 2))
            proj_val_rounded = round(proj_val, 2)

            point = {
                "date": date_str,
                "actual": None,
                "forecast": proj_val_rounded,
                "upper_95": upper_95,
                "lower_95": lower_95,
                "upper_80": upper_80,
                "lower_80": lower_80,
                "is_projected": True
            }
            forecast_points.append(point)
            combined_series.append(point)

        # 6. Summary metrics
        baseline_avg = float(np.mean(y))
        final_forecast = forecast_points[-1]["forecast"] if forecast_points else baseline_avg
        growth_pct = round(((final_forecast - y[-1]) / max(1e-5, abs(y[-1]))) * 100, 1)
        velocity = "Bullish Growth" if growth_pct > 3 else ("Bearish Contraction" if growth_pct < -3 else "Stable / Flat")
        confidence_rating = min(96, max(75, int(100 - (std_err / max(1e-5, baseline_avg)) * 100)))

        # 7. AI Executive Summary
        ai_summary = ""
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are an executive Chief Financial Officer and quantitative forecaster. Provide a sharp, 2-sentence executive summary of this forward-looking projection."),
                ("user", f"Target Metric: {metric_col}\n"
                         f"Historical Base: {round(y[-1], 2)}\n"
                         f"Forecasted Target in {horizon} periods: {final_forecast} ({growth_pct}% expected change)\n"
                         f"Trend Velocity: {velocity}\n"
                         f"Model Confidence: {confidence_rating}%\n"
                         f"95% Confidence Interval: [{forecast_points[-1]['lower_95']} to {forecast_points[-1]['upper_95']}]")
            ])
            llm = LLMProvider.get_llm(temperature=0.2)
            chain = prompt | llm | StrOutputParser()
            ai_summary = chain.invoke({})
        except Exception:
            ai_summary = f"Projection indicates a {velocity} trajectory for '{metric_col}', reaching an estimated {final_forecast} ({growth_pct}%) across the next {horizon} periods with a {confidence_rating}% statistical confidence rating."

        return {
            "metric_column": metric_col,
            "date_column": date_col,
            "horizon_days": horizon,
            "baseline_last": round(float(y[-1]), 2),
            "projected_end": final_forecast,
            "growth_pct": growth_pct,
            "velocity": velocity,
            "confidence_rating": confidence_rating,
            "series": combined_series,
            "forecast_points": forecast_points,
            "ai_summary": ai_summary
        }
