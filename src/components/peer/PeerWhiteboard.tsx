import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Pen, Eraser, Trash2, Undo } from "lucide-react";
import { cn } from "@/lib/utils";

interface DrawPoint {
  x: number;
  y: number;
  color: string;
  size: number;
  type: "draw" | "erase";
}

interface Stroke {
  id: string;
  points: DrawPoint[];
  userId: string;
}

interface PeerWhiteboardProps {
  roomId: string;
}

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#000000", // black
  "#ffffff", // white
];

export function PeerWhiteboard({ roomId }: PeerWhiteboardProps) {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState("#3b82f6");
  const [brushSize, setBrushSize] = useState(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawPoint[]>([]);

  // Draw all strokes on canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes
    [...strokes, { id: "current", points: currentStroke, userId: user?.id || "" }].forEach(
      (stroke) => {
        if (stroke.points.length < 2) return;

        ctx.beginPath();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        for (let i = 0; i < stroke.points.length; i++) {
          const point = stroke.points[i];
          ctx.strokeStyle = point.type === "erase" ? "#1a1a2e" : point.color;
          ctx.lineWidth = point.size;

          if (i === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        }
        ctx.stroke();
      }
    );
  }, [strokes, currentStroke, user?.id]);

  // Resize canvas to fit container
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [redrawCanvas]);

  // Load existing whiteboard data
  useEffect(() => {
    const loadWhiteboard = async () => {
      const { data } = await supabase
        .from("peer_whiteboard_data")
        .select("data")
        .eq("room_id", roomId)
        .single();

      if (data?.data && Array.isArray(data.data)) {
        setStrokes(data.data as unknown as Stroke[]);
      }
    };

    loadWhiteboard();

    // Subscribe to whiteboard updates
    const channel = supabase
      .channel(`whiteboard-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "peer_whiteboard_data",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new && "data" in payload.new) {
            const newData = payload.new.data;
            if (Array.isArray(newData)) {
              setStrokes(newData as Stroke[]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Redraw when strokes change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Save whiteboard to database
  const saveWhiteboard = async (newStrokes: Stroke[]) => {
    await supabase
      .from("peer_whiteboard_data")
      .update({ data: JSON.parse(JSON.stringify(newStrokes)), updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq("room_id", roomId);
  };

  // Get point from mouse/touch event
  const getPoint = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY : e.clientY;

    if (clientX === undefined || clientY === undefined) return null;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const point = getPoint(e);
    if (!point) return;

    setIsDrawing(true);
    setCurrentStroke([
      {
        ...point,
        color,
        size: tool === "eraser" ? brushSize * 3 : brushSize,
        type: tool === "eraser" ? "erase" : "draw",
      },
    ]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const point = getPoint(e);
    if (!point) return;

    setCurrentStroke((prev) => [
      ...prev,
      {
        ...point,
        color,
        size: tool === "eraser" ? brushSize * 3 : brushSize,
        type: tool === "eraser" ? "erase" : "draw",
      },
    ]);
  };

  const stopDrawing = () => {
    if (!isDrawing || currentStroke.length === 0) return;

    setIsDrawing(false);
    const newStroke: Stroke = {
      id: crypto.randomUUID(),
      points: currentStroke,
      userId: user?.id || "",
    };

    const newStrokes = [...strokes, newStroke];
    setStrokes(newStrokes);
    setCurrentStroke([]);
    saveWhiteboard(newStrokes);
  };

  const undo = () => {
    if (strokes.length === 0) return;
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    saveWhiteboard(newStrokes);
  };

  const clearCanvas = () => {
    setStrokes([]);
    saveWhiteboard([]);
  };

  return (
    <GlassCard className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-3 border-b border-border flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          <Button
            variant={tool === "pen" ? "default" : "outline"}
            size="icon"
            onClick={() => setTool("pen")}
          >
            <Pen className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "outline"}
            size="icon"
            onClick={() => setTool("eraser")}
          >
            <Eraser className="h-4 w-4" />
          </Button>
        </div>

        {/* Colors */}
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-transform",
                color === c ? "border-primary scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-2 min-w-[100px]">
          <Slider
            value={[brushSize]}
            onValueChange={([v]) => setBrushSize(v)}
            min={1}
            max={20}
            step={1}
          />
        </div>

        <div className="flex gap-1 ml-auto">
          <Button variant="outline" size="icon" onClick={undo}>
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="destructive" size="icon" onClick={clearCanvas}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </GlassCard>
  );
}
