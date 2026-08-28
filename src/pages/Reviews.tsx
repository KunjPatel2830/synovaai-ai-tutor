import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { externalSupabase } from "@/lib/external-supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Star, User, ArrowLeft, LogIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedSection, AnimatedCard } from "@/components/landing/AnimatedSection";
import synovaLogo from "@/assets/synova-logo.png";

interface Review {
  id: string;
  user_id?: string;
  display_name: string;
  content: string;
  rating: number;
  created_at: string;
}

type FilterType = "all" | "student" | "parent" | "teacher";

const Reviews = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [newReview, setNewReview] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [userHasReview, setUserHasReview] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    const checkUserReview = async () => {
      if (user) {
        const { data } = await externalSupabase
          .from("reviews")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        setUserHasReview(!!data);
      } else {
        setUserHasReview(false);
      }
    };
    checkUserReview();
  }, [user]);

  const fetchReviews = async () => {
    setIsLoading(true);
    const { data, error } = await externalSupabase
      .from("reviews_public")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setReviews(data as Review[]);
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!newReview.trim()) { toast({ title: "Please write a review", variant: "destructive" }); return; }
    setIsSubmitting(true);
    const { data: profile } = await externalSupabase
      .from("profiles").select("display_name").eq("user_id", user.id).single();
    const displayName = profile?.display_name || user.email?.split("@")[0] || "Anonymous";
    const { error } = await externalSupabase.from("reviews").insert({
      user_id: user.id, display_name: displayName, content: newReview.trim(), rating: newRating,
    });
    if (error) { toast({ title: "Failed to submit review", variant: "destructive" }); }
    else { toast({ title: "Review submitted!" }); setNewReview(""); setNewRating(5); setShowForm(false); fetchReviews(); }
    setIsSubmitting(false);
  };

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Students", value: "student" },
    { label: "Parents", value: "parent" },
    { label: "Teachers", value: "teacher" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass-strong border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <img src={synovaLogo} alt="SYNOVA" className="h-8 w-8 object-contain" />
            <span className="text-lg font-bold font-display">SYNOVA</span>
          </div>
          <Button onClick={() => navigate("/auth")} size="sm">Try Synova</Button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatedSection>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-center mb-3">
            What Our <span className="text-primary">Users Say</span>
          </h1>
          <p className="text-muted-foreground text-center mb-8 max-w-xl mx-auto">
            Real feedback from students, parents, and teachers using SYNOVA.
          </p>
        </AnimatedSection>

        {/* Filters */}
        <AnimatedSection delay={0.1}>
          <div className="flex items-center justify-center gap-2 mb-10 flex-wrap">
            {filters.map((f) => (
              <Button
                key={f.value}
                variant={filter === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </AnimatedSection>

        {/* Grid */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="p-6 rounded-2xl border border-border bg-card">
                <div className="flex gap-1 mb-3">{[1, 2, 3, 4, 5].map((s) => <Skeleton key={s} className="h-4 w-4" />)}</div>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-4" />
                <div className="flex items-center gap-3 pt-3 border-t border-border">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No reviews yet. Be the first!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((review, idx) => (
              <AnimatedCard key={review.id} delay={idx * 0.05}>
                <div className="p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all duration-300 h-full flex flex-col">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < review.rating ? "text-warning fill-warning" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <p className="text-foreground text-sm leading-relaxed mb-4 flex-1">"{review.content}"</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{review.display_name}</p>
                      <p className="text-xs text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              </AnimatedCard>
            ))}
          </div>
        )}

        {/* Write Review */}
        <AnimatedSection delay={0.2} className="mt-12">
          <div className="max-w-md mx-auto p-6 rounded-2xl border border-border bg-card">
            {!user ? (
              <div className="text-center">
                <p className="text-muted-foreground text-sm mb-3">Sign in to share your experience</p>
                <Button onClick={() => navigate("/auth")} size="sm" className="gap-2"><LogIn className="w-4 h-4" /> Sign In</Button>
              </div>
            ) : userHasReview ? (
              <p className="text-center text-muted-foreground text-sm">Thank you for your review!</p>
            ) : showForm ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={star} type="button" onClick={() => setNewRating(star)} aria-label={`Rate ${star} star${star === 1 ? "" : "s"}`} className="p-0.5 hover:scale-110 transition-transform">
                        <Star className={`w-5 h-5 ${star <= newRating ? "text-warning fill-warning" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Your Review</label>
                  <Textarea value={newReview} onChange={(e) => setNewReview(e.target.value)} placeholder="Share your experience..." rows={3} maxLength={500} className="text-sm" />
                  <p className="text-xs text-muted-foreground mt-1">{newReview.length}/500</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">{isSubmitting ? "Submitting..." : "Submit"}</Button>
                  <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-muted-foreground text-sm mb-3">Share your experience with SYNOVA</p>
                <Button onClick={() => setShowForm(true)} size="sm">Write a Review</Button>
              </div>
            )}
          </div>
        </AnimatedSection>
      </main>
    </div>
  );
};

export default Reviews;
