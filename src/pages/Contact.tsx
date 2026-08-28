import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Mail, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import synovaLogo from "@/assets/synova-landing-logo-optimized.webp";

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSending(true);
    setTimeout(() => {
      toast.success("Message sent! We'll get back to you soon.");
      setName(""); setEmail(""); setSubject(""); setMessage("");
      setSending(false);
    }, 1000);
  };

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
        <h1 className="text-4xl font-bold text-foreground mb-4">Contact Us</h1>
        <p className="text-lg text-muted-foreground mb-12">
          Have a question, suggestion, or need help? We'd love to hear from you.
        </p>

        <div className="grid md:grid-cols-3 gap-10">
          {/* Contact Info */}
          <div className="space-y-6">
            {[
              { icon: Mail, label: "Email", value: "hello@synova.ai" },
              { icon: MapPin, label: "Location", value: "India" },
              { icon: Clock, label: "Response Time", value: "Within 24 hours" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-sm text-muted-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Contact Form */}
          <form onSubmit={handleSubmit} className="md:col-span-2 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Email *</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Message *</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us more..." rows={5} />
            </div>
            <Button type="submit" disabled={sending} className="w-full sm:w-auto">
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </div>
      </main>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} SYNOVA. All rights reserved.
      </footer>
    </div>
  );
};

export default Contact;
