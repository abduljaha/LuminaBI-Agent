from typing import Dict, Any

class SchemaInspector:
    """Generates a text representation of the schema for the LLM context."""
    
    @staticmethod
    def format_schema(schema_info: Dict[str, Any], table_name: str = "dataset") -> str:
        """
        Converts the JSON schema info from the profiler into a readable text format.
        """
        if not schema_info or "columns" not in schema_info:
            return "No schema information available."
            
        lines = [f"Table: {table_name}"]
        lines.append(f"Total Rows: {schema_info.get('row_count', 'Unknown')}")
        lines.append(f"Total Columns: {schema_info.get('column_count', 'Unknown')}")
        lines.append("\nColumns:")
        
        for col in schema_info["columns"]:
            col_name = col.get("name")
            col_type = col.get("type")
            unique = col.get("unique_values", 0)
            nulls = col.get("null_percentage", 0.0)
            
            line = f"- {col_name} ({col_type}): {unique} unique values, {nulls}% missing."
            
            # Add range for numerics
            if col.get("min") is not None and col.get("max") is not None:
                line += f" Range: [{col.get('min')} to {col.get('max')}]."
                
            lines.append(line)
            
        return "\n".join(lines)
