from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import distinct
from app.db.database import get_db
from app.models.board import BoardWidget
from app.models.dataset import Dataset
from app.api.deps import get_current_user_optional

router = APIRouter(prefix="/board", tags=["board"])

class PinWidgetRequest(BaseModel):
    board_name: Optional[str] = "Executive Cockpit"
    dataset_id: Optional[int] = None
    dataset_name: Optional[str] = None
    title: str
    query: Optional[str] = ""
    chart_type: Optional[str] = "bar"
    chart_specs: Optional[List[Dict[str, Any]]] = None
    query_result: Optional[Dict[str, Any]] = None
    insights: Optional[str] = ""
    kpis: Optional[Dict[str, Any]] = None
    card_width: Optional[str] = "col-span-1"

class UpdateWidgetRequest(BaseModel):
    title: Optional[str] = None
    card_width: Optional[str] = None
    chart_type: Optional[str] = None
    position: Optional[int] = None
    board_name: Optional[str] = None

@router.get("/names")
def list_board_names(db: Session = Depends(get_db)):
    """Returns list of distinct board names in the workspace."""
    results = db.query(distinct(BoardWidget.board_name)).all()
    names = [r[0] for r in results if r[0]]
    if not names:
        names = ["Executive Cockpit"]
    return {"boards": names}

@router.get("/")
def get_board_widgets(board_name: Optional[str] = None, db: Session = Depends(get_db)):
    """Fetches all widgets for a given board name (defaults to 'Executive Cockpit')."""
    query = db.query(BoardWidget)
    if board_name:
        query = query.filter(BoardWidget.board_name == board_name)
    widgets = query.order_by(BoardWidget.position.asc(), BoardWidget.id.desc()).all()
    
    return [
        {
            "id": w.id,
            "board_name": w.board_name,
            "dataset_id": w.dataset_id,
            "dataset_name": w.dataset_name,
            "title": w.title,
            "query": w.query,
            "chart_type": w.chart_type,
            "chart_specs": w.chart_specs,
            "query_result": w.query_result,
            "insights": w.insights,
            "kpis": w.kpis,
            "card_width": w.card_width,
            "position": w.position,
            "created_at": w.created_at.isoformat() if w.created_at else None
        }
        for w in widgets
    ]

@router.post("/")
def pin_widget(req: PinWidgetRequest, db: Session = Depends(get_db)):
    """Pins an analysis result, chart, or KPI card to the executive dashboard."""
    # Resolve dataset name if not provided
    dataset_name = req.dataset_name
    if not dataset_name and req.dataset_id:
        ds = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
        if ds:
            dataset_name = ds.name

    # Calculate next position
    highest_pos = db.query(BoardWidget.position).filter(
        BoardWidget.board_name == req.board_name
    ).order_by(BoardWidget.position.desc()).first()
    next_pos = (highest_pos[0] + 1) if highest_pos else 0

    widget = BoardWidget(
        board_name=req.board_name or "Executive Cockpit",
        dataset_id=req.dataset_id,
        dataset_name=dataset_name,
        title=req.title,
        query=req.query,
        chart_type=req.chart_type or "bar",
        chart_specs=req.chart_specs,
        query_result=req.query_result,
        insights=req.insights,
        kpis=req.kpis,
        card_width=req.card_width or "col-span-1",
        position=next_pos
    )
    db.add(widget)
    db.commit()
    db.refresh(widget)
    return {"message": "Widget pinned successfully", "widget_id": widget.id}

@router.put("/{widget_id}")
def update_widget(widget_id: int, req: UpdateWidgetRequest, db: Session = Depends(get_db)):
    """Updates title, width, chart_type, position, or board assignment."""
    widget = db.query(BoardWidget).filter(BoardWidget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    
    if req.title is not None:
        widget.title = req.title
    if req.card_width is not None:
        widget.card_width = req.card_width
    if req.chart_type is not None:
        widget.chart_type = req.chart_type
    if req.position is not None:
        widget.position = req.position
    if req.board_name is not None:
        widget.board_name = req.board_name
        
    db.commit()
    return {"message": "Widget updated successfully"}

@router.delete("/{widget_id}")
def delete_widget(widget_id: int, db: Session = Depends(get_db)):
    """Deletes a widget from the board."""
    widget = db.query(BoardWidget).filter(BoardWidget.id == widget_id).first()
    if not widget:
        raise HTTPException(status_code=404, detail="Widget not found")
    db.delete(widget)
    db.commit()
    return {"message": "Widget unpinned"}

@router.delete("/boards/{board_name}")
def delete_entire_board(board_name: str, db: Session = Depends(get_db)):
    """Deletes all widgets belonging to a board."""
    db.query(BoardWidget).filter(BoardWidget.board_name == board_name).delete()
    db.commit()
    return {"message": f"Board '{board_name}' deleted"}
