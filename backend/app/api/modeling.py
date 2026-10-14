import re
import pandas as pd
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.dataset import Dataset
from app.data.universal_loader import UniversalDataLoader
from app.services.relationship_detector import RelationshipDetector
from app.utils.sql_executor import SQLExecutor
from app.agents.sql_agent import SQLAgent
from app.agents.visualization_agent import VisualizationAgent
from app.agents.insight_agent import InsightAgent
from app.services.llm_service import LLMProvider
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

router = APIRouter(prefix="/modeling", tags=["modeling"])

class CrossQueryRequest(BaseModel):
    dataset_ids: List[int]
    query: str

class CustomMultiSqlRequest(BaseModel):
    dataset_ids: List[int]
    sql_query: str

def _sanitize_table_name(name: str) -> str:
    clean = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower().split('.')[0])
    if clean and clean[0].isdigit():
        clean = f"t_{clean}"
    return clean or "tbl"

@router.get("/graph")
def get_schema_graph(db: Session = Depends(get_db)):
    """
    Returns entity-relationship schema graph of all registered datasets
    with auto-detected foreign keys and join cardinality.
    """
    datasets = db.query(Dataset).all()
    if not datasets:
        return {"tables": [], "relationships": []}
    return RelationshipDetector.detect_relationships(datasets)

@router.post("/cross-query")
def run_cross_dataset_query(req: CrossQueryRequest, db: Session = Depends(get_db)):
    """
    Synthesizes and executes multi-table SQL queries joining across multiple datasets in DuckDB.
    """
    if len(req.dataset_ids) < 1:
        raise HTTPException(status_code=400, detail="At least one dataset must be selected")

    datasets = db.query(Dataset).filter(Dataset.id.in_(req.dataset_ids)).all()
    if not datasets:
        raise HTTPException(status_code=404, detail="Selected datasets not found")

    # Load DataFrames into named table dictionary
    dfs: Dict[str, pd.DataFrame] = {}
    schema_descriptions = []

    for ds in datasets:
        t_name = _sanitize_table_name(ds.name)
        try:
            df, _ = UniversalDataLoader.load(ds.file_path, ds.name)
            dfs[t_name] = df
            cols_info = ", ".join([f"{col} ({str(dtype)})" for col, dtype in zip(df.columns, df.dtypes)])
            schema_descriptions.append(f"Table '{t_name}' (from '{ds.name}', {len(df)} rows):\n  Columns: {cols_info}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed loading table '{ds.name}': {str(e)}")

    full_schema_text = "\n\n".join(schema_descriptions)

    # Detect known relationships between selected tables
    graph = RelationshipDetector.detect_relationships(datasets)
    rel_lines = []
    for rel in graph.get("relationships", []):
        rel_lines.append(f"  * {rel['source_table']}.{rel['source_column']} -> {rel['target_table']}.{rel['target_column']} (confidence: {rel['confidence']})")
    
    if rel_lines:
        full_schema_text += "\n\nKnown Join Keys / Foreign Keys:\n" + "\n".join(rel_lines)

    # Synthesize multi-table SQL query
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert Data Architect & SQL Analyst specializing in DuckDB / SQLite cross-table joins.\n"
                   "Write an optimal SQL query to answer the user's question by joining across the available tables.\n\n"
                   "Rules:\n"
                   "1. Return ONLY the raw SQL query, no markdown fences, no explanations.\n"
                   "2. Always prefix columns with their respective table name or alias when joining (e.g. t1.col = t2.col).\n"
                   "3. When filtering categorical values, use case-insensitive matching: LOWER(col) = LOWER('val') or col LIKE 'val'.\n"
                   "4. Wrap numeric aggregates with COALESCE(..., 0).\n"
                   "5. Use LEFT JOIN or INNER JOIN appropriately based on the join keys.\n\n"
                   "Available Tables and Schemas:\n{schema}"),
        ("user", "{user_query}")
    ])

    llm = LLMProvider.get_llm(temperature=0.0)
    chain = prompt | llm | StrOutputParser()

    try:
        raw_sql = chain.invoke({
            "schema": full_schema_text,
            "user_query": req.query
        })
        clean_sql = raw_sql.replace("```sql", "").replace("```", "").strip()

        # Execute on DuckDB multi-dataframe catalog
        query_result = SQLExecutor.execute_multi_dataframes(dfs, clean_sql)

        # Generate visual specs
        chart_specs = []
        if query_result.get("rows"):
            try:
                chart_specs = VisualizationAgent.generate_charts(
                    user_query=req.query,
                    query_result=query_result,
                    dataset_schema={"columns": query_result.get("columns", [])}
                )
            except Exception:
                pass

        # Synthesize cross-table insights
        insights = ""
        if query_result.get("rows"):
            try:
                insights = InsightAgent.generate_insights(
                    user_query=req.query,
                    query_result=query_result,
                    anomalies=[]
                )
            except Exception:
                pass

        return {
            "sql": clean_sql,
            "query_result": query_result,
            "chart_specs": chart_specs,
            "insights": insights or f"Cross-dataset query returned {query_result.get('row_count', 0)} combined records.",
            "tables_used": list(dfs.keys())
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cross-join query execution failed: {str(e)}")

@router.post("/custom-sql")
def execute_custom_multi_sql(req: CustomMultiSqlRequest, db: Session = Depends(get_db)):
    """Executes user-edited multi-table SQL across selected datasets."""
    datasets = db.query(Dataset).filter(Dataset.id.in_(req.dataset_ids)).all()
    if not datasets:
        raise HTTPException(status_code=404, detail="Selected datasets not found")

    dfs: Dict[str, pd.DataFrame] = {}
    for ds in datasets:
        t_name = _sanitize_table_name(ds.name)
        df, _ = UniversalDataLoader.load(ds.file_path, ds.name)
        dfs[t_name] = df

    try:
        query_result = SQLExecutor.execute_multi_dataframes(dfs, req.sql_query)
        chart_specs = []
        if query_result.get("rows"):
            chart_specs = VisualizationAgent.generate_charts(
                user_query="Custom Multi-Table SQL",
                query_result=query_result,
                dataset_schema={"columns": query_result.get("columns", [])}
            )
        return {
            "sql": req.sql_query,
            "query_result": query_result,
            "chart_specs": chart_specs,
            "tables_used": list(dfs.keys())
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Custom SQL error: {str(e)}")
