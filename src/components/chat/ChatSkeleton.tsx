import { Skeleton } from "@/components/ui/skeleton";

export function ChatSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {/* User message skeleton */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-48 rounded-2xl" />
      </div>
      
      {/* Assistant message skeleton - multiple lines */}
      <div className="flex justify-start">
        <div className="space-y-2 max-w-[80%]">
          <Skeleton className="h-4 w-64 rounded" />
          <Skeleton className="h-4 w-56 rounded" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>
      </div>
      
      {/* Another user message */}
      <div className="flex justify-end">
        <Skeleton className="h-10 w-36 rounded-2xl" />
      </div>
      
      {/* Another assistant response */}
      <div className="flex justify-start">
        <div className="space-y-2 max-w-[80%]">
          <Skeleton className="h-4 w-72 rounded" />
          <Skeleton className="h-4 w-60 rounded" />
        </div>
      </div>
    </div>
  );
}
