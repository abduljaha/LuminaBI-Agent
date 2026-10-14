import os
import time
import uuid
import pandas as pd
from typing import Dict, Any, List, Optional
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session
from app.models.dataset import Dataset
from app.data.profiler import DataProfiler
from app.data.cleaner import DataCleaner

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data")
os.makedirs(DATA_DIR, exist_ok=True)

class DatabaseConnectorService:
    @staticmethod
    def _build_connection_uri(
        db_type: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        database: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        file_path: Optional[str] = None
    ) -> str:
        db_type = db_type.lower()
        if db_type == "sqlite":
            p = file_path or database or ":memory:"
            # Handle relative paths
            if not os.path.isabs(p) and p != ":memory:":
                p = os.path.abspath(p)
            return f"sqlite:///{p}"
        elif db_type in ["postgres", "postgresql"]:
            port = port or 5432
            auth = f"{username}:{password}@" if username and password else (f"{username}@" if username else "")
            return f"postgresql+psycopg2://{auth}{host}:{port}/{database}"
        elif db_type == "mysql":
            port = port or 3306
            auth = f"{username}:{password}@" if username and password else (f"{username}@" if username else "")
            return f"mysql+pymysql://{auth}{host}:{port}/{database}"
        else:
            raise ValueError(f"Unsupported database provider: {db_type}")

    @classmethod
    def test_connection(
        cls,
        db_type: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        database: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validates database connectivity and computes roundtrip latency."""
        start_time = time.time()
        uri = cls._build_connection_uri(db_type, host, port, database, username, password, file_path)
        
        try:
            engine = create_engine(uri, connect_args={"timeout": 5} if "sqlite" in uri else {})
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            latency_ms = round((time.time() - start_time) * 1000, 2)
            return {
                "success": True,
                "latency_ms": latency_ms,
                "message": f"Successfully connected to {db_type.upper()} in {latency_ms}ms"
            }
        except Exception as e:
            # Check for driver issues or connection refusals
            err_msg = str(e)
            if "psycopg2" in err_msg or "pymysql" in err_msg:
                # Provide helpful notice
                return {
                    "success": False,
                    "latency_ms": 0,
                    "message": f"Database driver notice: {err_msg}. Please install required driver or test with SQLite/Mock."
                }
            return {
                "success": False,
                "latency_ms": 0,
                "message": f"Connection failed: {err_msg}"
            }

    @classmethod
    def introspect_tables(
        cls,
        db_type: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        database: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        file_path: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Introspects remote database and returns list of tables with columns and types."""
        uri = cls._build_connection_uri(db_type, host, port, database, username, password, file_path)
        engine = create_engine(uri)
        inspector = inspect(engine)

        table_names = inspector.get_table_names()
        results = []

        with engine.connect() as conn:
            for t_name in table_names:
                try:
                    columns = inspector.get_columns(t_name)
                    # Attempt row count
                    try:
                        count_res = conn.execute(text(f"SELECT COUNT(*) FROM {t_name}")).scalar()
                        row_count = int(count_res) if count_res is not None else 0
                    except Exception:
                        row_count = 0

                    col_list = [{"name": c["name"], "type": str(c["type"])} for c in columns]
                    results.append({
                        "table_name": t_name,
                        "row_count": row_count,
                        "column_count": len(col_list),
                        "columns": col_list
                    })
                except Exception:
                    pass

        return results

    @classmethod
    def preview_table(
        cls,
        db_type: str,
        table_name: str,
        host: Optional[str] = None,
        port: Optional[int] = None,
        database: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        file_path: Optional[str] = None,
        limit: int = 20
    ) -> Dict[str, Any]:
        """Fetches top N preview rows from remote database table."""
        uri = cls._build_connection_uri(db_type, host, port, database, username, password, file_path)
        engine = create_engine(uri)
        
        with engine.connect() as conn:
            query = f"SELECT * FROM {table_name} LIMIT {limit}"
            df = pd.read_sql(query, conn)

        return {
            "columns": df.columns.tolist(),
            "rows": df.to_dict(orient="records"),
            "row_count": len(df)
        }

    @classmethod
    def import_table_as_dataset(
        cls,
        db_session: Session,
        db_type: str,
        table_name: str,
        custom_name: Optional[str] = None,
        host: Optional[str] = None,
        port: Optional[int] = None,
        database: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        file_path: Optional[str] = None,
        query: Optional[str] = None
    ) -> Dataset:
        """
        Pulls remote table data directly into LuminaBI's local DuckDB storage,
        executes automated EDA profiling & quality hygiene scoring, and registers as dataset.
        """
        uri = cls._build_connection_uri(db_type, host, port, database, username, password, file_path)
        engine = create_engine(uri)

        sql_to_run = query if query and query.strip() else f"SELECT * FROM {table_name}"
        
        with engine.connect() as conn:
            df = pd.read_sql(sql_to_run, conn)

        if df.empty:
            raise ValueError(f"Table '{table_name}' contains no records.")

        unique_id = uuid.uuid4().hex[:8]
        safe_name = custom_name or f"{db_type}_{table_name}"
        clean_file_name = f"imported_{unique_id}_{table_name}.csv"
        raw_file_name = f"raw_{unique_id}_{table_name}.csv"
        
        clean_path = os.path.join(DATA_DIR, clean_file_name)
        raw_path = os.path.join(DATA_DIR, raw_file_name)

        # Save raw & clean working copies
        df.to_csv(raw_path, index=False)
        
        # Run standard cleaner
        cleaned_df, cleaning_info = DataCleaner.clean(df)
        cleaned_df.to_csv(clean_path, index=False)

        # Profile schema & quality audit
        schema_info = DataProfiler.profile(cleaned_df)
        audit_info = DataCleaner.audit_hygiene(df)
        quality_score = audit_info.get("overall_score", 100)

        dataset = Dataset(
            name=safe_name,
            description=f"Imported from {db_type.upper()} ({table_name}) with {len(df)} records.",
            file_path=clean_path,
            raw_file_path=raw_path,
            file_type="database",
            is_cleaned=True,
            quality_score=quality_score,
            audit_info=audit_info,
            cleaning_changelog={"pipeline": cleaning_info},
            schema_info=schema_info
        )

        db_session.add(dataset)
        db_session.commit()
        db_session.refresh(dataset)
        return dataset
