import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import React from "react";

interface MapEmbedProps {
  query: string; // Human-readable address or plus code
  zoom?: number; // 1-20, default ~15
  title?: string;
  className?: string;
}

export function MapEmbed({ query, zoom = 15, title = "Location map", className }: MapEmbedProps) {
  const q = encodeURIComponent(query);
  const src = `https://www.google.com/maps?q=${q}&z=${zoom}&output=embed`;

  return (
    <div className={cn("rounded-xl overflow-hidden border bg-background", className)} data-testid="map-embed">
      <AspectRatio ratio={16 / 9}>
        <iframe
          title={title}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-full border-0"
          allowFullScreen
        />
      </AspectRatio>
      <noscript>
        <div className="p-3 text-center">
          <a
            href={`https://www.google.com/maps?q=${q}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Open in Google Maps
          </a>
        </div>
      </noscript>
    </div>
  );
}

export default MapEmbed;
