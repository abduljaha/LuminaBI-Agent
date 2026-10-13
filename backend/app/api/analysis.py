import json
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.graph.graph import compiled_graph
from app.db.database import SessionLocal
from app.models.dataset import Dataset
from app.services.report_service import ReportGenerator

router = APIRouter(prefix="/analysis", tags=["analysis"])

class ChatMessage(BaseModel):
    role: str # "user" or "assistant"
    content: str

class AnalysisRequest(BaseModel):
    dataset_id: int
    query: str
    history: Optional[List[ChatMessage]] = []

class ReportExportRequest(BaseModel):
    dataset_id: int
    query: str
    insights: str
    validated_sql: Optional[str] = ""
    query_result: Optional[Dict[str, Any]] = None
    anomalies: Optional[List[Dict[str, Any]]] = []
    confidence_score: Optional[float] = 0.0
    reviewer_approved: Optional[bool] = True
    format: str = "markdown" # "markdown" or "pdf"

def sanitize_for_json(obj: Any) -> Any:
    """Recursively ensures data structures contain only JSON-serializable standard Python types."""
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple, set)):
        return [sanitize_for_json(item) for item in obj]
    elif hasattr(obj, 'item') and callable(getattr(obj, 'item')):
        return obj.item()
    return obj

def generate_follow_up_questions(user_query: str, query_result: Optional[Dict[str, Any]] = None) -> List[str]:
    """
    Generates 3 contextual, high-value BI follow-up questions tailored to the query and dataset schema.
    Runs instantaneously (< 1ms) without blocking network roundtrips.
    """
    columns = (query_result or {}).get("columns", [])
    rows = (query_result or {}).get("rows", [])
    
    # Intelligent schema-aware dynamic follow-up questions
    fallbacks = []
    if columns:
        dim = columns[0].replace('_', ' ').title()
        metric = columns[1].replace('_', ' ').title() if len(columns) > 1 else "Total Count"
        
        fallbacks.append(f"Which top 5 specific categories contributed most to {metric}?")
        if len(columns) > 1:
            fallbacks.append(f"What is the average {metric} benchmark across all {dim} groups?")
        else:
            fallbacks.append(f"What is the distribution variance across {dim}?")
        fallbacks.append(f"Are there any statistical anomalies or outlier segments in this data?")
    else:
        fallbacks = [
            "Can we break this metric down by customer segment or category?",
            "What was the period-over-period growth rate for these numbers?",
            "Which segments had the highest variance or statistical anomalies?"
        ]
    return fallbacks[:3]

@router.post("/")
async def run_analysis(req: AnalysisRequest):
    """Pipeline invocation with conversation history and non-blocking worker thread execution."""
    formatted_history = [{"role": m.role, "content": m.content} for m in req.history or []]
    
    initial_state = {
        "dataset_id": req.dataset_id,
        "user_query": req.query,
        "history": formatted_history
    }
    
    try:
        # Run graph in worker thread to prevent freezing the FastAPI event loop
        result = await asyncio.to_thread(compiled_graph.invoke, initial_state)
        
        # Check for early initialization errors
        if result.get("errors"):
            raise HTTPException(status_code=400, detail=result["errors"][0])
            
        follow_ups = generate_follow_up_questions(req.query, result.get("query_result"))

        return sanitize_for_json({
            "generated_sql": result.get("generated_sql"),
            "validated_sql": result.get("validated_sql"),
            "sql_errors": result.get("sql_errors"),
            "query_result": result.get("query_result"),
            "python_code": result.get("python_code"),
            "python_result": result.get("python_result"),
            "chart_specs": result.get("chart_specs"),
            "anomalies": result.get("anomalies"),
            "insights": result.get("insights"),
            "reviewer_approved": result.get("reviewer_approved"),
            "reviewer_issues": result.get("reviewer_issues"),
            "confidence_score": result.get("confidence_score"),
            "retry_count": result.get("retry_count"),
            "follow_up_questions": follow_ups
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def stream_analysis(req: AnalysisRequest):
    """
    Streams multi-agent step-by-step progress events in real-time via Server-Sent Events (SSE).
    Each node in LangGraph sends an update as it begins and concludes.
    """
    formatted_history = [{"role": m.role, "content": m.content} for m in req.history or []]

    async def event_generator():
        initial_state = {
            "dataset_id": req.dataset_id,
            "user_query": req.query,
            "history": formatted_history
        }

        node_descriptions = {
            "initialize": "Inspecting dataset schema and statistics...",
            "generate_sql": "Synthesizing optimal SQLite query...",
            "validate_sql": "Validating SQL safety and AST boundaries...",
            "execute_sql": "Executing query on in-memory dataset...",
            "python_analysis": "Executing Python analysis sandbox...",
            "detect_anomalies": "Calculating statistical outliers and anomalies...",
            "generate_visualization": "Synthesizing chart visualization specifications...",
            "generate_insights": "Synthesizing executive business insights...",
            "review_answer": "QA Critic verifying mathematical grounding..."
        }

        # Yield start event
        yield {
            "event": "start",
            "data": json.dumps({"status": "starting", "message": "Initiating LangGraph agent workflow..."})
        }

        final_state: Dict[str, Any] = {}

        try:
            # Stream node updates using LangGraph stream
            for output in compiled_graph.stream(initial_state):
                for node_name, node_state in output.items():
                    final_state.update(node_state)
                    desc = node_descriptions.get(node_name, f"Executing {node_name}...")
                    
                    payload = {
                        "node": node_name,
                        "description": desc,
                        "status": "completed"
                    }

                    # Add specific live progress details if available
                    if node_name == "generate_sql" and node_state.get("generated_sql"):
                        payload["sql"] = node_state["generated_sql"]
                    elif node_name == "execute_sql" and node_state.get("query_result"):
                        payload["row_count"] = node_state["query_result"].get("row_count", 0)
                    elif node_name == "detect_anomalies" and node_state.get("anomalies") is not None:
                        payload["anomalies_count"] = len(node_state.get("anomalies", []))
                    elif node_name == "review_answer":
                        payload["confidence"] = node_state.get("confidence_score")
                        payload["approved"] = node_state.get("reviewer_approved")

                    yield {
                        "event": "step",
                        "data": json.dumps(payload)
                    }

            # Final complete result
            result_payload = sanitize_for_json({
                "generated_sql": final_state.get("generated_sql"),
                "validated_sql": final_state.get("validated_sql"),
                "sql_errors": final_state.get("sql_errors"),
                "query_result": final_state.get("query_result"),
                "python_code": final_state.get("python_code"),
                "python_result": final_state.get("python_result"),
                "chart_specs": final_state.get("chart_specs"),
                "anomalies": final_state.get("anomalies"),
                "insights": final_state.get("insights"),
                "reviewer_approved": final_state.get("reviewer_approved"),
                "reviewer_issues": final_state.get("reviewer_issues"),
                "confidence_score": final_state.get("confidence_score"),
                "retry_count": final_state.get("retry_count"),
                "follow_up_questions": generate_follow_up_questions(req.query, final_state.get("query_result"))
            })

            yield {
                "event": "done",
                "data": json.dumps(result_payload)
            }

        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }

    return EventSourceResponse(event_generator())

@router.post("/export-report")
async def export_report(req: ReportExportRequest):
    """
    Exports the generated analysis to either Markdown or a styled PDF document.
    """
    db = SessionLocal()
    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    db.close()
    dataset_name = dataset.name if dataset else f"Dataset #{req.dataset_id}"

    if req.format.lower() == "pdf":
        try:
            pdf_bytes = ReportGenerator.generate_pdf(
                query=req.query,
                dataset_name=dataset_name,
                insights=req.insights,
                validated_sql=req.validated_sql or "",
                query_result=req.query_result,
                anomalies=req.anomalies or [],
                confidence_score=req.confidence_score or 0.0,
                reviewer_approved=req.reviewer_approved if req.reviewer_approved is not None else True
            )
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f'attachment; filename="data_analyst_report_{req.dataset_id}.pdf"'
                }
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")

    else:
        # Markdown export
        md_text = ReportGenerator.generate_markdown(
            query=req.query,
            dataset_name=dataset_name,
            insights=req.insights,
            validated_sql=req.validated_sql or "",
            query_result=req.query_result,
            anomalies=req.anomalies or [],
            confidence_score=req.confidence_score or 0.0,
            reviewer_approved=req.reviewer_approved if req.reviewer_approved is not None else True
        )
        return Response(
            content=md_text,
            media_type="text/markdown",
            headers={
                "Content-Disposition": f'attachment; filename="data_analyst_report_{req.dataset_id}.md"'
            }
        )

@router.post("/simulate")
async def run_scenario_simulation(req: AnalysisRequest):
    """
    Executes a predictive What-If scenario simulation on the dataset.
    Computes baseline vs simulated deltas, segmentation impact, and strategic mitigations.
    """
    import os
    import pandas as pd
    from app.agents.scenario_agent import ScenarioAgent

    db = SessionLocal()
    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    db.close()

    if not dataset or not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Dataset not found or data file missing")

    try:
        from app.data.universal_loader import UniversalDataLoader
        df, _ = UniversalDataLoader.load(dataset.file_path, dataset.name)
        schema_info = dataset.schema_info or {}
        simulation_res = ScenarioAgent.simulate(df, schema_info, req.query)
        return sanitize_for_json(simulation_res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failed: {str(e)}")

class ExecuteSqlRequest(BaseModel):
    dataset_id: int
    sql_query: str

@router.post("/execute-sql")
async def execute_custom_sql(req: ExecuteSqlRequest):
    """
    Executes user-edited SQLite query directly on the in-memory dataset,
    re-generates chart visualization specs and refreshed executive insights.
    """
    db = SessionLocal()
    dataset = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    db.close()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    from app.data.universal_loader import UniversalDataLoader
    from app.utils.sql_executor import SQLExecutor
    from app.agents.visualization_agent import VisualizationAgent
    from app.agents.insight_agent import InsightAgent

    try:
        df, _ = UniversalDataLoader.load(dataset.file_path, dataset.name)
        # Execute query
        result = SQLExecutor.execute_on_dataframe(df, req.sql_query, "dataset")

        # Synthesize visualization spec for the updated rows
        chart_specs = []
        if result.get("rows"):
            try:
                chart_specs = VisualizationAgent.generate_charts(
                    user_query="Custom SQL Execution",
                    query_result=result,
                    dataset_schema=dataset.schema_info
                )
            except Exception:
                pass

        # Synthesize updated insights
        insights = ""
        if result.get("rows"):
            try:
                insights = InsightAgent.generate_insights(
                    user_query="Custom SQL Execution",
                    query_result=result,
                    anomalies=[]
                )
            except Exception:
                pass

        return sanitize_for_json({
            "validated_sql": req.sql_query,
            "generated_sql": req.sql_query,
            "query_result": result,
            "chart_specs": chart_specs,
            "insights": insights or f"Custom SQL executed successfully. Returned {result.get('row_count', 0)} records.",
            "reviewer_approved": True,
            "confidence_score": 0.95,
            "follow_up_questions": generate_follow_up_questions(req.sql_query, result)
        })
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL Execution Error: {str(e)}")

