import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from app.services.llm_service import LLMProvider
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

class DriverAnalyzer:
    @staticmethod
    def analyze_drivers(
        df: pd.DataFrame, 
        metric_col: Optional[str] = None, 
        dimension_col: Optional[str] = None,
        query: Optional[str] = ""
    ) -> Dict[str, Any]:
        """
        Performs automated Root-Cause Driver Analysis and Waterfall Variance Decomposition.
        Identifies which categories drove the metric up or dragged it down relative to baseline benchmark.
        """
        # 1. Automatically pick metric and dimension if not specified
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category', 'string']).columns.tolist()

        if not metric_col or metric_col not in df.columns:
            if numeric_cols:
                metric_col = numeric_cols[0]
            else:
                raise ValueError("No numeric metric column available for variance decomposition.")

        if not dimension_col or dimension_col not in df.columns:
            if categorical_cols:
                # Pick categorical column with 3 to 20 unique values for best waterfall readability
                best_cat = None
                for col in categorical_cols:
                    nunique = df[col].nunique()
                    if 2 <= nunique <= 15:
                        best_cat = col
                        break
                dimension_col = best_cat or categorical_cols[0]
            else:
                # If no categorical column, create one from quantiles
                df["Segment"] = pd.qcut(df[metric_col], q=4, labels=["Tier 1 (Low)", "Tier 2 (Mid-Low)", "Tier 3 (Mid-High)", "Tier 4 (High)"])
                dimension_col = "Segment"

        # 2. Compute group aggregates
        grouped = df.groupby(dimension_col, observed=True)[metric_col].agg(['sum', 'mean', 'count']).reset_index()
        overall_sum = float(df[metric_col].sum())
        overall_mean = float(df[metric_col].mean())
        total_count = len(df)

        # Baseline benchmark: expected contribution if evenly distributed or group mean
        expected_share = 1.0 / max(1, len(grouped))
        
        waterfall_steps = []
        driver_items = []

        baseline_val = round(overall_mean, 2)
        waterfall_steps.append({
            "name": "Benchmark Base",
            "value": baseline_val,
            "delta": 0,
            "isTotal": True,
            "color": "#6366f1"
        })

        running_val = baseline_val

        # Sort groups by sum descending
        grouped = grouped.sort_values(by="sum", ascending=False)

        # Keep top 7 segments, lump the rest into 'Other'
        if len(grouped) > 8:
            top_segments = grouped.head(7)
            other_segments = grouped.iloc[7:]
            other_row = pd.DataFrame([{
                dimension_col: "Other Segments",
                "sum": other_segments["sum"].sum(),
                "mean": other_segments["mean"].mean(),
                "count": other_segments["count"].sum()
            }])
            analysis_df = pd.concat([top_segments, other_row], ignore_index=True)
        else:
            analysis_df = grouped

        total_variance_mag = 0.0
        temp_drivers = []

        for _, row in analysis_df.iterrows():
            cat_name = str(row[dimension_col])
            grp_mean = float(row["mean"])
            grp_sum = float(row["sum"])
            grp_count = int(row["count"])

            delta = round(grp_mean - baseline_val, 2)
            total_variance_mag += abs(delta)

            temp_drivers.append({
                "category": cat_name,
                "delta": delta,
                "group_sum": round(grp_sum, 2),
                "group_mean": round(grp_mean, 2),
                "count": grp_count
            })

        for d in temp_drivers:
            impact_pct = round((d["delta"] / max(1e-5, baseline_val)) * 100, 1)
            is_positive = d["delta"] >= 0
            running_val = round(running_val + d["delta"], 2)

            waterfall_steps.append({
                "name": d["category"],
                "value": running_val,
                "delta": d["delta"],
                "isPositive": is_positive,
                "isTotal": False,
                "impact_pct": impact_pct,
                "color": "#10b981" if is_positive else "#f43f5e"
            })

            driver_items.append({
                "category": d["category"],
                "delta": d["delta"],
                "impact_pct": impact_pct,
                "mean": d["group_mean"],
                "direction": "Positive Driver" if is_positive else "Negative Drag"
            })

        # Final total step
        final_val = round(running_val, 2)
        waterfall_steps.append({
            "name": "Adjusted Benchmark",
            "value": final_val,
            "delta": round(final_val - baseline_val, 2),
            "isTotal": True,
            "color": "#38bdf8"
        })

        # 3. Synthesize executive AI narrative
        top_positive = [d for d in driver_items if d["delta"] > 0][:3]
        top_negative = [d for d in driver_items if d["delta"] < 0][:3]

        driver_summary_lines = []
        if top_positive:
            pos_strs = [f"**{d['category']}** (+{d['impact_pct']}%)" for d in top_positive]
            driver_summary_lines.append(f"Top Growth Drivers: {', '.join(pos_strs)}")
        if top_negative:
            neg_strs = [f"**{d['category']}** ({d['impact_pct']}%)" for d in top_negative]
            driver_summary_lines.append(f"Primary Negative Drags: {', '.join(neg_strs)}")

        executive_takeaway = " • ".join(driver_summary_lines)

        # Generate strategic diagnosis using LLM
        diagnosis = ""
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are an executive Chief Data Officer. Write a concise, 2-paragraph root-cause analysis explaining what factors drove this variance and what strategic actions leadership should take.\nKeep it punchy, quantitative, and boardroom-ready."),
                ("user", f"Dataset: {len(df)} rows. Target Metric: '{metric_col}'. Categorical Dimension: '{dimension_col}'.\n"
                         f"Baseline Benchmark: {baseline_val}\n"
                         f"Top Positive Drivers: {top_positive}\n"
                         f"Top Negative Drags: {top_negative}\n"
                         f"Context Query: {query}")
            ])
            llm = LLMProvider.get_llm(temperature=0.2)
            chain = prompt | llm | StrOutputParser()
            diagnosis = chain.invoke({})
        except Exception:
            diagnosis = (
                f"Variance analysis on '{metric_col}' grouped by '{dimension_col}' reveals significant polarization. "
                + (f"The largest upward momentum is led by {top_positive[0]['category']}. " if top_positive else "")
                + (f"Conversely, {top_negative[0]['category']} exhibits the most severe downward pull, representing an immediate intervention target." if top_negative else "")
            )

        return {
            "metric_column": metric_col,
            "dimension_column": dimension_col,
            "baseline_value": baseline_val,
            "final_value": final_val,
            "waterfall_steps": waterfall_steps,
            "top_positive": top_positive,
            "top_negative": top_negative,
            "executive_takeaway": executive_takeaway,
            "diagnosis": diagnosis
        }
