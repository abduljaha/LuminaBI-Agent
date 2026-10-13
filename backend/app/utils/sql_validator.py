import re

class SQLValidator:
    """Validates SQL to prevent destructive operations."""
    
    FORBIDDEN_KEYWORDS = [
        "DROP", "DELETE", "UPDATE", "INSERT", "ALTER", 
        "TRUNCATE", "CREATE", "GRANT", "REVOKE", "MERGE"
    ]
    
    @classmethod
    def validate(cls, sql_query: str) -> bool:
        """
        Validates the SQL query. 
        Returns True if safe, raises ValueError if unsafe.
        """
        # Remove comments to avoid false positives/negatives
        sql_clean = re.sub(r'--.*$', '', sql_query, flags=re.MULTILINE)
        sql_clean = re.sub(r'/\*.*?\*/', '', sql_clean, flags=re.DOTALL)
        
        # Tokenize roughly
        tokens = [token.upper() for token in re.findall(r'\b\w+\b', sql_clean)]
        
        for keyword in cls.FORBIDDEN_KEYWORDS:
            if keyword in tokens:
                raise ValueError(f"Unsafe SQL detected: {keyword} operations are not allowed.")
                
        # Ensure it contains a SELECT or WITH statement
        if "SELECT" not in tokens and "WITH" not in tokens:
            raise ValueError("SQL query must be a SELECT statement.")
            
        return True
