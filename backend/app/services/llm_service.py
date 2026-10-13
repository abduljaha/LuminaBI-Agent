import logging
from typing import List, Optional
from langchain_openai import ChatOpenAI
from langchain_core.language_models.chat_models import BaseChatModel
from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMProvider:
    @staticmethod
    def get_llm(temperature: float = 0.0) -> BaseChatModel:
        """
        Returns a resilient, high-speed LLM instance configured with automatic multi-model fallback.
        Supports:
        - OpenRouter (Primary model + Free fallback models with 15s timeout)
        - Google Gemini (gemini-2.5-flash with 15s timeout)
        - Direct OpenAI (gpt-4o-mini)
        - Direct Anthropic (if installed and configured)

        If the primary model fails or takes too long, LangChain automatically routes
        to the next fallback model within seconds.
        """
        models: List[BaseChatModel] = []

        # 1. OpenRouter Provider (Fast, highly reliable, zero-credit depletion)
        if settings.OPENROUTER_API_KEY:
            # Verified active free models on OpenRouter
            high_token_free_models = [
                "nvidia/nemotron-3.5-lightning:free",
                "dots-studio/dots-3-note-preview:free",
                "cohere/north-mini-code:free",
                "liquid/lfm-2.5-2.6b:free",
            ]

            primary_model = settings.OPENROUTER_MODEL or high_token_free_models[0]
            configured_models = [primary_model]
            for free_slug in high_token_free_models:
                if free_slug not in configured_models:
                    configured_models.append(free_slug)

            for model_slug in configured_models:
                models.append(
                    ChatOpenAI(
                        model=model_slug,
                        api_key=settings.OPENROUTER_API_KEY,
                        base_url="https://openrouter.ai/api/v1",
                        temperature=temperature,
                        request_timeout=15.0,
                        max_retries=1,
                        default_headers={
                            "HTTP-Referer": "http://localhost:8000",
                            "X-Title": settings.PROJECT_NAME
                        }
                    )
                )

        # 2. Google Gemini (Fast direct native API)
        if settings.GEMINI_API_KEY:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                gemini_candidates = [
                    "gemini-2.5-flash",
                ]
                for g_model in gemini_candidates:
                    models.append(
                        ChatGoogleGenerativeAI(
                            temperature=temperature,
                            model=g_model,
                            google_api_key=settings.GEMINI_API_KEY,
                            timeout=15.0,
                            max_retries=1
                        )
                    )
            except Exception as e:
                logger.warning(f"Failed to initialize Gemini candidate: {e}")

        # 3. Direct OpenAI
        if settings.OPENAI_API_KEY:
            try:
                models.append(
                    ChatOpenAI(
                        temperature=temperature,
                        model_name="gpt-4o-mini",
                        api_key=settings.OPENAI_API_KEY,
                        request_timeout=15.0,
                        max_retries=1
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to initialize OpenAI candidate: {e}")

        # 4. Anthropic (optional)
        if settings.ANTHROPIC_API_KEY:
            try:
                from langchain_anthropic import ChatAnthropic
                models.append(
                    ChatAnthropic(
                        temperature=temperature,
                        model_name="claude-3-haiku-20240307",
                        api_key=settings.ANTHROPIC_API_KEY,
                        timeout=15.0,
                        max_retries=1
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to initialize Anthropic candidate: {e}")

        if not models:
            raise ValueError(
                "No valid LLM credentials found. Please set OPENROUTER_API_KEY, GEMINI_API_KEY, "
                "or OPENAI_API_KEY in backend/.env"
            )

        # If only one model configured, return it directly
        primary = models[0]
        fallbacks = models[1:]

        if fallbacks:
            logger.info(f"Configured primary LLM ({getattr(primary, 'model_name', getattr(primary, 'model', 'default'))}) with {len(fallbacks)} fallback model(s).")
            return primary.with_fallbacks(fallbacks)

        return primary

