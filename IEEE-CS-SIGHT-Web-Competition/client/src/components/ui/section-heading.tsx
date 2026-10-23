interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({ title, subtitle, className = "" }: SectionHeadingProps) {
  return (
    <div className={`text-center mb-12 sm:mb-16 px-2 ${className}`}>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-poppins font-bold mb-2 sm:mb-3">
        {title}
      </h2>
      <div
        className="mx-auto w-20 sm:w-24 h-1 rounded-full transition-transform duration-300 will-change-transform"
        style={{ background: "linear-gradient(90deg, #6366F1, #EC4899, #22C55E)" }}
      />
      {subtitle && (
        <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto mt-3">
          {subtitle}
        </p>
      )}
    </div>
  );
}
