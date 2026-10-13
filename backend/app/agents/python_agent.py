from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.services.llm_service import LLMProvider

class PythonAgent:
    @staticmethod
    def generate_analysis_code(user_query: str, columns: list, rows_sample: list) -> str:
        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert Python Data Analyst.\n"
                       "A Pandas DataFrame named `df` containing the results of a SQL query is provided to you.\n"
                       "Write Python code using Pandas/NumPy to further analyze `df` and answer the user's question.\n"
                       "You must store the final analysis output (e.g. statistics, insights) in a dictionary variable named `result`.\n"
                       "Return ONLY raw python code. No markdown formatting, no explanations.\n\n"
                       "Available Columns: {columns}\n"
                       "Data Sample: {sample}"),
            ("user", "{user_query}")
        ])
        
        llm = LLMProvider.get_llm(temperature=0.0)
        chain = prompt | llm | StrOutputParser()
        
        code = chain.invoke({
            "columns": columns,
            "sample": str(rows_sample[:2]),
            "user_query": user_query
        })
        
        return code.replace("```python", "").replace("```", "").strip()
