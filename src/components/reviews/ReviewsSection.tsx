import { useState, useEffect } from "react";
import { externalSupabase } from "@/lib/external-supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Star, Quote, User, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface Review {
  id: string;
  display_name: string;
  content: string;
  rating: number;
  created_at: string;
}

export function ReviewsSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [newReview, setNewReview] = useState("");
  const [newRating, setNewRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [userHasReview, setUserHasReview] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    if (!user) {
      setUserHasReview(false);
      return;
    }
    // Query the user's own review directly (RLS allows owner SELECT on base table)
    externalSupabase
      .from("reviews")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setUserHasReview(!!data));
  }, [user]);

  const fetchReviews = async () => {
    setIsLoading(true);
    const { data, error } = await externalSupabase
      .from("reviews_public")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReviews(data as Review[]);
    }
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!newReview.trim()) {
      toast({ title: "Please write a review", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    const { data: profile } = await externalSupabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    const displayName = profile?.display_name || user.email?.split("@")[0] || "Anonymous";

    const { error } = await externalSupabase.from("reviews").insert({
      user_id: user.id,
      display_name: displayName,
      content: newReview.trim(),
      rating: newRating,
    });

    if (error) {
      toast({ title: "Failed to submit review", variant: "destructive" });
    } else {
      toast({ title: "Review submitted successfully!" });
      setNewReview("");
      setNewRating(5);
      setShowForm(false);
      fetchReviews();
    }

    setIsSubmitting(false);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % Math.max(1, reviews.length));
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + reviews.length) % Math.max(1, reviews.length));
  };

  return (
    <section id="reviews" className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold font-display text-center mb-3">
          What Our <span className="text-primary">Users Say</span>
        </h2>
        <p className="text-muted-foreground text-center mb-8 text-sm max-w-xl mx-auto">
          Hear from students, teachers, and caregivers who use SYNOVA every day.
        </p>

        {/* Reviews Display */}
        <div className="mb-10">
          {isLoading ? (
            <div className="flex gap-4 justify-center">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-72 p-5 rounded-xl border border-border bg-card hidden sm:block first:block">
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Skeleton key={s} className="h-4 w-4 rounded" />
                    ))}
                  </div>
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4 mb-4" />
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div>
                      <Skeleton className="h-3 w-20 mb-1" />
                      <Skeleton className="h-2 w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-border bg-card">
              <Quote className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No reviews yet. Be the first to share your experience!</p>
            </div>
          ) : (
            <div className="relative">
              {/* Navigation arrows */}
              {reviews.length > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={prevSlide}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 z-10 rounded-full h-8 w-8 hidden sm:flex"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={nextSlide}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 z-10 rounded-full h-8 w-8 hidden sm:flex"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}

              {/* Review card */}
              <div className="max-w-md mx-auto">
                <div className="p-5 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-1 mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < reviews[currentIndex].rating ? "text-warning fill-warning" : "text-muted-foreground"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-foreground text-sm leading-relaxed mb-4 line-clamp-4">
                    "{reviews[currentIndex].content}"
                  </p>
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{reviews[currentIndex].display_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(reviews[currentIndex].created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dots indicator */}
              {reviews.length > 1 && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={prevSlide}
                    className="h-8 w-8 sm:hidden"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="flex gap-1.5">
                    {reviews.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === currentIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={nextSlide}
                    className="h-8 w-8 sm:hidden"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add Review Section */}
        <div className="max-w-sm mx-auto p-5 rounded-xl border border-border bg-card">
          {!user ? (
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-3">Sign in to share your experience</p>
              <Button onClick={() => navigate("/auth")} size="sm" className="gap-2">
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
            </div>
          ) : userHasReview ? (
            <div className="text-center">
              <p className="text-muted-foreground text-sm">Thank you for your review!</p>
            </div>
          ) : showForm ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1.5 block">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setNewRating(star)}
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= newRating ? "text-warning fill-warning" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block">Your Review</label>
                <Textarea
                  value={newReview}
                  onChange={(e) => setNewReview(e.target.value)}
                  placeholder="Share your experience..."
                  rows={3}
                  maxLength={500}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">{newReview.length}/500</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={isSubmitting} size="sm">
                  {isSubmitting ? "Submitting..." : "Submit"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-3">Share your experience with SYNOVA</p>
              <Button onClick={() => setShowForm(true)} size="sm">Write a Review</Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
