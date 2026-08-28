import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Users, Lightbulb, Heart } from "lucide-react";
import synovaLogo from "@/assets/synova-landing-logo-optimized.webp";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
        <h1 className="text-4xl font-bold text-foreground mb-4">About SYNOVA</h1>
        <p className="text-lg text-muted-foreground mb-12">
          Empowering students with AI-powered learning that focuses on understanding, not just answers.
        </p>

        <div className="grid gap-10">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">Our Mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              At SYNOVA, we believe every student deserves a personal tutor who understands their unique learning style. 
              Our AI-powered platform adapts to each learner, providing personalized guidance across subjects, exam preparation, 
              and skill development. We're building the future of education — accessible, affordable, and effective for everyone.
            </p>
          </section>

          <div className="grid sm:grid-cols-2 gap-6">
            {[
              { icon: BookOpen, title: "Adaptive Learning", desc: "Our AI adjusts to your pace and learning style, ensuring concepts stick." },
              { icon: Users, title: "Collaborative", desc: "Peer learning rooms, voice tutoring, and real-time collaboration tools." },
              { icon: Lightbulb, title: "Understanding First", desc: "We focus on deep comprehension, not rote memorization or quick fixes." },
              { icon: Heart, title: "Student-Centered", desc: "Built by educators and technologists who care about learning outcomes." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-6 rounded-xl border border-border bg-card">
                <Icon className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-4">Our Story</h2>
            <p className="text-muted-foreground leading-relaxed">
              SYNOVA was born from a simple observation: traditional tutoring is expensive and inaccessible for most students. 
              We set out to democratize quality education by combining cutting-edge AI with proven pedagogical methods. 
              Today, SYNOVA helps thousands of students learn smarter, prepare better, and achieve more — all from the comfort of their homes.
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SYNOVA. All rights reserved.
      </footer>
    </div>
  );
};

export default About;
