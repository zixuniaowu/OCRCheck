"""OCR processing using RapidOCR (ONNX Runtime) for Japanese text recognition."""

import logging
import os
import numpy as np
import cv2
from PIL import Image

logger = logging.getLogger(__name__)

# Lazy-loaded global OCR engine instance
_ocr_engine = None

# Model paths (set by Dockerfile.worker multi-stage build)
_MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "models")
_REC_MODEL = os.path.join(_MODEL_DIR, "japan_PP-OCRv3_rec.onnx")
_REC_DICT = os.path.join(_MODEL_DIR, "japan_dict.txt")


def get_ocr_engine():
    """Lazy-initialize RapidOCR engine with Japanese recognition model."""
    global _ocr_engine
    if _ocr_engine is None:
        from rapidocr_onnxruntime import RapidOCR

        _ocr_engine = RapidOCR(
            rec_model_path=_REC_MODEL,
            rec_keys_path=_REC_DICT,
        )
        logger.info("RapidOCR engine initialized (Japan PP-OCRv3 rec model)")
    return _ocr_engine


def ocr_image(img: Image.Image) -> dict:
    """
    Run OCR on a single page image.
    Returns:
        {
            "full_text": str,
            "blocks": [{"text": str, "bbox": [x1,y1,x2,y2], "confidence": float}],
            "confidence": float,
        }
    """
    engine = get_ocr_engine()
    img_array = np.array(img)
    result, _elapse = engine(img_array)

    blocks = []
    texts = []
    confidences = []

    if result:
        for line in result:
            bbox_points, text, conf = line

            # Convert 4-point bbox to [x_min, y_min, x_max, y_max]
            xs = [p[0] for p in bbox_points]
            ys = [p[1] for p in bbox_points]
            bbox = [min(xs), min(ys), max(xs), max(ys)]

            blocks.append({
                "text": text,
                "bbox": [round(v, 1) for v in bbox],
                "confidence": round(conf, 4),
            })
            texts.append(text)
            confidences.append(conf)

    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    return {
        "full_text": "\n".join(texts),
        "blocks": blocks,
        "confidence": round(avg_confidence, 4),
    }


def _detect_lines(img_array: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Detect horizontal and vertical lines using morphological operations."""
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY) if len(img_array.shape) == 3 else img_array
    h, w = gray.shape[:2]

    # Adaptive threshold for varied lighting
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 15, 5
    )

    # Horizontal lines: kernel width proportional to image width
    h_kernel_len = max(w // 15, 40)
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (h_kernel_len, 1))
    h_mask = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel, iterations=2)

    # Vertical lines: kernel height proportional to image height
    v_kernel_len = max(h // 30, 20)
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, v_kernel_len))
    v_mask = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel, iterations=2)

    return h_mask, v_mask


def _extract_line_segments(mask: np.ndarray, direction: str) -> list[dict]:
    """Convert binary mask to line segment coordinates."""
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    lines = []
    for cnt in contours:
        x, y, bw, bh = cv2.boundingRect(cnt)
        if direction == "horizontal":
            # Filter: width must be significantly larger than height
            if bw > bh * 3 and bw > 30:
                lines.append({"y": y + bh // 2, "x1": x, "x2": x + bw, "width": bw})
        else:
            # Filter: height must be significantly larger than width
            if bh > bw * 3 and bh > 15:
                lines.append({"x": x + bw // 2, "y1": y, "y2": y + bh, "height": bh})
    return lines


def _cluster_values(values: list[int], tolerance: int) -> list[int]:
    """Cluster nearby values and return the mean of each cluster."""
    if not values:
        return []
    values = sorted(values)
    clusters = [[values[0]]]
    for v in values[1:]:
        if v - clusters[-1][-1] <= tolerance:
            clusters[-1].append(v)
        else:
            clusters.append([v])
    return [int(sum(c) / len(c)) for c in clusters]


def _split_at_large_gaps(lines: list[dict]) -> list[list[dict]]:
    """Split a sorted list of h-lines into sub-groups at unusually large y-gaps."""
    if len(lines) <= 1:
        return [lines]

    gaps = [lines[i + 1]["y"] - lines[i]["y"] for i in range(len(lines) - 1)]
    median_gap = sorted(gaps)[len(gaps) // 2]

    # A gap > 2.5x the median (but at least 15px) is a break point
    threshold = max(median_gap * 2.5, 15)

    sub_groups: list[list[dict]] = [[lines[0]]]
    for i, gap in enumerate(gaps):
        if gap > threshold:
            sub_groups.append([lines[i + 1]])
        else:
            sub_groups[-1].append(lines[i + 1])

    return sub_groups


def _find_table_regions(
    h_lines: list[dict], v_lines: list[dict], img_width: int, img_height: int
) -> list[dict]:
    """
    Group horizontal lines into table regions.
    A table region requires at least 3 roughly-aligned horizontal lines
    with consistent spacing (splits at large gaps to avoid merging
    header/footer decorative lines with actual table lines).
    """
    if len(h_lines) < 3:
        return []

    # Sort by y position
    h_lines = sorted(h_lines, key=lambda l: l["y"])

    min_table_width = img_width * 0.25

    # Step 1: Group lines by x-range overlap
    x_groups: list[list[dict]] = []
    current_group = [h_lines[0]]

    for line in h_lines[1:]:
        group_x1 = min(l["x1"] for l in current_group)
        group_x2 = max(l["x2"] for l in current_group)
        overlap = min(line["x2"], group_x2) - max(line["x1"], group_x1)
        line_width = line["x2"] - line["x1"]

        if overlap > line_width * 0.5:
            current_group.append(line)
        else:
            if len(current_group) >= 3:
                x_groups.append(current_group)
            current_group = [line]

    if len(current_group) >= 3:
        x_groups.append(current_group)

    # Step 2: Within each x-group, split at large y-gaps to separate
    # decorative lines (titles, dividers) from actual table row separators
    regions = []
    for group in x_groups:
        sub_groups = _split_at_large_gaps(group)
        for sg in sub_groups:
            if len(sg) < 3:
                continue

            x1 = min(l["x1"] for l in sg)
            x2 = max(l["x2"] for l in sg)
            y1 = sg[0]["y"]
            y2 = sg[-1]["y"]

            if x2 - x1 < min_table_width:
                continue

            row_ys = _cluster_values([l["y"] for l in sg], tolerance=8)
            if len(row_ys) < 3:
                continue

            # Find vertical lines within this region
            region_v_lines = [
                vl for vl in v_lines
                if vl["x"] >= x1 - 10 and vl["x"] <= x2 + 10
                and vl["y1"] <= y2 + 10 and vl["y2"] >= y1 - 10
            ]

            regions.append({
                "bbox": [x1, y1, x2, y2],
                "row_ys": row_ys,
                "v_lines": region_v_lines,
            })

    return regions


def _determine_columns(
    region: dict, blocks: list[dict], img_width: int
) -> list[int]:
    """
    Determine column boundaries for a table region.
    Strategy A: Use vertical lines if enough are detected.
    Strategy B: Infer from block positions in the header row.
    Returns sorted list of column x-boundaries (including left and right edges).
    """
    x1, y1, x2, y2 = region["bbox"]
    row_ys = region["row_ys"]
    v_lines = region["v_lines"]

    # Strategy A: vertical lines that span most of the table height
    table_height = y2 - y1
    tall_v_lines = [
        vl for vl in v_lines
        if (vl["y2"] - vl["y1"]) >= table_height * 0.4
    ]
    if len(tall_v_lines) >= 3:
        col_xs = _cluster_values([vl["x"] for vl in tall_v_lines], tolerance=10)
        # Add table edges if not already covered
        if col_xs and col_xs[0] > x1 + 15:
            col_xs.insert(0, x1)
        if col_xs and col_xs[-1] < x2 - 15:
            col_xs.append(x2)
        if len(col_xs) >= 3:
            return col_xs

    # Strategy B: infer from the row with the most horizontally-spread blocks
    if len(row_ys) < 2:
        return [x1, x2]

    best_blocks: list[dict] = []
    # Try each row band and pick the one with the most blocks
    for r in range(min(len(row_ys) - 1, 5)):
        r_top = row_ys[r]
        r_bot = row_ys[r + 1]
        margin = (r_bot - r_top) * 0.3
        row_blocks = [
            b for b in blocks
            if _block_in_region(b["bbox"], [x1 - 5, r_top - margin, x2 + 5, r_bot + margin])
        ]
        if len(row_blocks) > len(best_blocks):
            best_blocks = row_blocks

    if len(best_blocks) < 2:
        return [x1, x2]

    # Sort blocks left to right
    best_blocks.sort(key=lambda b: b["bbox"][0])

    # Column boundaries = midpoints between consecutive blocks
    col_xs = [x1]
    for i in range(len(best_blocks) - 1):
        right_of_curr = best_blocks[i]["bbox"][2]
        left_of_next = best_blocks[i + 1]["bbox"][0]
        col_xs.append(int((right_of_curr + left_of_next) / 2))
    col_xs.append(x2)

    return col_xs


def _block_in_region(block_bbox: list, region_bbox: list) -> bool:
    """Check if a block's center falls within the region."""
    bx_center = (block_bbox[0] + block_bbox[2]) / 2
    by_center = (block_bbox[1] + block_bbox[3]) / 2
    return (
        region_bbox[0] <= bx_center <= region_bbox[2]
        and region_bbox[1] <= by_center <= region_bbox[3]
    )


def _build_table_grid(
    region: dict, columns: list[int], blocks: list[dict]
) -> list[list[str]]:
    """Map OCR blocks into a row x column grid using center-point matching."""
    row_ys = region["row_ys"]
    x1, y1, x2, y2 = region["bbox"]
    num_rows = len(row_ys) - 1
    num_cols = len(columns) - 1

    if num_rows < 1 or num_cols < 1:
        return []

    grid = [["" for _ in range(num_cols)] for _ in range(num_rows)]

    # Expand region slightly for block matching
    margin_y = max((row_ys[1] - row_ys[0]) * 0.2, 5) if num_rows > 0 else 10

    # Collect blocks that fall within the table region
    table_blocks = [
        b for b in blocks
        if _block_in_region(
            b["bbox"],
            [x1 - 10, row_ys[0] - margin_y, x2 + 10, row_ys[-1] + margin_y]
        )
    ]

    for block in table_blocks:
        bx_center = (block["bbox"][0] + block["bbox"][2]) / 2
        by_center = (block["bbox"][1] + block["bbox"][3]) / 2

        # Find row
        row_idx = -1
        for r in range(num_rows):
            r_top = row_ys[r] - margin_y
            r_bot = row_ys[r + 1] + margin_y if r + 1 < len(row_ys) else y2 + margin_y
            if r_top <= by_center <= r_bot:
                row_idx = r
                break
        if row_idx < 0:
            continue

        # Find column
        col_idx = -1
        for c in range(num_cols):
            if columns[c] - 10 <= bx_center <= columns[c + 1] + 10:
                col_idx = c
                break
        if col_idx < 0:
            continue

        # Append text (multiple blocks may land in same cell)
        existing = grid[row_idx][col_idx]
        if existing:
            grid[row_idx][col_idx] = existing + " " + block["text"]
        else:
            grid[row_idx][col_idx] = block["text"]

    return grid


def _grid_to_html(grid: list[list[str]], has_header: bool = True) -> str:
    """Generate minimal HTML table from a grid. Frontend applies Tailwind styling."""
    if not grid:
        return ""

    rows_html = []
    for i, row in enumerate(grid):
        tag = "th" if (has_header and i == 0) else "td"
        cells = "".join(f"<{tag}>{cell}</{tag}>" for cell in row)
        rows_html.append(f"<tr>{cells}</tr>")

    header_part = ""
    body_rows = rows_html
    if has_header and len(rows_html) > 1:
        header_part = f"<thead>{rows_html[0]}</thead>"
        body_rows = rows_html[1:]
    body_part = "<tbody>" + "".join(body_rows) + "</tbody>"

    return f"<table>{header_part}{body_part}</table>"


def extract_tables(img: Image.Image, blocks: list[dict]) -> list[dict]:
    """
    Extract tables from a page image using OpenCV line detection + OCR block mapping.
    Returns list of {"bbox": [x1,y1,x2,y2], "html": "<table>..."}.
    """
    img_array = np.array(img)
    h, w = img_array.shape[:2]

    h_mask, v_mask = _detect_lines(img_array)
    h_lines = _extract_line_segments(h_mask, "horizontal")
    v_lines = _extract_line_segments(v_mask, "vertical")

    logger.info(f"Detected {len(h_lines)} h-lines, {len(v_lines)} v-lines")

    if len(h_lines) < 3:
        return []

    regions = _find_table_regions(h_lines, v_lines, w, h)
    logger.info(f"Found {len(regions)} table region(s)")

    tables = []
    for region in regions:
        columns = _determine_columns(region, blocks, w)
        grid = _build_table_grid(region, columns, blocks)

        # Trim leading rows that are mostly empty (non-table header/section rows)
        # Find the first row where most columns have content (the actual header)
        num_cols = len(columns) - 1
        start_idx = 0
        for i, row in enumerate(grid):
            filled = sum(1 for cell in row if cell.strip())
            if filled >= max(num_cols * 0.8, 3):
                start_idx = i
                break
        grid = grid[start_idx:]

        # Also trim trailing empty rows
        while grid and all(not cell.strip() for cell in grid[-1]):
            grid.pop()

        # Skip grids that are too small or too sparse (likely false positives)
        total_cells = len(grid) * num_cols if grid else 0
        non_empty = sum(1 for row in grid for cell in row if cell.strip())
        if len(grid) < 2 or non_empty < 3:
            continue
        # Reject if fill rate is below 30% (section dividers, not real tables)
        if total_cells > 0 and non_empty / total_cells < 0.3:
            continue
        # Reject if too many columns (>10 is almost certainly wrong)
        if num_cols > 10:
            continue

        html = _grid_to_html(grid, has_header=True)
        if html:
            tables.append({
                "bbox": [round(v, 1) for v in region["bbox"]],
                "html": html,
            })

    logger.info(f"Extracted {len(tables)} table(s)")
    return tables


def process_page(img: Image.Image, extract_table: bool = True) -> dict:
    """
    Full processing for a single page: OCR + optional table extraction.
    Returns:
        {
            "width": int,
            "height": int,
            "full_text": str,
            "blocks": [...],
            "tables": [...],
            "confidence": float,
        }
    """
    width, height = img.size

    # Run OCR
    ocr_result = ocr_image(img)

    # Table extraction using OpenCV line detection + OCR block mapping
    tables = []
    if extract_table:
        try:
            tables = extract_tables(img, ocr_result["blocks"])
        except Exception as e:
            logger.warning(f"Table extraction failed: {e}")

    return {
        "width": width,
        "height": height,
        "full_text": ocr_result["full_text"],
        "blocks": ocr_result["blocks"],
        "tables": tables,
        "confidence": ocr_result["confidence"],
    }
