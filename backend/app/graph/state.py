from typing import TypedDict, List, Dict, Any, Optional

class AnalystState(TypedDict, total=False):
    # Inputs
    user_query: str
    dataset_id: int
    
    # Processed Data
    table_name: str
    database_schema: str
    dataset_path: str
    dataset_type: str
    
    # SQL Workflow
    generated_sql: str
    validated_sql: str
    sql_errors: List[str]
    sql_retries: int
    
    # Results
    query_result: Dict[str, Any] # {"columns": [], "rows": [], "row_count": int}
    
    # Python Analysis
    python_code: str
    python_result: Dict[str, Any]
    
    # Anomalies
    anomalies: List[Dict[str, Any]]
    
    # Visualization
    chart_specs: List[Dict[str, str]]
    
    # Insights & Review
    insights: str
    reviewer_approved: bool
    reviewer_issues: List[str]
    confidence_score: float
    retry_count: int
    
    # Multi-Turn Conversation History
    history: List[Dict[str, str]] # [{"role": "user"|"assistant", "content": "..."}]

    # Output
    errors: List[str]
    final_answer: str
