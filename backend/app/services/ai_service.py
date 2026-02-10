"""AI document understanding service using Claude API."""

import base64
import json
import logging

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
あなたは日本語の事務書類を分析する専門家です。
OCRで読み取ったテキストを分析し、以下の情報を抽出してください。
必ず以下のJSON形式で回答してください。JSON以外のテキストは含めないでください。

{
  "category": "書類の分類（以下から1つ選択: 契約書, 請求書, 見積書, 納品書, 報告書, 議事録, 通知書, 申請書, 証明書, 履歴書, その他）",
  "category_confidence": 0.95,
  "summary": "書類の要約（日本語で2-3文）",
  "tags": ["関連タグ1", "関連タグ2", "関連タグ3"],
  "entities": {
    "people": ["人名1", "人名2"],
    "organizations": ["組織名1", "組織名2"],
    "dates": ["2024年1月1日", "令和6年1月1日"],
    "amounts": ["¥100,000", "$1,000"],
    "addresses": ["住所1"],
    "references": ["文書番号や参照番号"]
  },
  "language": "ja",
  "document_date": "書類の日付（YYYY-MM-DD形式、不明ならnull）",
  "key_points": ["重要ポイント1", "重要ポイント2"]
}
"""

ANALYSIS_PROMPT = """\
以下はOCRで読み取った書類のテキストです。この書類を分析してください。

--- OCR テキスト ---
{ocr_text}
--- テキスト終了 ---

上記の書類を分析し、指定されたJSON形式で回答してください。
テキストが不明瞭な箇所がある場合は、前後の文脈から推測してください。
"""

VISION_ANALYSIS_PROMPT = """\
この書類画像を分析してください。OCRで読み取ったテキストも参考にしてください。

--- OCR テキスト（参考） ---
{ocr_text}
--- テキスト終了 ---

書類画像とOCRテキストの両方を参照して、指定されたJSON形式で回答してください。
"""


def _get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def analyze_document_text(ocr_text: str) -> dict | None:
    """
    Analyze document using OCR text only (no image).
    Returns parsed AI analysis result or None on failure.
    """
    if not settings.ai_enabled or not settings.anthropic_api_key:
        logger.info("AI analysis skipped (disabled or no API key)")
        return None

    if not ocr_text or len(ocr_text.strip()) < 10:
        logger.info("AI analysis skipped (text too short)")
        return None

    # Truncate very long texts to stay within token limits
    max_chars = 15000
    text = ocr_text[:max_chars] if len(ocr_text) > max_chars else ocr_text

    try:
        client = _get_client()
        response = client.messages.create(
            model=settings.ai_model,
            max_tokens=settings.ai_max_tokens,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": ANALYSIS_PROMPT.format(ocr_text=text),
                }
            ],
        )

        return _parse_response(response)

    except Exception as e:
        logger.exception(f"AI text analysis failed: {e}")
        return None


def analyze_document_with_image(
    ocr_text: str,
    image_bytes: bytes,
    media_type: str = "image/png",
) -> dict | None:
    """
    Analyze document using both OCR text and page image (Vision).
    Returns parsed AI analysis result or None on failure.
    """
    if not settings.ai_enabled or not settings.anthropic_api_key:
        logger.info("AI analysis skipped (disabled or no API key)")
        return None

    text = ocr_text[:15000] if ocr_text and len(ocr_text) > 15000 else (ocr_text or "")

    try:
        client = _get_client()
        image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

        response = client.messages.create(
            model=settings.ai_model,
            max_tokens=settings.ai_max_tokens,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": VISION_ANALYSIS_PROMPT.format(ocr_text=text),
                        },
                    ],
                }
            ],
        )

        return _parse_response(response)

    except Exception as e:
        logger.exception(f"AI vision analysis failed: {e}")
        return None


def _parse_response(response) -> dict | None:
    """Extract and parse JSON from Claude response."""
    if not response.content:
        return None

    raw_text = response.content[0].text.strip()

    # Try to extract JSON from the response
    # Handle cases where response might have markdown code blocks
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        json_lines = []
        in_block = False
        for line in lines:
            if line.startswith("```") and not in_block:
                in_block = True
                continue
            elif line.startswith("```") and in_block:
                break
            elif in_block:
                json_lines.append(line)
        raw_text = "\n".join(json_lines)

    try:
        result = json.loads(raw_text)
        # Validate expected fields
        if "category" not in result:
            logger.warning("AI response missing 'category' field")
            return None
        return result
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse AI response as JSON: {e}")
        logger.debug(f"Raw response: {raw_text[:500]}")
        return None
