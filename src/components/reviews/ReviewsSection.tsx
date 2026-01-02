import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Star, Quote, User, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Review {
  id: string;
  user_id: string;
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
    if (user && reviews.length > 0) {
      setUserHasReview(reviews.some(r => r.user_id === user.id));
    }
  }, [user, reviews]);

  const fetchReviews = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReviews(data);
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

    // Get display name from profile or email
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    const displayName = profile?.display_name || user.email?.split("@")[0] || "Anonymous";

    const { error } = await supabase.from("reviews").insert({
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

  const getVisibleReviews = () => {
    if (reviews.length === 0) return [];
    if (reviews.length <= 3) return reviews;
    
    const visible = [];
    for (let i = -1; i <= 1; i++) {
      const idx = (currentIndex + i + reviews.length) % reviews.length;
      visible.push({ ...reviews[idx], position: i });
    }
    return visible;
  };

  return (
    <section id="reviews" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-bold font-display text-center mb-4">
          What Our <span className="text-primary">Users Say</span>
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
          Hear from students, teachers, and caregivers who use SYNOVA every day.
        </p>

        {/* Reviews Carousel */}
        <div className="relative mb-12">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-16 glass rounded-2xl border border-border/50">
              <Quote className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No reviews yet. Be the first to share your experience!</p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-4 min-h-[320px]">
              {/* Left Arrow */}
              <Button
                variant="outline"
                size="icon"
                onClick={prevSlide}
                className="rounded-full shrink-0 hidden sm:flex"
                disabled={reviews.length <= 1}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              {/* Cards Container */}
              <div className="flex items-center justify-center gap-4 overflow-hidden w-full max-w-4xl">
                {getVisibleReviews().map((review, idx) => {
                  const isCenter = review.position === 0 || reviews.length <= 3;
                  return (
                    <div
                      key={review.id}
                      className={`
                        glass rounded-2xl border border-border/50 p-6 transition-all duration-300
                        ${isCenter 
                          ? "scale-100 opacity-100 z-10 w-full max-w-md" 
                          : "scale-90 opacity-60 hidden lg:block w-72"
                        }
                      `}
                    >
                      <div className="flex items-center gap-1 mb-4">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.rating ? "text-warning fill-warning" : "text-muted-foreground"
                            }`}
                          />
                        ))}
                      </div>
                      <Quote className="w-8 h-8 text-primary/30 mb-2" />
                      <p className="text-foreground mb-6 line-clamp-4">{review.content}</p>
                      <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{review.display_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(review.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Arrow */}
              <Button
                variant="outline"
                size="icon"
                onClick={nextSlide}
                className="rounded-full shrink-0 hidden sm:flex"
                disabled={reviews.length <= 1}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Pagination Dots */}
          {reviews.length > 1 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={prevSlide}
                className="rounded-full sm:hidden"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {currentIndex + 1} of {reviews.length}
                </span>
                <div className="w-24 h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / reviews.length) * 100}%` }}
                  />
                </div>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={nextSlide}
                className="rounded-full sm:hidden"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>

        {/* Add Review Section */}
        <div className="glass rounded-2xl border border-border/50 p-6 sm:p-8 max-w-xl mx-auto">
          {!user ? (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Sign in to share your experience with SYNOVA</p>
              <Button onClick={() => navigate("/auth")} className="gap-2">
                <LogIn className="w-4 h-4" />
                Sign In to Review
              </Button>
            </div>
          ) : userHasReview ? (
            <div className="text-center">
              <p className="text-muted-foreground">Thank you for your review!</p>
            </div>
          ) : showForm ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Your Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setNewRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= newRating ? "text-warning fill-warning" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Your Review</label>
                <Textarea
                  value={newReview}
                  onChange={(e) => setNewReview(e.target.value)}
                  placeholder="Share your experience with SYNOVA..."
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground mt-1">{newReview.length}/500</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Review"}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Share your experience with SYNOVA</p>
              <Button onClick={() => setShowForm(true)}>Write a Review</Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
