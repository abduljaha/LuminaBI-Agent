import json
import logging
import pandas as pd
import numpy as np
from typing import Dict, Any, List
from langchain_core.prompts import ChatPromptTemplate
from app.services.llm_service import LLMProvider

logger = logging.getLogger(__name__)

SCENARIO_PROMPT = """
You are a Senior Strategic Financial & Data Modeling Analyst.
The user is requesting a "What-If" scenario or simulation analysis on their dataset.

Dataset Schema & Statistics:
{schema_info}

Sample Rows:
{sample_rows}

User Simulation Request:
"{user_query}"

Determine the simulation parameters and formulate an exact Pandas computation logic.
Return a STRICT JSON object in this format:
{{
    "metric_target": "name of target column (e.g. revenue, profit, monthly_charges, salary)",
    "scenario_title": "Short descriptive scenario title",
    "change_description": "Explanation of what is changed (e.g., -15% reduction in revenue)",
    "filter_condition": "optional category or segment filter, or 'all'",
    "aggregation_dimension": "dimension column to group by, or 'overall'",
    "multiplier": 0.85, 
    "operation": "multiply" | "add" | "set",
    "operation_value": 0.85,
    "strategic_summary": "Initial executive summary of what this scenario assesses"
}}

Output ONLY the JSON object. Do not wrap in markdown quotes if possible.
"""

INSIGHT_SYNTHESIS_PROMPT = """
You are an Executive Business Advisor.
Review the following simulation baseline vs scenario results:

Scenario: {scenario_title}
Metric: {metric_target}
Baseline Total: {baseline_total}
Simulated Total: {simulated_total}
Delta: {delta_total} ({delta_pct}%)

Breakdown by Segment:
{breakdown_json}

Provide:
1. Executive Takeaway (2-3 concise sentences on total financial or operational impact)
2. Most Vulnerable Segments (which groups take the hardest hit or gain most)
3. 3 Strategic Action Items / Mitigations

Format with clean bullet points.
"""

class ScenarioAgent:
    @staticmethod
    def simulate(df: pd.DataFrame, schema_info: Dict[str, Any], user_query: str) -> Dict[str, Any]:
        """
        Runs an end-to-end what-if scenario simulation on the dataset.
        """
        llm = LLMProvider.get_llm(temperature=0.0)
        
        sample_rows = df.head(5).to_dict(orient="records")
        prompt = ChatPromptTemplate.from_template(SCENARIO_PROMPT)
        chain = prompt | llm
        
        try:
            response = chain.invoke({
                "schema_info": json.dumps(schema_info, indent=2),
                "sample_rows": json.dumps(sample_rows, default=str),
                "user_query": user_query
            })
            
            raw_text = response.content if hasattr(response, "content") else str(response)
            cleaned_text = raw_text.strip()
            if cleaned_text.startswith("```"):
                cleaned_text = cleaned_text.strip("`")
                if cleaned_text.startswith("json"):
                    cleaned_text = cleaned_text[4:].strip()
            params = json.loads(cleaned_text)
        except Exception as e:
            logger.warning(f"Error parsing scenario parameters: {e}. Using intelligent defaults.")
            # Intelligent fallback
            numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
            cat_cols = [c for c in df.columns if df[c].dtype == object or str(df[c].dtype) == "string"]
            target = numeric_cols[0] if numeric_cols else df.columns[0]
            dim = cat_cols[0] if cat_cols else "overall"
            params = {
                "metric_target": target,
                "scenario_title": "Simulated Adjustment Scenario",
                "change_description": "Hypothetical 10% variance applied to " + str(target),
                "filter_condition": "all",
                "aggregation_dimension": dim,
                "multiplier": 1.10,
                "operation": "multiply",
                "operation_value": 1.10,
                "strategic_summary": f"Simulating variance on {target}"
            }

        target_col = params.get("metric_target")
        # Ensure column exists
        if target_col not in df.columns:
            numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
            target_col = numeric_cols[0] if numeric_cols else df.columns[-1]

        # Ensure numeric type
        sim_df = df.copy()
        sim_df[target_col] = pd.to_numeric(sim_df[target_col], errors="coerce").fillna(0)
        
        baseline_col = f"{target_col}_baseline"
        scenario_col = f"{target_col}_simulated"
        
        sim_df[baseline_col] = sim_df[target_col]
        
        op = params.get("operation", "multiply")
        val = float(params.get("operation_value", params.get("multiplier", 1.0)))
        
        if op == "multiply":
            sim_df[scenario_col] = sim_df[baseline_col] * val
        elif op == "add":
            sim_df[scenario_col] = sim_df[baseline_col] + val
        else:
            sim_df[scenario_col] = sim_df[baseline_col] * val

        sim_df["delta"] = sim_df[scenario_col] - sim_df[baseline_col]

        baseline_total = round(float(sim_df[baseline_col].sum()), 2)
        simulated_total = round(float(sim_df[scenario_col].sum()), 2)
        delta_total = round(simulated_total - baseline_total, 2)
        delta_pct = round((delta_total / baseline_total * 100), 2) if baseline_total != 0 else 0.0

        # Aggregation dimension breakdown
        dim = params.get("aggregation_dimension", "overall")
        comparison_data = []
        if dim in sim_df.columns and dim != "overall":
            grouped = sim_df.groupby(dim)[[baseline_col, scenario_col, "delta"]].sum().reset_index()
            for _, r in grouped.head(10).iterrows():
                b_val = round(float(r[baseline_col]), 2)
                s_val = round(float(r[scenario_col]), 2)
                d_val = round(float(r["delta"]), 2)
                d_p = round((d_val / b_val * 100), 2) if b_val != 0 else 0.0
                comparison_data.append({
                    "segment": str(r[dim]),
                    "baseline": b_val,
                    "simulated": s_val,
                    "delta": d_val,
                    "delta_pct": d_p
                })
        else:
            comparison_data.append({
                "segment": "Total",
                "baseline": baseline_total,
                "simulated": simulated_total,
                "delta": delta_total,
                "delta_pct": delta_pct
            })

        # Synthesize strategic insights
        synth_prompt = ChatPromptTemplate.from_template(INSIGHT_SYNTHESIS_PROMPT)
        synth_chain = synth_prompt | llm
        try:
            synth_resp = synth_chain.invoke({
                "scenario_title": params.get("scenario_title", "What-If Simulation"),
                "metric_target": target_col,
                "baseline_total": f"{baseline_total:,.2f}",
                "simulated_total": f"{simulated_total:,.2f}",
                "delta_total": f"{delta_total:,.2f}",
                "delta_pct": f"{delta_pct:+.2f}%",
                "breakdown_json": json.dumps(comparison_data[:5], indent=2)
            })
            raw_content = synth_resp.content if hasattr(synth_resp, "content") else str(synth_resp)
            if isinstance(raw_content, list):
                parts = []
                for p in raw_content:
                    if isinstance(p, dict):
                        parts.append(p.get("text", json.dumps(p)))
                    else:
                        parts.append(str(p))
                executive_narrative = "\n".join(parts)
            elif isinstance(raw_content, dict):
                executive_narrative = raw_content.get("text") or json.dumps(raw_content)
            else:
                executive_narrative = str(raw_content)
        except Exception as e:
            executive_narrative = (
                f"### Simulation Summary\n"
                f"- **Baseline Total:** {baseline_total:,.2f}\n"
                f"- **Simulated Total:** {simulated_total:,.2f}\n"
                f"- **Net Impact:** {delta_total:+,.2f} ({delta_pct:+.2f}%)\n"
            )

        return {
            "scenario_title": params.get("scenario_title", "Scenario Simulation"),
            "change_description": params.get("change_description", f"Adjustment on {target_col}"),
            "metric_target": target_col,
            "baseline_total": baseline_total,
            "simulated_total": simulated_total,
            "delta_total": delta_total,
            "delta_pct": delta_pct,
            "breakdown": comparison_data,
            "executive_narrative": executive_narrative,
            "chart_type": "bar"
        }
