import os
import json
import pandas as pd
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.dataset import Dataset
from app.data.universal_loader import UniversalDataLoader
from app.data.profiler import DataProfiler
from app.data.recipe_engine import RecipeEngine

router = APIRouter(prefix="/recipe", tags=["recipe"])

class ApplyRecipeRequest(BaseModel):
    instruction: str

def _get_recipe_steps(dataset: Dataset) -> List[Dict[str, Any]]:
    changelog = dataset.cleaning_changelog or {}
    if isinstance(changelog, str):
        try:
            changelog = json.loads(changelog)
        except Exception:
            changelog = {}
    if isinstance(changelog, list) or not isinstance(changelog, dict):
        return []
    return changelog.get("recipe_steps", [])

def _save_recipe_steps(dataset: Dataset, steps: List[Dict[str, Any]], db: Session):
    changelog = dataset.cleaning_changelog or {}
    if isinstance(changelog, str):
        try:
            changelog = json.loads(changelog)
        except Exception:
            changelog = {}
    if isinstance(changelog, list):
        changelog = {"cleaning_history": changelog}
    elif not isinstance(changelog, dict):
        changelog = {}
    changelog["recipe_steps"] = steps
    dataset.cleaning_changelog = changelog
    db.commit()

@router.get("/{dataset_id}")
def get_dataset_recipe(dataset_id: int, db: Session = Depends(get_db)):
    """Returns the transformation recipe history and current columns for a dataset."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    steps = _get_recipe_steps(dataset)
    schema_info = dataset.schema_info or {}
    
    return {
        "dataset_id": dataset.id,
        "dataset_name": dataset.name,
        "recipe_steps": steps,
        "column_count": schema_info.get("column_count", 0),
        "row_count": schema_info.get("row_count", 0),
        "columns": schema_info.get("columns", [])
    }

@router.post("/{dataset_id}/apply")
def apply_recipe_step(dataset_id: int, req: ApplyRecipeRequest, db: Session = Depends(get_db)):
    """
    Parses and applies a conversational feature engineering transformation,
    updates dataset file on disk, re-profiles schema, and appends to recipe history.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset or not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Dataset not found or missing from disk")

    try:
        # Load active DataFrame
        current_df, _ = UniversalDataLoader.load(dataset.file_path, dataset.name)
        
        # Apply transformation step
        transformed_df, step_meta = RecipeEngine.parse_and_apply_transformation(current_df, req.instruction)

        # Save transformed DataFrame to active file path
        transformed_df.to_csv(dataset.file_path, index=False)

        # Re-profile schema and statistics
        new_schema = DataProfiler.profile(transformed_df)
        dataset.schema_info = new_schema

        # Append to recipe history
        steps = _get_recipe_steps(dataset)
        steps.append(step_meta)
        _save_recipe_steps(dataset, steps, db)

        return {
            "message": "Transformation successfully applied",
            "step": step_meta,
            "recipe_steps": steps,
            "new_columns": step_meta.get("new_columns", []),
            "row_count": len(transformed_df),
            "column_count": len(transformed_df.columns)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{dataset_id}/undo")
def undo_last_step(dataset_id: int, db: Session = Depends(get_db)):
    """
    Reverts the most recent transformation step by re-running from raw file up to step N-1.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    steps = _get_recipe_steps(dataset)
    if not steps:
        raise HTTPException(status_code=400, detail="No recipe steps to undo")

    steps.pop() # Remove last step

    # Re-apply from raw or initial cleaned baseline
    base_path = dataset.raw_file_path if (dataset.raw_file_path and os.path.exists(dataset.raw_file_path)) else dataset.file_path
    df, _ = UniversalDataLoader.load(base_path, dataset.name)

    # Re-execute remaining steps
    for step in steps:
        df, _ = RecipeEngine.parse_and_apply_transformation(df, step.get("instruction", ""))

    df.to_csv(dataset.file_path, index=False)
    new_schema = DataProfiler.profile(df)
    dataset.schema_info = new_schema
    _save_recipe_steps(dataset, steps, db)

    return {
        "message": "Last step reverted successfully",
        "recipe_steps": steps,
        "row_count": len(df),
        "column_count": len(df.columns)
    }

@router.post("/{dataset_id}/reset")
def reset_to_raw(dataset_id: int, db: Session = Depends(get_db)):
    """Resets dataset back to the initial raw uploaded state, clearing all recipe transformations."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not dataset.raw_file_path or not os.path.exists(dataset.raw_file_path):
        raise HTTPException(status_code=400, detail="Raw baseline file not available for reset")

    df, _ = UniversalDataLoader.load(dataset.raw_file_path, dataset.name)
    df.to_csv(dataset.file_path, index=False)
    
    new_schema = DataProfiler.profile(df)
    dataset.schema_info = new_schema
    _save_recipe_steps(dataset, [], db)

    return {"message": "Dataset reset to raw state", "recipe_steps": []}

@router.get("/{dataset_id}/export-script")
def export_python_script(dataset_id: int, db: Session = Depends(get_db)):
    """Generates and returns an executable Python ETL pipeline script."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    steps = _get_recipe_steps(dataset)
    script_content = RecipeEngine.generate_python_script(dataset.name, steps)

    return Response(
        content=script_content,
        media_type="text/x-python",
        headers={
            "Content-Disposition": f'attachment; filename="lumina_pipeline_{dataset_id}.py"'
        }
    )
