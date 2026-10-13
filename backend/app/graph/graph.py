from langgraph.graph import StateGraph, END
from app.graph.state import AnalystState
from app.graph.nodes import (
    initialize_state, generate_sql, validate_sql, execute_sql, 
    python_analysis, detect_anomalies, generate_visualization, 
    generate_insights, review_answer
)
from app.core.config import settings

def should_execute_sql(state: AnalystState):
    if state.get("sql_errors") or state.get("errors"):
        return END
    return "execute_sql"

def check_approval(state: AnalystState):
    if state.get("errors"):
        return END
        
    if not state.get("reviewer_approved", True):
        if state.get("retry_count", 0) < settings.MAX_AGENT_RETRIES:
            return "generate_sql" # retry loop
        return END
    return END

def build_graph():
    workflow = StateGraph(AnalystState)
    
    workflow.add_node("initialize", initialize_state)
    workflow.add_node("generate_sql", generate_sql)
    workflow.add_node("validate_sql", validate_sql)
    workflow.add_node("execute_sql", execute_sql)
    workflow.add_node("python_analysis", python_analysis)
    workflow.add_node("detect_anomalies", detect_anomalies)
    workflow.add_node("generate_visualization", generate_visualization)
    workflow.add_node("generate_insights", generate_insights)
    workflow.add_node("review_answer", review_answer)
    
    workflow.set_entry_point("initialize")
    
    workflow.add_edge("initialize", "generate_sql")
    workflow.add_edge("generate_sql", "validate_sql")
    
    workflow.add_conditional_edges("validate_sql", should_execute_sql, {
        "execute_sql": "execute_sql",
        END: END
    })
    
    workflow.add_edge("execute_sql", "python_analysis")
    workflow.add_edge("python_analysis", "detect_anomalies")
    workflow.add_edge("detect_anomalies", "generate_visualization")
    workflow.add_edge("generate_visualization", "generate_insights")
    workflow.add_edge("generate_insights", "review_answer")
    
    workflow.add_conditional_edges("review_answer", check_approval, {
        "generate_sql": "generate_sql",
        END: END
    })
    
    return workflow.compile()

compiled_graph = build_graph()
