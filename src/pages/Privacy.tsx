import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import synovaLogo from "@/assets/synova-landing-logo-optimized.webp";

const Privacy = () => {
  const sections = [
    {
      title: "1. Information We Collect",
      content: `We collect information you provide directly, such as your name, email address, grade level, and learning preferences when you create an account. We also collect usage data including learning progress, chat interactions with the AI tutor, and performance metrics to personalize your experience.`,
    },
    {
      title: "2. How We Use Your Information",
      content: `Your information is used to provide and improve our AI tutoring services, personalize learning experiences, track academic progress, communicate important updates, and ensure platform security. We never sell your personal data to third parties.`,
    },
    {
      title: "3. Data Storage & Security",
      content: `We use industry-standard encryption and security measures to protect your data. All data is stored on secure servers with restricted access. We regularly audit our security practices to ensure your information remains safe.`,
    },
    {
      title: "4. Children's Privacy",
      content: `SYNOVA is designed for students of all ages. For users under 13, we require parental or guardian consent. Caregivers can monitor their child's learning progress through linked accounts and manage data preferences.`,
    },
    {
      title: "5. Your Rights",
      content: `You have the right to access, correct, or delete your personal data at any time. You can export your learning data, manage notification preferences, and close your account through the Settings page.`,
    },
    {
      title: "6. Cookies & Tracking",
      content: `We use essential cookies to keep you logged in and maintain your preferences. We do not use third-party advertising trackers. Analytics data is collected in aggregate to improve the platform.`,
    },
    {
      title: "7. Changes to This Policy",
      content: `We may update this privacy policy from time to time. We will notify you of significant changes via email or in-app notification. Continued use of SYNOVA after changes constitutes acceptance of the updated policy.`,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={synovaLogo} alt="SYNOVA Learning Platform" className="h-8 w-auto" />
            <span className="font-bold text-lg text-foreground">SYNOVA</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-12">Last updated: February 2026</p>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-foreground mb-3">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{section.content}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-xl border border-border bg-card">
          <p className="text-sm text-muted-foreground">
            If you have questions about this Privacy Policy, please contact us at{" "}
            <Link to="/contact" className="text-primary hover:underline">our contact page</Link>.
          </p>
        </div>
      </main>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SYNOVA. All rights reserved.
      </footer>
    </div>
  );
};

export default Privacy;
