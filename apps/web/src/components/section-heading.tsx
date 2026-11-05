type SectionHeadingProps = {
  index?: string;
  title: string;
  meta?: string;
  id?: string;
  as?: "h2" | "h3";
};

/** Numbered editorial section heading with a hairline rule, used across product screens. */
export function SectionHeading({ index, title, meta, id, as: Tag = "h2" }: SectionHeadingProps) {
  return (
    <div className="sq-section-rule">
      {index ? <span className="font-mono text-xs font-bold text-ink-3">{index}</span> : null}
      <Tag id={id} className="whitespace-nowrap font-display text-2xl font-black uppercase leading-none tracking-[-0.03em]">{title}</Tag>
      <span className="rule" aria-hidden="true" />
      {meta ? <span className="whitespace-nowrap font-mono text-xs font-bold uppercase text-ink-3">{meta}</span> : null}
    </div>
  );
}
