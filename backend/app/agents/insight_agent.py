from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.services.llm_service import LLMProvider

class InsightAgent:
    @staticmethod
    def generate_insights(user_query: str, query_result: dict, python_result: dict, anomalies: list, history: list = None) -> str:
        history_context = ""
        if history and len(history) > 0:
            history_lines = [f"{msg.get('role', 'user').capitalize()}: {msg.get('content', '')}" for msg in history[-4:]]
            history_context = "\n\nPrevious Conversation Context (for conversational continuity):\n" + "\n".join(history_lines)

        prompt = ChatPromptTemplate.from_messages([
            ("system", "You are an expert Business Analyst.\n"
                       "Your task is to answer the user's question by combining the data provided.\n"
                       "Rules:\n"
                       "1. Provide a clear, executive summary answer in Markdown.\n"
                       "2. Use evidence from the data to back up every claim.\n"
                       "3. Highlight significant statistical findings or anomalies if present.\n"
                       "4. Provide 1-2 actionable recommendations based on the findings.\n"
                       "5. DO NOT invent numbers or claim causality without data.\n\n"
                       "Data Results: {query_result}\n"
                       "Python Analysis: {python_result}\n"
                       "Anomalies: {anomalies}"
                       "{history_context}"),
            ("user", "{user_query}")
        ])
        
        llm = LLMProvider.get_llm(temperature=0.0)
        chain = prompt | llm | StrOutputParser()
        
        # Limit rows sent to LLM to avoid context limits
        sample_data = str(query_result.get("rows", [])[:20])
        
        return chain.invoke({
            "user_query": user_query,
            "query_result": sample_data,
            "python_result": str(python_result),
            "anomalies": str(anomalies),
            "history_context": history_context
        })
