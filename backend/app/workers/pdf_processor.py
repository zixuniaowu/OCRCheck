"""Convert PDF pages to images and handle image files for OCR input."""

import io
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

# Target DPI for OCR (higher = better accuracy but slower)
OCR_DPI = 300


def pdf_to_images(pdf_bytes: bytes) -> list[Image.Image]:
    """Convert a PDF to a list of PIL Images, one per page."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    zoom = OCR_DPI / 72  # 72 is default PDF DPI
    matrix = fitz.Matrix(zoom, zoom)
    for page in doc:
        pix = page.get_pixmap(matrix=matrix)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        images.append(img)
    doc.close()
    return images


def load_image(image_bytes: bytes, content_type: str) -> list[Image.Image]:
    """Load an image file, returning as a single-item list for uniform handling."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    return [img]


def prepare_images(file_bytes: bytes, content_type: str) -> list[Image.Image]:
    """Convert any supported file to a list of PIL Images."""
    if content_type == "application/pdf":
        return pdf_to_images(file_bytes)
    else:
        return load_image(file_bytes, content_type)


def image_to_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    """Convert PIL Image to bytes."""
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()
