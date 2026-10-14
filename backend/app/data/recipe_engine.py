import re
import os
import json
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from app.services.llm_service import LLMProvider
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

class RecipeEngine:
    @staticmethod
    def parse_and_apply_transformation(
        df: pd.DataFrame, 
        prompt_text: str
    ) -> Tuple[pd.DataFrame, Dict[str, Any]]:
        """
        Interprets natural language feature engineering / transformation instruction,
        synthesizes executable, safe Pandas code, applies it, and returns the modified DataFrame
        along with recipe step metadata.
        """
        cols_summary = ", ".join([f"'{c}' ({str(d)})" for c, d in zip(df.columns, df.dtypes)])
        sample_rows = df.head(3).to_dict(orient="records")

        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert Data Engineer & Python Pandas specialist.\n"
                       "Generate a safe, vectorized Python Pandas code snippet to transform the DataFrame named `df` according to the user's instructions.\n\n"
                       "Rules:\n"
                       "1. Return ONLY valid Python code that operates on `df` in-place or assigns back to `df`.\n"
                       "2. Do NOT import malicious packages, do NOT access files or networks.\n"
                       "3. Keep changes clean and robust against NaNs.\n"
                       "4. Include a 1-sentence comment at the very top starting with `# Description: <human readable explanation>`.\n"
                       "5. Provide ONLY the code block, no markdown fences (no ```python).\n\n"
                       "Available Columns:\n{cols_summary}\n"
                       "Sample Data:\n{sample_rows}"),
            ("user", "{user_instruction}")
        ])

        llm = LLMProvider.get_llm(temperature=0.0)
        chain = prompt | llm | StrOutputParser()

        raw_code = chain.invoke({
            "cols_summary": cols_summary,
            "sample_rows": str(sample_rows),
            "user_instruction": prompt_text
        })

        clean_code = raw_code.replace("```python", "").replace("```", "").strip()

        # Extract description comment
        desc = prompt_text
        for line in clean_code.splitlines():
            if line.startswith("# Description:"):
                desc = line.replace("# Description:", "").strip()
                break

        # Execute safely in controlled scope
        local_scope = {"df": df.copy(), "pd": pd, "np": pd.np if hasattr(pd, 'np') else __import__('numpy')}
        
        # Block dangerous builtins
        restricted_globals = {
            "__builtins__": {
                "range": range, "len": len, "float": float, "int": int, "str": str,
                "bool": bool, "list": list, "dict": dict, "set": set, "tuple": tuple,
                "min": min, "max": max, "sum": sum, "round": round, "abs": abs,
                "zip": zip, "enumerate": enumerate, "isinstance": isinstance
            }
        }

        try:
            exec(clean_code, restricted_globals, local_scope)
            transformed_df = local_scope["df"]
            
            # Detect what columns changed or were added
            new_cols = [c for c in transformed_df.columns if c not in df.columns]
            dropped_cols = [c for c in df.columns if c not in transformed_df.columns]

            step_metadata = {
                "instruction": prompt_text,
                "description": desc,
                "code": clean_code,
                "new_columns": new_cols,
                "dropped_columns": dropped_cols,
                "rows_before": len(df),
                "rows_after": len(transformed_df)
            }

            return transformed_df, step_metadata
        except Exception as e:
            raise ValueError(f"Failed to execute transformation: {str(e)}\nGenerated code:\n{clean_code}")

    @staticmethod
    def generate_python_script(dataset_name: str, steps: List[Dict[str, Any]]) -> str:
        """
        Generates a clean, standalone, production-ready Python ETL script
        reproducing all recipe steps for data engineering pipelines.
        """
        lines = [
            f"# ====================================================================",
            f"# LuminaBI Autonomous Feature Engineering & Data Pipeline",
            f"# Dataset: {dataset_name}",
            f"# Generated: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"# ====================================================================",
            "",
            "import pandas as pd",
            "import numpy as np",
            "",
            "def run_pipeline(input_path: str) -> pd.DataFrame:",
            "    print(f'Loading raw dataset from {input_path}...')",
            "    df = pd.read_csv(input_path) if input_path.endswith('.csv') else pd.read_excel(input_path)",
            "    print(f'Initial shape: {df.shape}')",
            ""
        ]

        for idx, step in enumerate(steps, 1):
            desc = step.get("description", step.get("instruction", f"Step {idx}"))
            code = step.get("code", "").strip()
            lines.append(f"    # Step {idx}: {desc}")
            for c_line in code.splitlines():
                if not c_line.startswith("# Description:"):
                    lines.append(f"    {c_line}")
            lines.append(f"    print('Step {idx} complete. Current shape:', df.shape)")
            lines.append("")

        lines.extend([
            "    return df",
            "",
            "if __name__ == '__main__':",
            "    output_df = run_pipeline('input_data.csv')",
            "    output_df.to_csv('transformed_output.csv', index=False)",
            "    print('Data pipeline successfully executed. Saved to transformed_output.csv')"
        ])

        return "\n".join(lines)
