"""Records the estimated cost of every external AI API call as an
ApiUsageRecord (see its docstring for why we count ourselves).

Prices are USD list prices; update PRICES when a model or price changes.
An unknown model is still recorded (tokens/seconds), just at cost 0, and
logged, so a forgotten price shows up instead of silently skewing totals.
Recording must never break the actual feature, so every failure here is
logged and swallowed.
"""
import logging
from decimal import Decimal

from ..models import ApiUsageRecord

logger = logging.getLogger(__name__)

PER_MILLION = Decimal(1_000_000)

# Claude: $ per 1M tokens. Haiku 5.5 charges more once a prompt exceeds
# 100K input tokens ('long_*'); our prompts never come close, but the rate
# is here so a huge import wouldn't be under-counted.
CLAUDE_PRICES = {
    'claude-haiku-5-5': {
        'input': Decimal('0.10'), 'output': Decimal('0.50'),
        'long_threshold': 100_000, 'long_input': Decimal('0.50'), 'long_output': Decimal('2.50'),
    },
}

# OpenAI audio transcription: $ per minute of audio.
WHISPER_PRICES_PER_MINUTE = {
    'whisper-1': Decimal('0.006'),
}


def claude_cost(model, input_tokens, output_tokens):
    price = CLAUDE_PRICES.get(model)
    if price is None:
        logger.warning('API usage: no price configured for Claude model %s, recording cost 0', model)
        return Decimal(0)
    long_prompt = 'long_threshold' in price and input_tokens > price['long_threshold']
    input_rate = price['long_input'] if long_prompt else price['input']
    output_rate = price['long_output'] if long_prompt else price['output']
    return (input_rate * input_tokens + output_rate * output_tokens) / PER_MILLION


def whisper_cost(model, seconds):
    price = WHISPER_PRICES_PER_MINUTE.get(model)
    if price is None:
        logger.warning('API usage: no price configured for OpenAI model %s, recording cost 0', model)
        return Decimal(0)
    return price * Decimal(str(seconds)) / Decimal(60)


def record_claude_call(feature, model, response_data):
    """response_data: the parsed JSON body of a successful Messages API call."""
    try:
        usage = (response_data or {}).get('usage') or {}
        # Cache writes/reads are billed too; we don't use prompt caching, so
        # count them at the plain input rate rather than drop them.
        input_tokens = (
            (usage.get('input_tokens') or 0)
            + (usage.get('cache_creation_input_tokens') or 0)
            + (usage.get('cache_read_input_tokens') or 0)
        )
        output_tokens = usage.get('output_tokens') or 0
        ApiUsageRecord.objects.create(
            provider='anthropic', feature=feature, model=model,
            input_tokens=input_tokens, output_tokens=output_tokens,
            cost_usd=claude_cost(model, input_tokens, output_tokens),
        )
    except Exception:
        logger.exception('API usage: could not record Claude call (%s)', feature)


def record_whisper_call(feature, model, seconds):
    try:
        seconds = float(seconds or 0)
        ApiUsageRecord.objects.create(
            provider='openai', feature=feature, model=model,
            audio_seconds=seconds, cost_usd=whisper_cost(model, seconds),
        )
    except Exception:
        logger.exception('API usage: could not record Whisper call (%s)', feature)
