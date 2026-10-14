from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.services.database_connector import DatabaseConnectorService

router = APIRouter(prefix="/connectors", tags=["connectors"])

class ConnectionRequest(BaseModel):
    db_type: str = "sqlite" # sqlite, postgres, mysql
    host: Optional[str] = "localhost"
    port: Optional[int] = None
    database: Optional[str] = "data_analyst.db"
    username: Optional[str] = None
    password: Optional[str] = None
    file_path: Optional[str] = None

class PreviewRequest(ConnectionRequest):
    table_name: str
    limit: Optional[int] = 20

class ImportRequest(ConnectionRequest):
    table_name: str
    custom_name: Optional[str] = None
    custom_query: Optional[str] = None

@router.post("/test")
def test_connection(req: ConnectionRequest):
    """Tests connection to remote or local database and measures ping latency."""
    res = DatabaseConnectorService.test_connection(
        db_type=req.db_type,
        host=req.host,
        port=req.port,
        database=req.database,
        username=req.username,
        password=req.password,
        file_path=req.file_path
    )
    if not res["success"]:
        raise HTTPException(status_code=400, detail=res["message"])
    return res

@router.post("/tables")
def introspect_tables(req: ConnectionRequest):
    """Returns list of tables, schemas, and estimated row counts from database."""
    try:
        tables = DatabaseConnectorService.introspect_tables(
            db_type=req.db_type,
            host=req.host,
            port=req.port,
            database=req.database,
            username=req.username,
            password=req.password,
            file_path=req.file_path
        )
        return {"tables": tables}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Schema introspection failed: {str(e)}")

@router.post("/preview")
def preview_table(req: PreviewRequest):
    """Previews top rows from a selected database table."""
    try:
        data = DatabaseConnectorService.preview_table(
            db_type=req.db_type,
            table_name=req.table_name,
            host=req.host,
            port=req.port,
            database=req.database,
            username=req.username,
            password=req.password,
            file_path=req.file_path,
            limit=req.limit or 20
        )
        return data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Table preview failed: {str(e)}")

@router.post("/import")
def import_table(req: ImportRequest, db: Session = Depends(get_db)):
    """Imports remote database table directly into LuminaBI DuckDB workspace."""
    try:
        dataset = DatabaseConnectorService.import_table_as_dataset(
            db_session=db,
            db_type=req.db_type,
            table_name=req.table_name,
            custom_name=req.custom_name,
            host=req.host,
            port=req.port,
            database=req.database,
            username=req.username,
            password=req.password,
            file_path=req.file_path,
            query=req.custom_query
        )
        return {
            "message": f"Successfully imported '{req.table_name}' into workspace",
            "dataset_id": dataset.id,
            "name": dataset.name,
            "quality_score": dataset.quality_score
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")
