import re
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.services.llm_service import LLMProvider

class SQLAgent:
    @staticmethod
    def generate_sql(user_query: str, schema: str, table_name: str = "dataset", history: list = None) -> str:
        history_context = ""
        if history and len(history) > 0:
            history_lines = [f"{msg.get('role', 'user').capitalize()}: {msg.get('content', '')}" for msg in history[-6:]]
            history_context = "\n\nPrevious Conversation Context (for reference):\n" + "\n".join(history_lines)

        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert SQL Data Analyst. Your task is to generate a SQLite query to answer the user's question based on the provided schema.\n\n"
                       "Rules:\n"
                       "1. Return ONLY the raw SQL query, no markdown formatting (e.g. ```sql...```), no explanations.\n"
                       "2. Use only the columns provided in the schema.\n"
                       "3. The table name is '{table_name}'.\n"
                       "4. CRITICAL: SQLite string equality (`=`) is strictly CASE-SENSITIVE. When filtering string or categorical columns (e.g. names, categories, status), ALWAYS perform case-insensitive comparison using `LOWER(column) = LOWER('value')` or `column LIKE 'value'`. For example, `WHERE LOWER(product_category) = 'rony'` or `WHERE product_category LIKE 'rony'`.\n"
                       "5. When computing numeric aggregates like `SUM(column)` or `AVG(column)`, wrap them with `COALESCE(SUM(column), 0)` so it returns 0 instead of NULL when no rows match.\n"
                       "6. Ensure correct SQLite syntax (e.g., handling dates).\n"
                       "7. Do NOT use destructive commands.\n\n"
                       "Schema:\n{schema}"
                       "{history_context}"),
            ("user", "{user_query}")
        ])
        
        llm = LLMProvider.get_llm(temperature=0.0)
        chain = prompt | llm | StrOutputParser()
        
        result = chain.invoke({
            "schema": schema,
            "user_query": user_query,
            "table_name": table_name,
            "history_context": history_context
        })
        
        # Clean up possible markdown if the LLM ignores instructions
        result = result.replace("```sql", "").replace("```", "").strip()
        return result
