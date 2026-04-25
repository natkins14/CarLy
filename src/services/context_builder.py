from __future__ import annotations

import json
import re
from typing import Any

from models.schemas import ContextPacket, PaymentResult, VehicleRecord


SYSTEM_PROMPT = (
    "You are a helpful car-buying advisor. "
    "Explain the provided payment estimate in plain language. "
    "Do not recalculate any numbers. "
    "Do not recommend a lender, dealer, or a financial product. "
    "Keep the response under 150 words and acknowledge that dealer quotes may differ."
)


def build_context_packet(
    vehicle: VehicleRecord,
    payment_result: PaymentResult,
    credit_tier: str,
    purchase_type: str,
) -> ContextPacket:
    return ContextPacket(
        vehicle=vehicle,
        payment_result=payment_result,
        user_context={
            "credit_tier": credit_tier,
            "purchase_type": purchase_type,
        },
    )


def serialize_context_packet(packet: ContextPacket) -> str:
    return json.dumps(packet.model_dump(mode="json"), sort_keys=True)


def response_numbers_are_grounded(response_text: str, packet: ContextPacket) -> bool:
    packet_json = serialize_context_packet(packet)
    numbers = re.findall(r"\d+(?:\.\d+)?", response_text)
    return all(number in packet_json for number in numbers)


def truncate_to_sentence(text: str, max_chars: int = 800) -> str:
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    last_period = truncated.rfind(".")
    if last_period > 0:
        return truncated[: last_period + 1]
    return truncated.strip()


def build_anthropic_request(packet: ContextPacket, max_tokens: int) -> dict[str, Any]:
    return {
        "system": SYSTEM_PROMPT,
        "messages": [
            {
                "role": "user",
                "content": serialize_context_packet(packet),
            }
        ],
        "max_tokens": max_tokens,
        "temperature": 0.3,
    }
