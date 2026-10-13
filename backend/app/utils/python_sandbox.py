import pandas as pd
import numpy as np
from typing import Dict, Any

class PythonSandbox:
    @staticmethod
    def execute_analysis(df: pd.DataFrame, code: str) -> Dict[str, Any]:
        """
        Executes generated Python code in a restricted environment.
        The code is expected to define a variable named 'result' containing the output dictionary.
        """
        allowed_globals = {
            "pd": pd,
            "np": np,
            "df": df,
            "result": None
        }
        
        # Simple static checks for restricted modules
        forbidden = ["import os", "import subprocess", "import sys", "exec(", "eval("]
        for f in forbidden:
            if f in code:
                raise ValueError(f"Unsafe code execution blocked: {f} is not allowed.")
        
        try:
            exec(code, allowed_globals)
            # Ensure the code populated the result variable
            raw_result = allowed_globals.get("result", {"message": "Code executed but no 'result' variable was set."})
            return PythonSandbox._sanitize(raw_result)
        except Exception as e:
            raise RuntimeError(f"Python execution error: {str(e)}")

    @staticmethod
    def _sanitize(obj: Any) -> Any:
        """Recursively converts NumPy and Pandas types to standard Python primitives."""
        if isinstance(obj, dict):
            return {str(k): PythonSandbox._sanitize(v) for k, v in obj.items()}
        elif isinstance(obj, (list, tuple, set)):
            return [PythonSandbox._sanitize(item) for item in obj]
        elif isinstance(obj, (np.integer, np.int64, np.int32)):
            return int(obj)
        elif isinstance(obj, (np.floating, np.float64, np.float32)):
            return float(obj)
        elif isinstance(obj, (np.bool_, bool)):
            return bool(obj)
        elif isinstance(obj, (pd.Series, pd.DataFrame)):
            return PythonSandbox._sanitize(obj.to_dict())
        elif isinstance(obj, np.ndarray):
            return PythonSandbox._sanitize(obj.tolist())
        return obj
