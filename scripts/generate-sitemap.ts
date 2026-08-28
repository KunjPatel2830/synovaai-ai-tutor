// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.

import { writeFileSync } from "fs"
import { resolve } from "path"

const BASE_URL = "https://synovaai.in"

interface SitemapEntry {
  path: string
  lastmod?: string
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
  priority?: string
}

const entries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about", changefreq: "monthly", priority: "0.8" },
  { path: "/reviews", changefreq: "weekly", priority: "0.8" },
  { path: "/contact", changefreq: "monthly", priority: "0.7" },
  { path: "/privacy", changefreq: "monthly", priority: "0.6" },
  { path: "/terms", changefreq: "monthly", priority: "0.6" },
  { path: "/guides/ai-math-solver", changefreq: "monthly", priority: "0.9" },
  { path: "/auth", changefreq: "monthly", priority: "0.5" },
  { path: "/forgot-password", changefreq: "yearly", priority: "0.3" },
  { path: "/reset-password", changefreq: "yearly", priority: "0.3" },
  { path: "/verify-email", changefreq: "yearly", priority: "0.3" },
  { path: "/dashboard", changefreq: "daily", priority: "0.9" },
  { path: "/tutor", changefreq: "daily", priority: "0.9" },
  { path: "/homework", changefreq: "daily", priority: "0.9" },
  { path: "/exam-prep", changefreq: "daily", priority: "0.9" },
  { path: "/voice-tutor", changefreq: "daily", priority: "0.9" },
  { path: "/language-practice", changefreq: "daily", priority: "0.8" },
  { path: "/doubt-solver", changefreq: "daily", priority: "0.9" },
  { path: "/study-planner", changefreq: "daily", priority: "0.8" },
  { path: "/peer-mode", changefreq: "daily", priority: "0.8" },
  { path: "/curriculum-study", changefreq: "daily", priority: "0.9" },
  { path: "/children", changefreq: "daily", priority: "0.7" },
  { path: "/students", changefreq: "daily", priority: "0.7" },
  { path: "/settings", changefreq: "monthly", priority: "0.5" },
]

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  )

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n")
}

writeFileSync(resolve("public/sitemap.xml"), generateSitemap(entries))
console.log(`sitemap.xml written (${entries.length} entries)`)
