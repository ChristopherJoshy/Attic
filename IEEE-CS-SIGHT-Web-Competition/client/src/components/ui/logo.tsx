import React from "react";

type LogoProps = {
	size?: "sm" | "md" | "lg";
	withText?: boolean;
	className?: string;
	showSeparator?: boolean;
	showSubline?: boolean;
	headlineClassName?: string;
	sublineClassName?: string;
};

const sizeMap = {
	sm: "w-8 h-8",
	md: "w-10 h-10",
	lg: "w-12 h-12",
} as const;

export function Logo({
	size = "md",
	withText = true,
	className = "",
	showSeparator = true,
	showSubline = true,
	headlineClassName = "",
	sublineClassName = "",
}: LogoProps) {
	return (
		<span
			className={`inline-flex items-center gap-3 ${className}`}
			aria-label="IEEE SIGHT CEK logo"
			style={{
				// Scoped brand colors (adjust here easily)
				// IEEE Blue and SIGHT Orange approximations chosen to be accessible on light bg
				// while aligning with your provided reference artwork.
				// Also reused by the optional separator rule.
				// Note: globe hover colors are defined in index.css
				// and remain independent from these.
				// eslint-disable-next-line @typescript-eslint/ban-ts-comment
				// @ts-ignore inline CSS vars
				"--logo-ieee-blue": "#2563eb",
				// @ts-ignore inline CSS vars
				"--logo-sight-orange": "#f59e0b",
			} as React.CSSProperties}
		>
			<span
				className={`${sizeMap[size]} rounded-xl ring-1 ring-border flex items-center justify-center overflow-hidden logo-globe`}
				style={{ backgroundColor: "var(--primary-10)" }}
			>
				{/* Inline SVG globe: mono by default, colors pop on parent .group hover */}
				<svg
					viewBox="0 0 128 128"
					xmlns="http://www.w3.org/2000/svg"
					className="w-4/5 h-4/5"
					role="img"
					aria-label="Globe logo"
				>
					{/* Blue orbit arcs and dots */}
					<circle cx="64" cy="64" r="52" fill="none" stroke="var(--globe-blue)" strokeWidth="8" strokeDasharray="120 60" strokeLinecap="round" />
					<circle cx="24" cy="28" r="6" fill="var(--globe-blue)" />
					<circle cx="104" cy="100" r="6" fill="var(--globe-blue)" />

					{/* Orange land outline */}
					<path
						d="M40 74c8-8 14-7 22-14 4-4 6-9 2-13-6-6-14-6-20-2M52 86c6 2 12 2 18-2 6-4 10-8 12-12"
						fill="none"
						stroke="var(--globe-orange)"
						strokeWidth="8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>

					{/* Red short arc and dots */}
					<path d="M82 36c8 4 14 10 18 18" fill="none" stroke="var(--globe-red)" strokeWidth="8" strokeLinecap="round" />
					<circle cx="96" cy="30" r="6" fill="var(--globe-red)" />
					<circle cx="106" cy="54" r="6" fill="var(--globe-red)" />
				</svg>
			</span>

							{withText && (
								<span className="select-none">
							{/* Headline like reference: split coloring */}
									<span className={`block leading-tight font-poppins font-extrabold uppercase tracking-tight text-lg ${headlineClassName}`}>
								<span style={{ color: "var(--logo-ieee-blue)" }}>IEEE</span>{" "}
								<span style={{ color: "var(--logo-sight-orange)" }}>SIGHT</span>
							</span>
							{/* Thin separator rule like reference */}
									{showSeparator && (
										<span
											aria-hidden
											className="block h-px my-0.5"
											style={{ backgroundColor: "var(--logo-ieee-blue)" }}
										/>
									)}
							{/* Subheadline line */}
												{showSubline && (
													<span
														className={`block leading-snug text-[11px] md:text-xs max-w-[22ch] ${sublineClassName}`}
														style={{ color: "var(--logo-sight-orange)" }}
													>
														Special Interest Group on Humanitarian Technology
													</span>
												)}
						</span>
					)}
		</span>
	);
}

export default Logo;

