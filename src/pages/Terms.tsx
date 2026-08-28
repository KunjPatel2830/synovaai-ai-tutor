import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import synovaLogo from "@/assets/synova-landing-logo-optimized.webp";

const Terms = () => {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      content: `By accessing or using SYNOVA, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our platform. These terms apply to all users including students, teachers, and caregivers.`,
    },
    {
      title: "2. Account Registration",
      content: `You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials. Users under 13 must have parental or guardian consent to create an account.`,
    },
    {
      title: "3. Acceptable Use",
      content: `You agree to use SYNOVA solely for educational purposes. You may not misuse the AI tutor, attempt to extract harmful content, share your account credentials, or use the platform for any unlawful purpose. We reserve the right to suspend accounts that violate these guidelines.`,
    },
    {
      title: "4. AI-Generated Content",
      content: `SYNOVA's AI tutor provides educational guidance and explanations. While we strive for accuracy, AI-generated content should be used as a learning aid and not as a definitive academic authority. Users should verify critical information with official educational resources.`,
    },
    {
      title: "5. Intellectual Property",
      content: `All content, features, and functionality of SYNOVA are owned by SYNOVA and protected by intellectual property laws. You retain ownership of content you create (notes, uploads) but grant us a license to use it for improving our services.`,
    },
    {
      title: "6. Limitation of Liability",
      content: `SYNOVA is provided "as is" without warranties of any kind. We are not liable for academic outcomes, data loss due to circumstances beyond our control, or any indirect damages arising from the use of our platform.`,
    },
    {
      title: "7. Termination",
      content: `We may suspend or terminate your account if you violate these terms. You may close your account at any time through Settings. Upon termination, your right to use the platform ceases, but we may retain certain data as required by law.`,
    },
    {
      title: "8. Changes to Terms",
      content: `We reserve the right to modify these terms at any time. Material changes will be communicated via email or in-app notification at least 30 days before taking effect.`,
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
        <h1 className="text-4xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-12">Last updated: February 2026</p>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold text-foreground mb-3">{section.title}</h2>
              <p className="text-muted-foreground leading-relaxed">{section.content}</p>
            </section>
          ))}
        </div>
      </main>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SYNOVA. All rights reserved.
      </footer>
    </div>
  );
};

export default Terms;
