from __future__ import annotations

import logging

from config.settings import Config
from models.schemas import ContextPacket
from services.context_builder import (
    build_anthropic_request,
    response_numbers_are_grounded,
    truncate_to_sentence,
)

logger = logging.getLogger(__name__)


class AIExplanationService:
    def __init__(self, config: Config) -> None:
        self._config = config
        self._client = config.get_anthropic_client()

    def generate_explanation(self, packet: ContextPacket) -> str | None:
        if self._client is None:
            return None

        request_payload = build_anthropic_request(
            packet=packet,
            max_tokens=self._config.ANTHROPIC_MAX_TOKENS,
        )
        try:
            response = self._client.messages.create(
                model=self._config.ANTHROPIC_MODEL,
                **request_payload,
            )
        except Exception as exc:  # pragma: no cover
            logger.warning("Anthropic request failed: %s", exc)
            return None

        text_parts = []
        for block in getattr(response, "content", []):
            block_text = getattr(block, "text", None)
            if block_text:
                text_parts.append(block_text)
        narrative = truncate_to_sentence(" ".join(text_parts).strip())
        if not narrative:
            return None
        if not response_numbers_are_grounded(narrative, packet):
            logger.warning("Discarding AI narrative due to ungrounded numeric content.")
            return None
        return narrative
