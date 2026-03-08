import { useState, useEffect, useRef, useCallback } from "react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { cn } from "@/lib/utils";

interface TypingMarkdownProps {
  content: string;
  className?: string;
  /** Speed in characters per frame (~16ms). Higher = faster. */
  speed?: number;
  /** Whether to animate. If false, renders immediately. */
  animate?: boolean;
  /** Called when typing animation completes */
  onComplete?: () => void;
  enableImageGeneration?: boolean;
  subject?: string;
}

export function TypingMarkdown({
  content,
  className,
  speed = 8,
  animate = true,
  onComplete,
  enableImageGeneration,
  subject,
}: TypingMarkdownProps) {
  const [displayLength, setDisplayLength] = useState(animate ? 0 : content.length);
  const [isComplete, setIsComplete] = useState(!animate);
  const rafRef = useRef<number>(0);
  const prevContentRef = useRef(content);

  // If content changes (new message loaded from history), show immediately
  useEffect(() => {
    if (prevContentRef.current !== content) {
      // Content changed — if it's a completely new message, reset animation
      if (content.length > prevContentRef.current.length + 20) {
        // Likely a new response, not an append
        if (animate) {
          setDisplayLength(0);
          setIsComplete(false);
        } else {
          setDisplayLength(content.length);
          setIsComplete(true);
        }
      }
      prevContentRef.current = content;
    }
  }, [content, animate]);

  const tick = useCallback(() => {
    setDisplayLength((prev) => {
      const next = Math.min(prev + speed, content.length);
      if (next >= content.length) {
        setIsComplete(true);
        onComplete?.();
        return content.length;
      }
      rafRef.current = requestAnimationFrame(tick);
      return next;
    });
  }, [content.length, speed, onComplete]);

  useEffect(() => {
    if (!animate || isComplete) return;

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, isComplete, tick]);

  // When content grows (streaming append), keep revealing
  useEffect(() => {
    if (isComplete && content.length > displayLength) {
      setIsComplete(false);
    }
  }, [content.length, displayLength, isComplete]);

  // Ensure we don't cut in the middle of a markdown token
  const safeSlice = (text: string, len: number): string => {
    if (len >= text.length) return text;
    let slice = text.slice(0, len);

    // Don't cut inside a LaTeX block
    const lastDollar = slice.lastIndexOf("$");
    if (lastDollar !== -1) {
      const before = slice.slice(0, lastDollar);
      const dollarCount = (before.match(/\\$/g) || []).length;
      // If odd number of $, we're inside a LaTeX expression
      if (dollarCount % 2 !== 0) {
        slice = slice.slice(0, lastDollar);
      }
    }

    // Don't cut inside a code fence
    const fenceCount = (slice.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) {
      const lastFence = slice.lastIndexOf("```");
      slice = slice.slice(0, lastFence);
    }

    return slice;
  };

  const visibleContent = isComplete ? content : safeSlice(content, displayLength);

  return (
    <div className={cn("relative", className)}>
      <MarkdownContent
        content={visibleContent}
        enableImageGeneration={enableImageGeneration}
        subject={subject}
      />
      {!isComplete && (
        <span className="inline-block w-[2px] h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
      )}
    </div>
  );
}
