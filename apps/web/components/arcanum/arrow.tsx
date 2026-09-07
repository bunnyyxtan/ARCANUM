// Spacing stays caller-owned because agent detail links use a narrower margin.
export function Arrow({
  glyph = "→",
  className = "ml-1.5 inline-block",
}: {
  glyph?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`${className} transition-transform duration-[220ms] group-hover:translate-x-1`}
    >
      {glyph}
    </span>
  );
}
