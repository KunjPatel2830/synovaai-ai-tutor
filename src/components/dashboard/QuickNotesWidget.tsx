import { useState, useEffect } from "react";
import { StickyNote, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const NOTES_KEY = "synova_quick_notes";

interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export function QuickNotesWidget() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(NOTES_KEY);
    if (saved) setNotes(JSON.parse(saved));
  }, []);

  const saveNotes = (updated: Note[]) => {
    setNotes(updated);
    localStorage.setItem(NOTES_KEY, JSON.stringify(updated));
  };

  const addNote = () => {
    if (!newNote.trim()) return;
    const note: Note = {
      id: Date.now().toString(),
      text: newNote.trim(),
      createdAt: new Date().toISOString(),
    };
    saveNotes([note, ...notes].slice(0, 5));
    setNewNote("");
    setIsAdding(false);
  };

  const removeNote = (id: string) => {
    saveNotes(notes.filter((n) => n.id !== id));
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-warning" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Notes</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIsAdding(!isAdding)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {isAdding && (
        <div className="mb-3 space-y-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Jot something down..."
            rows={2}
            className="text-sm resize-none"
            maxLength={200}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={addNote} className="text-xs h-7">Save</Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewNote(""); }} className="text-xs h-7">Cancel</Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No notes yet. Tap + to add one!</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="group flex items-start gap-2 p-2.5 rounded-lg bg-muted/40 border border-border/50">
              <p className="text-xs text-foreground flex-1 leading-relaxed">{note.text}</p>
              <button
                onClick={() => removeNote(note.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
