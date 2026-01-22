import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client"; // Edge functions only
import { Image as ImageIcon, X, ZoomIn } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";

interface MarkdownContentProps {
  content: string;
  className?: string;
  enableImageGeneration?: boolean;
  subject?: string;
}

function ConceptImage({ concept, subject }: { concept: string; subject?: string }) {
  const [imageState, setImageState] = useState<{ url?: string; loading: boolean; error?: string }>({
    loading: true,
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const generateImage = async () => {
      try {
        const response = await supabase.functions.invoke("generate-concept-image", {
          body: { concept, subject },
        });

        if (response.error) {
          throw new Error(response.error.message);
        }

        if (response.data?.imageUrl) {
          setImageState({ url: response.data.imageUrl, loading: false });
        } else if (response.data?.text) {
          setImageState({ loading: false, error: "Could not generate image" });
        } else {
          setImageState({ loading: false, error: "No image generated" });
        }
      } catch (error) {
        console.error("Image generation error:", error);
        setImageState({ loading: false, error: "Failed to generate image" });
      }
    };

    generateImage();
  }, [concept, subject]);

  if (imageState.loading) {
    return (
      <div className="my-3">
        <Skeleton className="w-32 h-32 rounded-lg" />
        <p className="text-xs text-muted-foreground mt-1 italic">Generating: {concept}</p>
      </div>
    );
  }

  if (imageState.error || !imageState.url) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg my-2 text-muted-foreground">
        <ImageIcon className="h-4 w-4" />
        <span className="text-xs italic">Diagram: {concept}</span>
      </div>
    );
  }

  return (
    <>
      <div 
        className="my-3 inline-block cursor-pointer group relative"
        onClick={() => setIsExpanded(true)}
      >
        <img
          src={imageState.url}
          alt={concept}
          className="w-32 h-32 object-cover rounded-lg border border-border shadow-sm transition-transform hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
          <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-center italic truncate w-32">{concept}</p>
      </div>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent className="max-w-3xl p-0 bg-transparent border-none">
          <DialogClose className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background">
            <X className="h-4 w-4" />
          </DialogClose>
          <img
            src={imageState.url}
            alt={concept}
            className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
          />
          <p className="text-sm text-center text-foreground bg-background/80 py-2 rounded-b-lg">{concept}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function MarkdownContent({ content, className, enableImageGeneration = true, subject }: MarkdownContentProps) {
  const parsedContent = useMemo(() => {
    if (!enableImageGeneration) return { text: content, images: [] as { concept: string; index: number }[] };

    const imageRegex = /\[IMAGE:\s*([^\]]+)\]/gi;
    const images: { concept: string; placeholder: string }[] = [];
    let match;
    let processedContent = content;

    while ((match = imageRegex.exec(content)) !== null) {
      const concept = match[1].trim();
      const placeholder = `__IMAGE_PLACEHOLDER_${images.length}__`;
      images.push({ concept, placeholder });
      processedContent = processedContent.replace(match[0], `\n\n${placeholder}\n\n`);
    }

    return { text: processedContent, images };
  }, [content, enableImageGeneration]);

  const renderContent = () => {
    if (parsedContent.images.length === 0) {
      return (
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={markdownComponents}
        >
          {parsedContent.text}
        </ReactMarkdown>
      );
    }

    const parts: React.ReactNode[] = [];
    let remainingText = parsedContent.text;

    parsedContent.images.forEach((img, idx) => {
      const [before, after] = remainingText.split(img.placeholder);
      
      if (before) {
        parts.push(
          <ReactMarkdown
            key={`text-${idx}`}
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={markdownComponents}
          >
            {before}
          </ReactMarkdown>
        );
      }

      parts.push(<ConceptImage key={`img-${idx}`} concept={img.concept} subject={subject} />);
      remainingText = after || "";
    });

    if (remainingText) {
      parts.push(
        <ReactMarkdown
          key="text-final"
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={markdownComponents}
        >
          {remainingText}
        </ReactMarkdown>
      );
    }

    return <>{parts}</>;
  };

  const markdownComponents = {
    h2: ({ children }: { children?: React.ReactNode }) => <h2 className="text-lg font-bold mt-4 mb-2">{children}</h2>,
    h3: ({ children }: { children?: React.ReactNode }) => <h3 className="text-base font-semibold mt-3 mb-2">{children}</h3>,
    p: ({ children }: { children?: React.ReactNode }) => <p className="mb-2 last:mb-0">{children}</p>,
    strong: ({ children }: { children?: React.ReactNode }) => <strong className="font-bold">{children}</strong>,
    em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
    ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
    ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
    li: ({ children }: { children?: React.ReactNode }) => <li className="mb-1">{children}</li>,
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{children}</code>
    ),
    pre: ({ children }: { children?: React.ReactNode }) => (
      <pre className="bg-muted p-2 rounded overflow-x-auto mb-2">{children}</pre>
    ),
  };

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      {renderContent()}
    </div>
  );
}
