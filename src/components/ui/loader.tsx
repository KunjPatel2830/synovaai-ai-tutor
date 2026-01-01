import { cn } from "@/lib/utils";

interface LoaderProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Loader({ className, size = "md" }: LoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  const dotSizeClasses = {
    sm: "h-1 w-1",
    md: "h-1.5 w-1.5",
    lg: "h-2 w-2",
  };

  return (
    <div className={cn("flex items-center gap-1", sizeClasses[size], className)}>
      <span
        className={cn(
          "rounded-full bg-primary animate-bounce",
          dotSizeClasses[size]
        )}
        style={{ animationDelay: "0ms", animationDuration: "600ms" }}
      />
      <span
        className={cn(
          "rounded-full bg-primary animate-bounce",
          dotSizeClasses[size]
        )}
        style={{ animationDelay: "150ms", animationDuration: "600ms" }}
      />
      <span
        className={cn(
          "rounded-full bg-primary animate-bounce",
          dotSizeClasses[size]
        )}
        style={{ animationDelay: "300ms", animationDuration: "600ms" }}
      />
    </div>
  );
}

export function LoaderSpinner({ className, size = "md" }: LoaderProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
    </div>
  );
}
