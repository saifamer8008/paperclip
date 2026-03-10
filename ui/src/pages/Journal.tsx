
import { HudPageShell } from "@/components/HudPageShell";
import { GlassCard } from "@/components/ui/glass-card";
import { MarkdownBody } from "@/components/MarkdownBody";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, NotebookPen } from "lucide-react";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface JournalEntry {
  filename: string;
  date: string;
  sizeBytes: number;
  preview: string;
}

interface JournalEntryContent {
  filename: string;
  content: string;
}

interface SearchResult {
  file: string;
  line: string;
  lineNumber: number;
  context: string;
}

const fetchEntries = async (): Promise<JournalEntry[]> => {
  const res = await fetch("/api/journal/entries");
  if (!res.ok) {
    throw new Error("Network response was not ok");
  }
  return res.json();
};

const fetchEntry = async (filename: string): Promise<JournalEntryContent> => {
  const res = await fetch(`/api/journal/entry?file=${filename}`);
  if (!res.ok) {
    throw new Error("Network response was not ok");
  }
  return res.json();
};

const searchEntries = async (query: string): Promise<SearchResult[]> => {
  if (!query) return [];
  const res = await fetch(`/api/journal/search?q=${query}`);
  if (!res.ok) {
    throw new Error("Network response was not ok");
  }
  return res.json();
};

const addNote = async ({ filename, content }: { filename: string; content: string }) => {
  const res = await fetch("/api/journal/entry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename, content }),
  });
  if (!res.ok) {
    throw new Error("Network response was not ok");
  }
  return res.json();
};

export function Journal() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");

  const {
    data: entries = [],
    isLoading: isLoadingEntries,
    refetch: refetchEntries,
  } = useQuery({ queryKey: ["journalEntries"], queryFn: fetchEntries });

  const { data: entry, isLoading: isLoadingEntry } = useQuery({
    queryKey: ["journalEntry", selectedFile],
    queryFn: () => fetchEntry(selectedFile!),
    enabled: !!selectedFile,
  });

  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ["journalSearch", searchQuery],
    queryFn: () => searchEntries(searchQuery),
    enabled: !!searchQuery,
  });

  const addNoteMutation = useMutation({
    mutationFn: addNote,
    onSuccess: () => {
      refetchEntries();
      setIsAddNoteOpen(false);
      setNewNoteContent("");
      // refetch the current entry if it's today
      if (selectedFile === `${new Date().toISOString().split("T")[0]}.md`) {
        fetchEntry(selectedFile);
      }
    },
  });

  const handleAddNote = () => {
    const today = new Date().toISOString().split("T")[0];
    const filename = `${today}.md`;
    addNoteMutation.mutate({ filename, content: `\n\n${newNoteContent}` });
  };

  if (isLoadingEntries) {
    return <div>Loading...</div>;
  }

  return (
    <HudPageShell title="Journal" icon={BookOpen}>
      <div className="flex h-full gap-4">
        <GlassCard className="w-64 p-2">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-mono text-gold-400">Entries</h2>
            <Dialog open={isAddNoteOpen} onOpenChange={setIsAddNoteOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <NotebookPen className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add to Today's Journal</DialogTitle>
                </DialogHeader>
                <Textarea
                  value={newNoteContent}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setNewNoteContent(e.target.value)
                  }
                  placeholder="Type your note here."
                />
                <Button onClick={handleAddNote} disabled={addNoteMutation.isPending}>
                  {addNoteMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex flex-col gap-1 overflow-y-auto">
            {entries.map((e: JournalEntry) => (
              <button
                key={e.filename}
                onClick={() => setSelectedFile(e.filename)}
                className={`text-left text-[11px] font-mono p-1 rounded-sm ${
                  selectedFile === e.filename
                    ? "bg-gold-900/50 text-gold-200 border-l-2 border-gold-400"
                    : "text-gray-400 hover:bg-gray-800"
                }`}
              >
                {e.date}
              </button>
            ))}
          </div>
        </GlassCard>
        <div className="flex-1 flex flex-col gap-4">
          <Input
            placeholder="Search journal..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(e.target.value)
            }
            className="font-mono"
          />
          <GlassCard className="flex-1 p-4 overflow-y-auto">
            {searchQuery ? (
              <div>
                {isSearching && <div>Searching...</div>}
                {searchResults.map((result: SearchResult, i: number) => (
                  <div key={i} className="mb-2">
                    <div className="text-sm font-mono text-gold-400">
                      {result.file}
                    </div>
                    <div className="text-xs text-gray-400">{result.line}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {isLoadingEntry && <div>Loading entry...</div>}
                {entry && <MarkdownBody>{entry.content}</MarkdownBody>}
                {!selectedFile && (
                  <div className="text-center text-gray-500">
                    Select an entry to view
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </HudPageShell>
  );
}
