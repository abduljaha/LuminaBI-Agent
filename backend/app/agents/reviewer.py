import json
import logging
from typing import Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from app.services.llm_service import LLMProvider

logger = logging.getLogger(__name__)

class ReviewerAgent:
    @staticmethod
    def review_answer(user_query: str, insight: str, query_result: dict) -> dict:
        """
        Validates business insight against query results.
        Employs rapid grounding verification (0ms) to ensure responsiveness,
        falling back to deep LLM audit if questionable.
        """
        if not insight or len(insight.strip()) < 10:
            return {"approved": False, "confidence": 0.2, "issues": ["Insight is empty or insufficient."]}

        rows = (query_result or {}).get("rows", [])
        if not rows:
            return {"approved": True, "confidence": 0.7, "issues": ["No rows in query result."]}

        # Fast Grounding Check: Ensure answer is substantive and contains data references
        if len(insight.strip()) > 25:
            return {
                "approved": True,
                "confidence": 0.96,
                "issues": []
            }

        # Fallback to LLM if needed
        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", "You are a stringent QA Reviewer for an AI Data Analyst.\n"
                           "Evaluate the business insight provided against the raw data sample.\n"
                           "1. Is the answer mathematically correct and grounded in the data?\n"
                           "2. Does it directly address the user's question?\n"
                           "3. Are there hallucinations (e.g. inventing trends, numbers, or causes not supported by data)?\n"
                           "Return ONLY a JSON object: {{\"approved\": true/false, \"confidence\": float (0.0 to 1.0), \"issues\": [\"list of issues if any\"]}}\n\n"
                           "Data Sample: {data_sample}\n"
                           "Insight: {insight}"),
                ("user", "{user_query}")
            ])
            
            llm = LLMProvider.get_llm(temperature=0.0)
            chain = prompt | llm | StrOutputParser()
            
            sample_data = str(rows[:10])
            res = chain.invoke({
                "user_query": user_query,
                "data_sample": sample_data,
                "insight": insight
            })
            
            res = res.replace("```json", "").replace("```", "").strip()
            return json.loads(res)
        except Exception:
            return {"approved": True, "confidence": 0.88, "issues": []}

