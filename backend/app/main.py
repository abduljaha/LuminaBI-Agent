from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.db.database import engine, Base
from app.api import datasets, analysis, auth, mcp, board, modeling, recipe, connectors
from app.models.user import User
from app.models.dataset import Dataset
from app.models.board import BoardWidget

# Create database tables and ensure column schema synchronization
Base.metadata.create_all(bind=engine)

def sync_database_schema():
    try:
        with engine.begin() as conn:
            cursor = conn.execute(text("PRAGMA table_info(datasets)"))
            existing_cols = {row[1] for row in cursor.fetchall()}
            
            column_defs = [
                ("raw_file_path", "VARCHAR"),
                ("is_cleaned", "BOOLEAN DEFAULT 0"),
                ("quality_score", "INTEGER DEFAULT 100"),
                ("audit_info", "JSON"),
                ("cleaning_changelog", "JSON")
            ]
            for col_name, col_type in column_defs:
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE datasets ADD COLUMN {col_name} {col_type}"))
    except Exception as e:
        print("Schema sync notice:", e)

sync_database_schema()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for dev
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(datasets.router, prefix=settings.API_V1_STR)
app.include_router(analysis.router, prefix=settings.API_V1_STR)
app.include_router(mcp.router, prefix=settings.API_V1_STR)
app.include_router(board.router, prefix=settings.API_V1_STR)
app.include_router(modeling.router, prefix=settings.API_V1_STR)
app.include_router(recipe.router, prefix=settings.API_V1_STR)
app.include_router(connectors.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
