"use client";

import type { OCRBlock } from "@/lib/api";

interface HighlightOverlayProps {
  blocks: OCRBlock[];
  query: string;
  imageNaturalWidth: number;
  imageNaturalHeight: number;
  imageRenderedWidth: number;
  imageRenderedHeight: number;
}

export default function HighlightOverlay({
  blocks,
  query,
  imageNaturalWidth,
  imageNaturalHeight,
  imageRenderedWidth,
  imageRenderedHeight,
}: HighlightOverlayProps) {
  if (!query || !blocks.length || !imageNaturalWidth || !imageRenderedWidth) {
    return null;
  }

  const lowerQuery = query.toLowerCase();
  const matchingBlocks = blocks.filter((b) =>
    b.text.toLowerCase().includes(lowerQuery)
  );

  if (matchingBlocks.length === 0) return null;

  const scaleX = imageRenderedWidth / imageNaturalWidth;
  const scaleY = imageRenderedHeight / imageNaturalHeight;

  return (
    <svg
      aria-label={`${matchingBlocks.length}件ハイライト`}
      className="absolute top-0 left-0 z-10 pointer-events-none"
      width={imageRenderedWidth}
      height={imageRenderedHeight}
      style={{ width: imageRenderedWidth, height: imageRenderedHeight }}
      viewBox={`0 0 ${imageRenderedWidth} ${imageRenderedHeight}`}
    >
      {matchingBlocks.map((block, i) => {
        const [xMin, yMin, xMax, yMax] = block.bbox;
        const x = xMin * scaleX;
        const y = yMin * scaleY;
        const w = (xMax - xMin) * scaleX;
        const h = (yMax - yMin) * scaleY;

        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            fill="rgba(255, 200, 0, 0.3)"
            stroke="rgba(255, 160, 0, 0.8)"
            strokeWidth={2}
            rx={2}
          />
        );
      })}
    </svg>
  );
}
