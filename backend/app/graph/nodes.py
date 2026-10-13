import pandas as pd
from app.graph.state import AnalystState
from app.agents.sql_agent import SQLAgent
from app.utils.sql_validator import SQLValidator
from app.utils.sql_executor import SQLExecutor
from app.data.schema_inspector import SchemaInspector
from app.db.database import SessionLocal
from app.models.dataset import Dataset
from app.agents.python_agent import PythonAgent
from app.utils.python_sandbox import PythonSandbox
from app.agents.visualization_agent import VisualizationAgent
from app.analysis.anomalies import AnomalyDetector
from app.agents.insight_agent import InsightAgent
from app.agents.reviewer import ReviewerAgent

def initialize_state(state: AnalystState) -> AnalystState:
    """Fetch schema info from database based on dataset_id."""
    db = SessionLocal()
    dataset = db.query(Dataset).filter(Dataset.id == state["dataset_id"]).first()
    db.close()
    
    if not dataset:
        return {"errors": ["Dataset not found."]}
        
    table_name = "dataset"
    schema_text = SchemaInspector.format_schema(dataset.schema_info, table_name)
    
    # Enrich schema with sample categorical values for better text querying
    try:
        if dataset.file_path:
            from app.data.universal_loader import UniversalDataLoader
            df_sample, _ = UniversalDataLoader.load(dataset.file_path, dataset.name)
            df_sample = df_sample.head(1000)
            
            samples_info = []
            for col in df_sample.columns:
                if not pd.api.types.is_numeric_dtype(df_sample[col]):
                    unique_vals = [str(v) for v in df_sample[col].dropna().unique()[:8] if str(v).strip()]
                    if unique_vals:
                        samples_info.append(f"  * {col} distinct values: {unique_vals}")
            if samples_info:
                schema_text += "\n\nDistinct/Sample categorical values:\n" + "\n".join(samples_info)
    except Exception:
        pass
    
    return {
        "table_name": table_name,
        "database_schema": schema_text,
        "dataset_path": dataset.file_path,
        "dataset_type": dataset.file_type,
        "sql_retries": 0,
        "sql_errors": [],
        "errors": []
    }

def generate_sql(state: AnalystState) -> AnalystState:
    """Calls the SQL agent to generate a query."""
    try:
        sql = SQLAgent.generate_sql(
            user_query=state["user_query"],
            schema=state["database_schema"],
            table_name=state["table_name"],
            history=state.get("history", [])
        )
        return {"generated_sql": sql}
    except Exception as e:
        return {"sql_errors": [str(e)]}

def validate_sql(state: AnalystState) -> AnalystState:
    """Validates the generated SQL."""
    # If there were errors generating, skip validation
    if state.get("sql_errors"):
        return state
        
    try:
        SQLValidator.validate(state["generated_sql"])
        return {"validated_sql": state["generated_sql"]}
    except Exception as e:
        return {"sql_errors": [str(e)]}

def execute_sql(state: AnalystState) -> AnalystState:
    """Executes the SQL against the dataset."""
    # If there were validation errors, don't execute
    if state.get("sql_errors") or not state.get("validated_sql"):
        return state
        
    try:
        path = state["dataset_path"]
        from app.data.universal_loader import UniversalDataLoader
        df, _ = UniversalDataLoader.load(path)
            
        result = SQLExecutor.execute_on_dataframe(df, state["validated_sql"], state["table_name"])
        return {"query_result": result}
    except Exception as e:
        return {"sql_errors": [f"Execution error: {str(e)}"]}

def python_analysis(state: AnalystState) -> AnalystState:
    """Runs high-speed statistical profiling and Python analysis on the SQL output."""
    if not state.get("query_result") or not state["query_result"].get("rows"):
        return state
    
    try:
        df = pd.DataFrame(state["query_result"]["rows"])
        
        # Check if user specifically requested custom ML modeling or regression
        q_lower = (state.get("user_query") or "").lower()
        needs_custom_code = any(kw in q_lower for kw in [
            "machine learning", "regression", "forecast", "monte carlo", "train model", "scikit", "custom python"
        ])
        
        if needs_custom_code:
            code = PythonAgent.generate_analysis_code(
                user_query=state["user_query"],
                columns=state["query_result"]["columns"],
                rows_sample=state["query_result"]["rows"]
            )
            result = PythonSandbox.execute_analysis(df, code)
            return {"python_code": code, "python_result": result}

        # High-speed native statistical profiling (0ms execution, zero LLM overhead)
        numeric_cols = df.select_dtypes(include=['number', 'float', 'int']).columns.tolist()
        summary_stats = {}
        if numeric_cols:
            desc = df[numeric_cols].describe().round(2).to_dict()
            summary_stats = {
                "metrics_summary": desc,
                "row_count": len(df),
                "numeric_columns": numeric_cols
            }
        else:
            summary_stats = {"row_count": len(df), "columns": list(df.columns)}

        code_snippet = "# Native vectorized statistical profiling\nresult = df.describe().round(2).to_dict()"
        return {"python_code": code_snippet, "python_result": summary_stats}
    except Exception as e:
        return {"errors": [f"Python execution error: {str(e)}"]}

def generate_visualization(state: AnalystState) -> AnalystState:
    """Determines if charts should be generated based on the data."""
    if not state.get("query_result") or not state["query_result"].get("rows"):
        return state
        
    try:
        specs = VisualizationAgent.generate_chart_spec(
            user_query=state["user_query"],
            columns=state["query_result"]["columns"],
            rows_sample=state["query_result"]["rows"]
        )
        return {"chart_specs": specs}
    except Exception as e:
        return {"errors": [f"Visualization error: {str(e)}"]}

def detect_anomalies(state: AnalystState) -> AnalystState:
    """Detects statistical anomalies in the query result."""
    if not state.get("query_result") or not state["query_result"].get("rows"):
        return state
        
    try:
        df = pd.DataFrame(state["query_result"]["rows"])
        anomalies = AnomalyDetector.detect_anomalies(df)
        return {"anomalies": anomalies}
    except Exception as e:
        return {"errors": [f"Anomaly detection error: {str(e)}"]}

def generate_insights(state: AnalystState) -> AnalystState:
    """Generates business insights from the aggregated data."""
    if state.get("errors") or not state.get("query_result"):
        return state
        
    try:
        insights = InsightAgent.generate_insights(
            user_query=state["user_query"],
            query_result=state["query_result"],
            python_result=state.get("python_result", {}),
            anomalies=state.get("anomalies", []),
            history=state.get("history", [])
        )
        return {"insights": insights}
    except Exception as e:
        return {"errors": [f"Insight error: {str(e)}"]}

def review_answer(state: AnalystState) -> AnalystState:
    """Reviews the final insight against the raw data."""
    if state.get("errors") or not state.get("insights"):
        return state
        
    try:
        review_result = ReviewerAgent.review_answer(
            user_query=state["user_query"],
            insight=state["insights"],
            query_result=state["query_result"]
        )
        
        return {
            "reviewer_approved": review_result.get("approved", False),
            "confidence_score": review_result.get("confidence", 0.0),
            "reviewer_issues": review_result.get("issues", []),
            "retry_count": state.get("retry_count", 0) + 1
        }
    except Exception as e:
        return {"errors": [f"Reviewer error: {str(e)}"]}
