import os
import json
import uuid
import shutil
import pandas as pd
from typing import Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.dataset import Dataset
from app.data.profiler import DataProfiler
from app.data.cleaner import DataCleaner
from app.data.universal_loader import UniversalDataLoader

router = APIRouter(prefix="/datasets", tags=["datasets"])

# Ensure data directory exists
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
os.makedirs(DATA_DIR, exist_ok=True)

class CleanRequest(BaseModel):
    handle_duplicates: Optional[bool] = True
    handle_missing: Optional[str] = "infer" # "infer", "delete", "ignore"
    handle_outliers: Optional[str] = "cap" # "cap", "delete", "flag", "ignore"
    fix_data_types: Optional[bool] = True
    normalize_dates: Optional[bool] = True
    standardize_text: Optional[bool] = True
    remove_irrelevant: Optional[bool] = True
    standardize_names: Optional[bool] = True

def _resolve_file_path(dataset: Dataset) -> str:
    if dataset.file_path and os.path.exists(dataset.file_path):
        return dataset.file_path
    if dataset.file_path:
        fallback = os.path.join(DATA_DIR, os.path.basename(dataset.file_path))
        if os.path.exists(fallback):
            return fallback
    if dataset.raw_file_path and os.path.exists(dataset.raw_file_path):
        return dataset.raw_file_path
    raise HTTPException(status_code=404, detail="Dataset file not found on disk")

def _load_dataframe(dataset: Dataset) -> pd.DataFrame:
    # 1. Try primary file_path if it has content
    if dataset.file_path and os.path.exists(dataset.file_path) and os.path.getsize(dataset.file_path) > 10:
        try:
            df, _ = UniversalDataLoader.load(dataset.file_path, dataset.name)
            if not df.empty and len(df.columns) > 0:
                return df
        except Exception:
            pass

    # 2. Resilient fallback to raw_file_path if primary file is empty, corrupted or wiped
    if dataset.raw_file_path and os.path.exists(dataset.raw_file_path) and os.path.getsize(dataset.raw_file_path) > 10:
        try:
            df, _ = UniversalDataLoader.load(dataset.raw_file_path, dataset.name)
            if not df.empty and len(df.columns) > 0:
                # Restore the working CSV file from raw so subsequent reads work
                if dataset.file_path:
                    try:
                        df.to_csv(dataset.file_path, index=False)
                    except Exception:
                        pass
                return df
        except Exception:
            pass

    # 3. Direct attempt with _resolve_file_path
    path = _resolve_file_path(dataset)
    df, _ = UniversalDataLoader.load(path, dataset.name)
    return df

@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Universal ingestion endpoint supporting ANY file format:
    CSV, TSV, TXT, Excel (.xlsx, .xls), JSON, JSONL, Parquet, XML, HTML, and unstructured data.
    Automatically audits data quality, detects anomalies, and assigns hygiene score.
    """
    original_name = file.filename or "uploaded_dataset.csv"
    ext = original_name.split('.')[-1].lower() if '.' in original_name else 'data'
    
    unique_base = uuid.uuid4().hex
    raw_filename = f"raw_{unique_base}.{ext}"
    raw_file_path = os.path.join(DATA_DIR, raw_filename)
    
    # Save raw file
    try:
        content = await file.read()
        with open(raw_file_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file to disk: {str(e)}")

    # Ingest and parse using UniversalDataLoader
    try:
        df, detected_format = UniversalDataLoader.load(raw_file_path, original_name)
        if len(df.columns) == 0:
            raise ValueError("Parsed dataset contains no valid columns.")
        if df.empty:
            # If dataset has valid column headers but 0 rows, synthesize 1 placeholder row
            df = pd.DataFrame([{col: "Unspecified" for col in df.columns}])

        # Save standard CSV copy for fast tabular access
        standard_filename = f"{unique_base}.csv"
        file_path = os.path.join(DATA_DIR, standard_filename)
        df.to_csv(file_path, index=False)

        # 1. Comprehensive Data Hygiene & EDA Audit
        audit = DataCleaner.audit_dataset(df)

        # 2. Schema profiling
        profile = DataProfiler.profile_dataframe(df)

        # 3. Store record in database
        dataset_record = Dataset(
            name=original_name,
            file_path=file_path,
            raw_file_path=raw_file_path,
            file_type=detected_format,
            is_cleaned=audit.get("is_clean", False),
            quality_score=audit.get("quality_score", 100),
            audit_info=audit,
            schema_info=profile
        )
        db.add(dataset_record)
        db.commit()
        db.refresh(dataset_record)

        return {
            "message": "Dataset uploaded and analyzed successfully",
            "dataset": dataset_record,
            "audit": audit,
            "detected_format": detected_format,
            "is_clean": audit.get("is_clean", False),
            "quality_score": audit.get("quality_score", 100),
            "next_step": "proceed_to_analysis" if audit.get("is_clean", False) else "eda_cleaning_recommended"
        }

    except Exception as e:
        # Cleanup on failure
        if os.path.exists(raw_file_path):
            os.remove(raw_file_path)
        raise HTTPException(status_code=400, detail=f"Error ingesting dataset: {str(e)}")

@router.get("/")
def list_datasets(db: Session = Depends(get_db)):
    datasets = db.query(Dataset).order_by(Dataset.id.desc()).all()
    return datasets

@router.get("/{dataset_id}")
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset

@router.get("/{dataset_id}/audit")
def audit_dataset_endpoint(dataset_id: int, db: Session = Depends(get_db)):
    """
    Performs full exploratory data analysis (EDA) and hygiene audit:
    - Missing values (infer, ignore, delete analysis)
    - Duplicate records
    - Incorrect data types (currency, percentages, dates, booleans)
    - Outliers (IQR / Z-scores)
    - Inconsistent formats & whitespace
    - Irrelevant data (empty cols/rows, constant columns)
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = _load_dataframe(dataset)
        audit = DataCleaner.audit_dataset(df)

        # Sync quality score and audit info into DB
        dataset.quality_score = audit.get("quality_score", 100)
        dataset.is_cleaned = audit.get("is_clean", False)
        dataset.audit_info = audit
        db.commit()
        db.refresh(dataset)

        return {
            "dataset_id": dataset_id,
            "name": dataset.name,
            "is_clean": audit.get("is_clean", False),
            "quality_score": audit.get("quality_score", 100),
            "audit": audit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audit failed: {str(e)}")

@router.post("/{dataset_id}/clean")
def clean_dataset_endpoint(dataset_id: int, options: Optional[CleanRequest] = None, db: Session = Depends(get_db)):
    """
    Executes automated data cleaning pipeline:
    01 Remove duplicates
    02 Detect & handle outliers (Cap, Flag, Delete)
    03 Remove irrelevant data
    04 Standardize capitalization & whitespace
    05 Convert data types
    06 Clear formatting & sentinels
    07 Fix errors & casing
    09 Handle missing values (Infer median/mode, Delete, or Ignore)
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        df = _load_dataframe(dataset)
        clean_opts = options.model_dump() if options else {}
        
        cleaned_df, changelog, after_audit = DataCleaner.clean_dataset(df, clean_opts)

        # Save cleaned file back to dataset path (CSV for high compatibility)
        file_path = _resolve_file_path(dataset)
        cleaned_df.to_csv(file_path, index=False)

        # Re-profile dataset schema
        updated_profile = DataProfiler.profile_dataframe(cleaned_df)
        dataset.schema_info = updated_profile
        dataset.is_cleaned = after_audit.get("is_clean", True)
        dataset.quality_score = after_audit.get("quality_score", 100)
        dataset.audit_info = after_audit
        dataset.cleaning_changelog = changelog
        
        db.commit()
        db.refresh(dataset)

        return {
            "message": "Dataset successfully cleaned, normalized, and re-profiled",
            "dataset_id": dataset_id,
            "changelog": changelog,
            "is_clean": after_audit.get("is_clean", True),
            "quality_score": after_audit.get("quality_score", 100),
            "row_count": len(cleaned_df),
            "column_count": len(cleaned_df.columns),
            "audit": after_audit,
            "schema_info": updated_profile
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clean dataset: {str(e)}")

@router.get("/{dataset_id}/export")
def export_dataset(dataset_id: int, format: str = "csv", db: Session = Depends(get_db)):
    """Download cleaned dataset in CSV or Excel format."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = _load_dataframe(dataset)
    clean_name = os.path.splitext(dataset.name)[0]

    if format.lower() == "excel":
        import io
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False)
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{clean_name}_cleaned.xlsx"'}
        )
    else:
        csv_data = df.to_csv(index=False)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{clean_name}_cleaned.csv"'}
        )

@router.get("/{dataset_id}/preview")
def preview_dataset(dataset_id: int, limit: int = 100, db: Session = Depends(get_db)):
    """
    Opens and previews the dataset file in high-performance tabular spreadsheet format:
    Returns column metadata, first N records, total row/column counts, and file details.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = _load_dataframe(dataset)
    file_path = _resolve_file_path(dataset)
    file_size_bytes = os.path.getsize(file_path) if os.path.exists(file_path) else 0

    preview_df = df.head(limit)
    records = json.loads(preview_df.to_json(orient="records", date_format="iso"))

    columns_meta = []
    for col in df.columns:
        dtype_str = str(df[col].dtype)
        null_count = int(df[col].isnull().sum())
        columns_meta.append({
            "name": col,
            "type": dtype_str,
            "null_count": null_count,
            "null_pct": round((null_count / len(df) * 100), 1) if len(df) > 0 else 0
        })

    return {
        "dataset_id": dataset.id,
        "name": dataset.name,
        "file_type": dataset.file_type or "csv",
        "file_size_bytes": file_size_bytes,
        "total_rows": len(df),
        "total_columns": len(df.columns),
        "is_cleaned": dataset.is_cleaned,
        "quality_score": dataset.quality_score or 100,
        "columns": columns_meta,
        "rows": records,
        "preview_limit": limit,
        "download_url": f"http://localhost:8000/api/v1/datasets/{dataset.id}/export?format=csv"
    }

@router.get("/{dataset_id}/suggestions")
def get_dataset_suggestions(dataset_id: int, db: Session = Depends(get_db)):
    """Generate smart, relevant analytical starter questions based on dataset schema."""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    schema = dataset.schema_info or {}
    columns = schema.get("columns", [])
    
    num_cols = [c["name"] for c in columns if "int" in c.get("type", "").lower() or "float" in c.get("type", "").lower()]
    cat_cols = [c["name"] for c in columns if "object" in c.get("type", "").lower() or "string" in c.get("type", "").lower() or "text" in c.get("type", "").lower()]
    date_cols = [c["name"] for c in columns if "date" in c.get("name", "").lower() or "time" in c.get("name", "").lower()]
    
    suggestions = []
    if num_cols:
        target_num = num_cols[-1]
        suggestions.append(f"What is the total and average {target_num.replace('_', ' ')} across all records?")
    
    if cat_cols and num_cols:
        cat = cat_cols[0]
        num = num_cols[-1]
        suggestions.append(f"Show total {num.replace('_', ' ')} grouped by top {cat.replace('_', ' ')}")
    elif cat_cols:
        suggestions.append(f"Count of records per {cat_cols[0].replace('_', ' ')}")
        
    if cat_cols and num_cols:
        cat = cat_cols[-1] if len(cat_cols) > 1 else cat_cols[0]
        num = num_cols[0] if len(num_cols) > 1 else num_cols[-1]
        suggestions.append(f"Which {cat.replace('_', ' ')} generated the highest {num.replace('_', ' ')}?")
        
    if date_cols and num_cols:
        dcol = date_cols[0]
        ncol = num_cols[-1]
        suggestions.append(f"What is the monthly trend of {ncol.replace('_', ' ')} based on {dcol.replace('_', ' ')}?")
    elif len(num_cols) >= 2:
        suggestions.append(f"Compare {num_cols[0].replace('_', ' ')} versus {num_cols[1].replace('_', ' ')}")
    elif cat_cols:
        suggestions.append(f"List the distinct values and frequency of {cat_cols[0].replace('_', ' ')}")
        
    if num_cols:
        suggestions.append(f"Find any statistical outliers or anomalies in {num_cols[-1].replace('_', ' ')}")

    return {"dataset_id": dataset_id, "suggestions": suggestions[:5]}

@router.get("/{dataset_id}/powerbi")
def powerbi_feed(dataset_id: int, format: str = "json", db: Session = Depends(get_db)):
    """
    Direct Live Power BI Web Connector & OData-style feed.
    Connect directly in Power BI Desktop via 'Get Data -> Web'.
    Supports JSON records expansion or raw CSV streaming.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    df = _load_dataframe(dataset)
    clean_name = os.path.splitext(dataset.name)[0]

    if format.lower() == "csv":
        csv_data = df.to_csv(index=False)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f'inline; filename="{clean_name}_powerbi.csv"'}
        )
    else:
        # JSON feed formatted for Power BI Web JSON Table expansion
        clean_records = json.loads(df.head(25000).to_json(orient="records", date_format="iso"))
        return {
            "dataset_id": dataset.id,
            "dataset_name": dataset.name,
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": list(df.columns),
            "data": clean_records,
            "powerbi_instructions": {
                "web_url": f"http://localhost:8000/api/v1/datasets/{dataset.id}/powerbi?format=csv",
                "method": "Get Data -> Web",
                "m_query_hint": "In Power BI, click Get Data -> Web -> paste URL -> Click Load."
            }
        }

@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """
    Purge and permanently remove an unwanted dataset from the registry and disk.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Safely remove disk files if exist
    for path in [dataset.file_path, dataset.raw_file_path]:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass

    db.delete(dataset)
    db.commit()
    return {"status": "success", "message": f"Dataset #{dataset_id} successfully purged"}

