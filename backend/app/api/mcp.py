import os
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db, SessionLocal
from app.models.dataset import Dataset
from app.data.universal_loader import UniversalDataLoader
from app.data.cleaner import DataCleaner
from app.data.profiler import DataProfiler
from app.utils.sql_executor import SQLExecutor
from app.graph.graph import compiled_graph

router = APIRouter(prefix="/mcp", tags=["mcp"])

class McpToolCallRequest(BaseModel):
    name: Optional[str] = None
    tool: Optional[str] = None
    arguments: Optional[Dict[str, Any]] = {}

@router.get("/manifest")
@router.get("/info")
def get_mcp_manifest():
    """
    Returns MCP (Model Context Protocol) Server Manifest and Protocol Specifications.
    Compatible with MCP Protocol version 2024-11-05.
    """
    tools_list = list_mcp_tools().get("tools", [])
    return {
        "protocolVersion": "2024-11-05",
        "serverInfo": {
            "name": "ai-data-analyst-mcp-server",
            "version": "1.0.0",
            "description": "Autonomous AI Data Analyst MCP tool provider for schema inspection, SQL synthesis, EDA data cleaning, and scenario simulations."
        },
        "capabilities": {
            "tools": {
                "listChanged": False
            },
            "resources": {
                "subscribe": False,
                "listChanged": False
            }
        },
        "tools": tools_list
    }

@router.get("/tools")
def list_mcp_tools():
    """
    Declares all callable MCP tools according to Model Context Protocol specification.
    """
    return {
        "tools": [
            {
                "name": "list_datasets",
                "description": "Lists all connected datasets in the workspace along with their row counts, formats, and cleanliness scores.",
                "inputSchema": {
                    "type": "object",
                    "properties": {}
                }
            },
            {
                "name": "audit_dataset",
                "description": "Runs a deep 6-point exploratory data anomaly audit (missing values, duplicates, bad data types, outliers, formatting issues, and constant columns).",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "dataset_id": {"type": "integer", "description": "The unique ID of the dataset to audit."}
                    },
                    "required": ["dataset_id"]
                }
            },
            {
                "name": "clean_dataset",
                "description": "Applies automated ISO data cleaning: de-duplication, imputation of nulls (infer median/mode), type conversions, outlier capping, and casing normalization.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "dataset_id": {"type": "integer", "description": "The unique ID of the dataset to clean."},
                        "handle_missing": {"type": "string", "enum": ["infer", "delete", "ignore"], "default": "infer"},
                        "handle_outliers": {"type": "string", "enum": ["cap", "flag", "delete", "ignore"], "default": "cap"}
                    },
                    "required": ["dataset_id"]
                }
            },
            {
                "name": "query_dataset",
                "description": "Analyzes dataset using natural language query or custom SQLite query, returning grounded data tables, statistical anomalies, and executive narrative.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "dataset_id": {"type": "integer", "description": "The ID of the dataset to analyze."},
                        "query": {"type": "string", "description": "The natural language question or analytical query to execute."}
                    },
                    "required": ["dataset_id", "query"]
                }
            },
            {
                "name": "execute_sql_query",
                "description": "Executes raw or modified SQLite queries against the dataset in an isolated in-memory sandbox.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "dataset_id": {"type": "integer", "description": "The ID of the dataset to query."},
                        "sql_query": {"type": "string", "description": "The SQLite query to execute against the 'dataset' table."}
                    },
                    "required": ["dataset_id", "sql_query"]
                }
            }
        ]
    }

@router.post("/call")
def call_mcp_tool(req: McpToolCallRequest, db: Session = Depends(get_db)):
    """
    Executes an MCP Tool Call and returns JSON-RPC compatible tool content.
    """
    tool_name = req.name or req.tool or ""
    args = req.arguments or {}

    if tool_name == "list_datasets":
        datasets = db.query(Dataset).all()
        result = [
            {
                "id": d.id,
                "name": d.name,
                "file_type": d.file_type,
                "quality_score": d.quality_score,
                "is_cleaned": d.is_cleaned,
                "rows": d.schema_info.get("row_count") if d.schema_info else 0
            }
            for d in datasets
        ]
        return {"content": [{"type": "text", "text": str(result)}], "isError": False}

    elif tool_name == "audit_dataset":
        dataset_id = args.get("dataset_id")
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        df, _ = UniversalDataLoader.load(dataset.file_path)
        audit = DataCleaner.audit_dataset(df)
        return {"content": [{"type": "text", "text": str(audit)}], "isError": False}

    elif tool_name == "clean_dataset":
        dataset_id = args.get("dataset_id")
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        df, _ = UniversalDataLoader.load(dataset.file_path)
        cleaned_df, changelog, audit_after = DataCleaner.clean_dataset(df, args)
        cleaned_df.to_csv(dataset.file_path, index=False)
        return {
            "content": [
                {
                    "type": "text", 
                    "text": f"Dataset #{dataset_id} cleaned. Changelog: {changelog}. Final Quality Score: {audit_after['quality_score']}/100"
                }
            ],
            "isError": False
        }

    elif tool_name == "execute_sql_query":
        dataset_id = args.get("dataset_id")
        sql_query = args.get("sql_query")
        dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
        df, _ = UniversalDataLoader.load(dataset.file_path)
        res = SQLExecutor.execute_on_dataframe(df, sql_query, "dataset")
        return {"content": [{"type": "text", "text": str(res)}], "isError": False}

    elif tool_name == "query_dataset":
        dataset_id = args.get("dataset_id")
        query = args.get("query")
        res = compiled_graph.invoke({"dataset_id": dataset_id, "user_query": query})
        return {
            "content": [
                {
                    "type": "text",
                    "text": str({
                        "sql": res.get("validated_sql"),
                        "row_count": res.get("query_result", {}).get("row_count", 0),
                        "insights": res.get("insights")
                    })
                }
            ],
            "isError": False
        }

    else:
        raise HTTPException(status_code=404, detail=f"Unknown tool: {tool_name}")

@router.get("/config")
def get_mcp_config():
    """
    Returns copy-paste configuration snippet for external MCP clients (Cursor, Claude Desktop, Antigravity).
    """
    return {
        "mcpServers": {
            "ai-data-analyst": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-fetch", "http://localhost:8000/api/v1/mcp"],
                "url": "http://localhost:8000/api/v1/mcp/call",
                "manifestUrl": "http://localhost:8000/api/v1/mcp/manifest",
                "toolsUrl": "http://localhost:8000/api/v1/mcp/tools"
            }
        }
    }
