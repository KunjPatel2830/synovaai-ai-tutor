import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Public (publishable) values only — safe to inline as a last-resort fallback
// so a published build can never crash with "supabaseUrl is required".
const PUBLIC_FALLBACKS: Record<string, string> = {
  VITE_SUPABASE_URL: "https://xsnxdtsdqjqiyzxscvuz.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzbnhkdHNkcWpxaXl6eHNjdnV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NDg4OTAsImV4cCI6MjA4MjEyNDg5MH0.uQ8t2V6lZMmipw7cBPFT7eTayOSC0E9ewVqpDKP67tQ",
  VITE_SUPABASE_PROJECT_ID: "xsnxdtsdqjqiyzxscvuz",
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env manually so the values are available even if the build
  // environment doesn't expose VITE_* variables directly.
  const env = { ...loadEnv(mode, process.cwd(), ""), ...PUBLIC_FALLBACKS };

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: Object.fromEntries(
      Object.entries({
        "import.meta.env.VITE_SUPABASE_URL": env.VITE_SUPABASE_URL,
        "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "import.meta.env.VITE_SUPABASE_PROJECT_ID": env.VITE_SUPABASE_PROJECT_ID,
        "import.meta.env.VITE_EXTERNAL_SUPABASE_URL": env.VITE_EXTERNAL_SUPABASE_URL,
        "import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY": env.VITE_EXTERNAL_SUPABASE_ANON_KEY,
      })
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, JSON.stringify(v)])
    ),
  };
});
