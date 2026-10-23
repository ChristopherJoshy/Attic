FORKLS illustration source assets

This package includes the fourteen artworks used by the revised site: five original technical/mission/Finn images, six editorial images created for this revision, and three hero clouds.

recovered-prompts.json and asset-metadata.json document the five retained original generations. editorial-sprite-prompts.json and editorial-sprite-metadata.json document the new landscape and five animation sheets.

Animation sheets: 1448 x 1086 PNG, four columns by three rows, twelve 362-square frames in row-major order. Optimized WebP sheets preserve the same grid. The drone component sheet is 1536 x 1024, three columns by two rows of 512-square cells.

hero-ink-landscape.png keeps the generated artwork but its flat cream sky has been made transparent, so the drifting clouds and the balloon can pass behind the hills. Only sky pixels connected to the top edge were removed; the pale water and shore are untouched. Any replacement artwork must also have a transparent sky, and must be re-encoded by deleting assets/hero-ink-landscape.webp first, because the build reuses an existing WebP.

hero-cloud-a.png, hero-cloud-b.png and hero-cloud-c.png are outline-only ink clouds drawn programmatically rather than generated: a union of overlapping wobbly circles, keeping the outer contour and filling it with paper white. Each PNG is cropped to its silhouette, so the rendered size is set in CSS.

People photos are original FORKLS material in assets/company-*.webp. No generated people images are used.
