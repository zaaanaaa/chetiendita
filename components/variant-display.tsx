import { isColorVariantGroup, isHexColor } from "@/lib/color-variants";

interface VariantDisplayProps {
  value: string;
}

function parseVariantSegments(value: string) {
  return value
    .split("·")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [rawName, ...rawValueParts] = segment.split(":");
      const name = rawName.trim();
      const option = rawValueParts.join(":").trim();

      return option ? { name, option } : { name: "", option: segment };
    });
}

export function VariantDisplay({ value }: VariantDisplayProps) {
  const segments = parseVariantSegments(value);

  if (segments.length === 0) {
    return null;
  }

  return (
    <span className="variant-display">
      {segments.map((segment, index) => {
        const key = `${segment.name}-${segment.option}-${index}`;
        const isColorOption = isColorVariantGroup(segment.name) && isHexColor(segment.option);

        if (isColorOption) {
          return (
            <span key={key} className="variant-display-segment">
              {segment.name ? <span>{segment.name}:</span> : null}
              <span className="color-swatch color-swatch-inline" style={{ backgroundColor: segment.option }} aria-label={segment.option} />
            </span>
          );
        }

        return (
          <span key={key} className="variant-display-segment">
            {segment.name ? `${segment.name}: ` : ""}
            {segment.option}
          </span>
        );
      })}
    </span>
  );
}
