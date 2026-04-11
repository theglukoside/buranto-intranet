import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Plus, Trash2, Edit, Download, Calendar, CheckCircle, Clock, Paperclip, ArrowLeft, UsersRound, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Meeting {
  id: number;
  title: string;
  date: string;
  moderator: string | null;
  minute_keeper: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface MeetingItem {
  id: number;
  meeting_id: number;
  team: string;
  category: string;
  content: string;
  author: string | null;
  created_at: string;
  updated_at: string;
}

interface MeetingFile {
  id: number;
  meeting_id: number;
  item_id: number | null;
  filename: string;
  original_name: string;
  mime_type: string | null;
  uploaded_at: string;
}

interface MeetingDetail extends Meeting {
  items: MeetingItem[];
  files: MeetingFile[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TEAMS = [
  { id: "clinical", name: "Clinical", color: "#2196F3" },
  { id: "communications", name: "Communications", color: "#4FC3F7" },
  { id: "data", name: "Data", color: "#00ACC1" },
  { id: "partnerships", name: "Partnerships & Innovation", color: "#4CAF50" },
  { id: "operations", name: "Operations", color: "#8BC34A" },
  { id: "misc", name: "Miscellaneous / Special Topics", color: "#26C6DA" },
];

const CATEGORIES = [
  { id: "highs_lows", name: "Highs & Lows" },
  { id: "prospectives", name: "Prospectives" },
  { id: "input_needed", name: "Input Needed" },
  { id: "decisions_needed", name: "Decisions Needed" },
];

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Fehler" }));
    throw new Error(err.message || "Fehler");
  }
  return res.json();
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <Badge className="bg-green-700 text-green-100 border-0 gap-1">
        <CheckCircle className="h-3 w-3" />
        Abgeschlossen
      </Badge>
    );
  }
  if (status === "active") {
    return (
      <Badge className="bg-yellow-500 text-black border-0 gap-1">
        <Clock className="h-3 w-3" />
        Aktiv
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-zinc-600 text-zinc-400 gap-1">
      <Clock className="h-3 w-3" />
      Entwurf
    </Badge>
  );
}

// ─── Format Date ─────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// ─── Meeting List View ───────────────────────────────────────────────────────

function MeetingList({ onSelect }: { onSelect: (id: number) => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", date: "", moderator: "", minute_keeper: "" });

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["meetings"],
    queryFn: () => apiFetch("/api/meetings"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => apiFetch("/api/meetings", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setShowCreate(false);
      setForm({ title: "", date: "", moderator: "", minute_keeper: "" });
      toast({ title: "Meeting erstellt" });
    },
    onError: (e: Error) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/meetings/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast({ title: "Meeting gelöscht" });
    },
    onError: (e: Error) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  const upcoming = meetings.filter(m => m.status !== "completed");
  const archive = meetings.filter(m => m.status === "completed");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <UsersRound className="h-7 w-7" style={{ color: "#FFE600" }} />
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Montserrat, sans-serif" }}>
              Team Meeting
            </h1>
            <p className="text-zinc-400 text-sm">Protokoll & Boardverwaltung</p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="gap-2 font-semibold"
          style={{ background: "#FFE600", color: "#000" }}
        >
          <Plus className="h-4 w-4" />
          Neues Meeting
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-zinc-400 text-center py-12">Lädt...</div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Aktuelle Meetings</h2>
          <div className="flex flex-col gap-3">
            {upcoming.map(m => (
              <Card
                key={m.id}
                className="border-zinc-800 cursor-pointer hover:border-zinc-600 transition-colors group"
                style={{ background: "#111" }}
                onClick={() => onSelect(m.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div
                        className="w-1 self-stretch rounded-full flex-shrink-0"
                        style={{ background: "#FFE600", minHeight: "40px" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge status={m.status} />
                          <span className="text-zinc-500 text-xs flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(m.date)}
                          </span>
                        </div>
                        <h3 className="text-white font-semibold truncate">{m.title}</h3>
                        <div className="text-zinc-500 text-xs mt-1 flex gap-4">
                          {m.moderator && <span>Moderation: {m.moderator}</span>}
                          {m.minute_keeper && <span>Protokoll: {m.minute_keeper}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-zinc-500 hover:text-red-400 hover:bg-red-400/10"
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(m.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Archive */}
      {archive.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Archiv</h2>
          <div className="flex flex-col gap-3">
            {archive.map(m => (
              <Card
                key={m.id}
                className="border-zinc-800 cursor-pointer hover:border-zinc-600 transition-colors opacity-60 hover:opacity-100"
                style={{ background: "#111" }}
                onClick={() => onSelect(m.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="w-1 self-stretch rounded-full flex-shrink-0 bg-zinc-700" style={{ minHeight: "40px" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge status={m.status} />
                          <span className="text-zinc-500 text-xs flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(m.date)}
                          </span>
                        </div>
                        <h3 className="text-zinc-300 font-semibold truncate">{m.title}</h3>
                        <div className="text-zinc-500 text-xs mt-1 flex gap-4">
                          {m.moderator && <span>Moderation: {m.moderator}</span>}
                          {m.minute_keeper && <span>Protokoll: {m.minute_keeper}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-zinc-600 hover:text-red-400 hover:bg-red-400/10"
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(m.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {!isLoading && meetings.length === 0 && (
        <div className="text-center py-20 text-zinc-500">
          <UsersRound className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Noch keine Meetings vorhanden</p>
          <p className="text-sm mt-1">Erstelle das erste Team Meeting</p>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="border-zinc-800" style={{ background: "#111" }}>
          <DialogHeader>
            <DialogTitle className="text-white">Neues Meeting erstellen</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Titel *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="z.B. Team Meeting Januar 2025"
                className="border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Datum *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Moderator</Label>
              <Input
                value={form.moderator}
                onChange={e => setForm(f => ({ ...f, moderator: e.target.value }))}
                placeholder="Name des Moderators"
                className="border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Protokollführer</Label>
              <Input
                value={form.minute_keeper}
                onChange={e => setForm(f => ({ ...f, minute_keeper: e.target.value }))}
                placeholder="Name des Protokollführers"
                className="border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} className="text-zinc-400">
              Abbrechen
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title || !form.date || createMutation.isPending}
              style={{ background: "#FFE600", color: "#000" }}
              className="font-semibold"
            >
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Cell Item Component ──────────────────────────────────────────────────────

interface CellItemProps {
  item: MeetingItem;
  files: MeetingFile[];
  meetingId: number;
  onDelete: (id: number) => void;
  onUpdate: (id: number, content: string) => void;
  onFileUpload: (file: File, itemId: number) => void;
  onFileDelete: (fileId: number) => void;
}

function CellItem({ item, files, meetingId, onDelete, onUpdate, onFileUpload, onFileDelete }: CellItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.content);
  const fileRef = useRef<HTMLInputElement>(null);

  const itemFiles = files.filter(f => f.item_id === item.id);

  const handleSave = () => {
    if (editValue.trim() && editValue !== item.content) {
      onUpdate(item.id, editValue.trim());
    }
    setEditing(false);
  };

  return (
    <div className="group/item flex flex-col gap-1 py-1.5 border-b border-zinc-800 last:border-0">
      {editing ? (
        <div className="flex items-start gap-1">
          <Textarea
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="text-xs border-zinc-700 bg-zinc-900 text-white min-h-[60px] resize-none p-1.5"
            autoFocus
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSave(); }
              if (e.key === "Escape") { setEditing(false); setEditValue(item.content); }
            }}
          />
          <div className="flex flex-col gap-1">
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-green-400" onClick={handleSave}>
              <CheckCircle className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-zinc-500" onClick={() => { setEditing(false); setEditValue(item.content); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-1 justify-between">
          <span className="text-xs text-zinc-200 leading-snug flex-1 break-words">{item.content}</span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0 ml-1">
            <button
              className="p-0.5 rounded text-zinc-500 hover:text-zinc-200"
              title="Datei anhängen"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 rounded text-zinc-500 hover:text-zinc-200"
              title="Bearbeiten"
              onClick={() => setEditing(true)}
            >
              <Edit className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 rounded text-zinc-500 hover:text-red-400"
              title="Löschen"
              onClick={() => onDelete(item.id)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Files */}
      {itemFiles.length > 0 && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {itemFiles.map(f => (
            <div key={f.id} className="flex items-center gap-1 group/file">
              <FileText className="h-2.5 w-2.5 text-zinc-500 flex-shrink-0" />
              <a
                href={`/api/meetings/files/${f.id}/download`}
                className="text-[10px] text-zinc-400 hover:text-yellow-400 truncate flex-1"
                title={f.original_name}
              >
                {f.original_name}
              </a>
              <button
                className="opacity-0 group-hover/file:opacity-100 text-zinc-600 hover:text-red-400"
                onClick={() => onFileDelete(f.id)}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) { onFileUpload(file, item.id); e.target.value = ""; }
        }}
      />
    </div>
  );
}

// ─── Add Item Input ────────────────────────────────────────────────────────────

interface AddItemInputProps {
  onAdd: (content: string) => void;
}

function AddItemInput({ onAdd }: AddItemInputProps) {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState("");

  const submit = () => {
    if (value.trim()) {
      onAdd(value.trim());
      setValue("");
      setShow(false);
    }
  };

  if (!show) {
    return (
      <button
        className="flex items-center gap-1 text-zinc-600 hover:text-zinc-400 text-xs w-full mt-1 py-0.5 transition-colors"
        onClick={() => setShow(true)}
      >
        <Plus className="h-3 w-3" />
        <span>Hinzufügen</span>
      </button>
    );
  }

  return (
    <div className="mt-1 flex gap-1">
      <Input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Inhalt eingeben..."
        className="text-xs border-zinc-700 bg-zinc-900 text-white h-7 px-2"
        autoFocus
        onKeyDown={e => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") { setShow(false); setValue(""); }
        }}
      />
      <Button size="sm" className="h-7 w-7 p-0 flex-shrink-0" style={{ background: "#FFE600", color: "#000" }} onClick={submit}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0 text-zinc-500" onClick={() => { setShow(false); setValue(""); }}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Meeting Board View ───────────────────────────────────────────────────────

function MeetingBoard({ meetingId, onBack }: { meetingId: number; onBack: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", date: "", moderator: "", minute_keeper: "", notes: "" });
  const cellFileRef = useRef<HTMLInputElement>(null);
  const [pendingCell, setPendingCell] = useState<{ team: string; category: string } | null>(null);

  const { data: meeting, isLoading } = useQuery<MeetingDetail>({
    queryKey: ["meeting", meetingId],
    queryFn: () => apiFetch(`/api/meetings/${meetingId}`),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Meeting>) => apiFetch(`/api/meetings/${meetingId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      setShowEdit(false);
    },
    onError: (e: Error) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: () => apiFetch(`/api/meetings/${meetingId}/complete`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast({ title: "Meeting abgeschlossen" });
    },
    onError: (e: Error) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  const addItemMutation = useMutation({
    mutationFn: (data: { team: string; category: string; content: string }) =>
      apiFetch(`/api/meetings/${meetingId}/items`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting", meetingId] }),
    onError: (e: Error) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, content }: { id: number; content: string }) =>
      apiFetch(`/api/meetings/items/${id}`, { method: "PATCH", body: JSON.stringify({ content }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting", meetingId] }),
    onError: (e: Error) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/meetings/items/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting", meetingId] }),
    onError: (e: Error) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  const uploadFileMutation = useMutation({
    mutationFn: ({ file, itemId }: { file: File; itemId?: number }) => {
      const fd = new FormData();
      fd.append("file", file);
      if (itemId) fd.append("item_id", String(itemId));
      return fetch(`/api/meetings/${meetingId}/files`, { method: "POST", body: fd }).then(r => r.json());
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting", meetingId] });
      toast({ title: "Datei hochgeladen" });
    },
    onError: (e: Error) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/meetings/files/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meeting", meetingId] }),
    onError: (e: Error) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  // Generate and download text report
  const downloadReport = () => {
    if (!meeting) return;
    const lines: string[] = [
      `TEAM MEETING PROTOKOLL`,
      `======================`,
      ``,
      `Titel: ${meeting.title}`,
      `Datum: ${formatDate(meeting.date)}`,
      `Moderator: ${meeting.moderator || "—"}`,
      `Protokollführer: ${meeting.minute_keeper || "—"}`,
      `Status: ${meeting.status}`,
      ``,
      meeting.notes ? `Notizen:\n${meeting.notes}\n` : "",
    ];

    for (const team of TEAMS) {
      const teamItems = meeting.items.filter(i => i.team === team.id);
      if (teamItems.length === 0) continue;
      lines.push(`\n${team.name.toUpperCase()}`);
      lines.push("─".repeat(team.name.length));
      for (const cat of CATEGORIES) {
        const catItems = teamItems.filter(i => i.category === cat.id);
        if (catItems.length === 0) continue;
        lines.push(`\n  ${cat.name}:`);
        for (const item of catItems) {
          lines.push(`    • ${item.content}`);
        }
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Meeting-${meeting.date}-Protokoll.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="text-zinc-400 text-center py-20">Lädt...</div>;
  if (!meeting) return <div className="text-red-400 text-center py-20">Meeting nicht gefunden</div>;

  const openEditDialog = () => {
    setEditForm({
      title: meeting.title,
      date: meeting.date,
      moderator: meeting.moderator || "",
      minute_keeper: meeting.minute_keeper || "",
      notes: meeting.notes || "",
    });
    setShowEdit(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Board Header */}
      <div className="flex-shrink-0 border-b border-zinc-800 px-6 py-4" style={{ background: "#000" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-zinc-400 hover:text-white gap-1 mt-0.5 px-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h1 className="text-xl font-bold text-white" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  {meeting.title}
                </h1>
                <StatusBadge status={meeting.status} />
              </div>
              <div className="flex items-center gap-4 text-zinc-500 text-xs">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(meeting.date)}
                </span>
                {meeting.moderator && <span>Moderation: {meeting.moderator}</span>}
                {meeting.minute_keeper && <span>Protokoll: {meeting.minute_keeper}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={openEditDialog}
              className="text-zinc-400 hover:text-white gap-1"
            >
              <Edit className="h-4 w-4" />
              Bearbeiten
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadReport}
              className="text-zinc-400 hover:text-white gap-1"
            >
              <Download className="h-4 w-4" />
              Bericht
            </Button>
            {meeting.status !== "completed" && (
              <Button
                size="sm"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="gap-1 font-semibold"
                style={{ background: "#FFE600", color: "#000" }}
              >
                <CheckCircle className="h-4 w-4" />
                Abschliessen
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Board Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[900px]">
          {/* Column Headers */}
          <div className="grid border-b border-zinc-800 sticky top-0 z-10" style={{ gridTemplateColumns: "200px repeat(4, 1fr)", background: "#000" }}>
            <div className="p-3 border-r border-zinc-800">
              <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Team</span>
            </div>
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="p-3 border-r border-zinc-800 last:border-0">
                <span className="text-xs font-semibold text-white">{cat.name}</span>
              </div>
            ))}
          </div>

          {/* Team Rows */}
          {TEAMS.map(team => (
            <div
              key={team.id}
              className="grid border-b border-zinc-800"
              style={{ gridTemplateColumns: "200px repeat(4, 1fr)" }}
            >
              {/* Team Name Cell */}
              <div className="p-3 border-r border-zinc-800 flex items-start gap-2" style={{ background: "#0a0a0a" }}>
                <div className="w-0.5 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: team.color }} />
                <span className="text-xs font-semibold text-zinc-300 leading-snug">{team.name}</span>
              </div>

              {/* Category Cells */}
              {CATEGORIES.map(cat => {
                const cellItems = (meeting.items || []).filter(
                  i => i.team === team.id && i.category === cat.id
                );
                return (
                  <div
                    key={cat.id}
                    className="p-2 border-r border-zinc-800 last:border-0 min-h-[80px]"
                    style={{ background: "#080808" }}
                  >
                    {cellItems.map(item => (
                      <CellItem
                        key={item.id}
                        item={item}
                        files={meeting.files || []}
                        meetingId={meetingId}
                        onDelete={id => deleteItemMutation.mutate(id)}
                        onUpdate={(id, content) => updateItemMutation.mutate({ id, content })}
                        onFileUpload={(file, itemId) => uploadFileMutation.mutate({ file, itemId })}
                        onFileDelete={fileId => deleteFileMutation.mutate(fileId)}
                      />
                    ))}
                    {meeting.status !== "completed" && (
                      <AddItemInput
                        onAdd={content => addItemMutation.mutate({ team: team.id, category: cat.id, content })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="border-zinc-800" style={{ background: "#111" }}>
          <DialogHeader>
            <DialogTitle className="text-white">Meeting bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Titel *</Label>
              <Input
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                className="border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Datum *</Label>
              <Input
                type="date"
                value={editForm.date}
                onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                className="border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Moderator</Label>
              <Input
                value={editForm.moderator}
                onChange={e => setEditForm(f => ({ ...f, moderator: e.target.value }))}
                className="border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Protokollführer</Label>
              <Input
                value={editForm.minute_keeper}
                onChange={e => setEditForm(f => ({ ...f, minute_keeper: e.target.value }))}
                className="border-zinc-700 bg-zinc-900 text-white"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-zinc-300">Notizen</Label>
              <Textarea
                value={editForm.notes}
                onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                className="border-zinc-700 bg-zinc-900 text-white resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEdit(false)} className="text-zinc-400">
              Abbrechen
            </Button>
            <Button
              onClick={() => updateMutation.mutate({
                title: editForm.title,
                date: editForm.date,
                moderator: editForm.moderator || null,
                minute_keeper: editForm.minute_keeper || null,
                notes: editForm.notes || null,
              } as any)}
              disabled={!editForm.title || !editForm.date || updateMutation.isPending}
              style={{ background: "#FFE600", color: "#000" }}
              className="font-semibold"
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden cell file input */}
      <input
        ref={cellFileRef}
        type="file"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && pendingCell) {
            uploadFileMutation.mutate({ file });
            setPendingCell(null);
            e.target.value = "";
          }
        }}
      />
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function TeamMeeting() {
  const params = useParams<{ id?: string }>();
  const [, setLocation] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(
    params.id ? parseInt(params.id) : null
  );

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setLocation(`/team-meeting/${id}`);
  };

  const handleBack = () => {
    setSelectedId(null);
    setLocation("/team-meeting");
  };

  if (selectedId) {
    return (
      <div className="h-full flex flex-col" style={{ background: "#000" }}>
        <MeetingBoard meetingId={selectedId} onBack={handleBack} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto" style={{ background: "#000" }}>
      <MeetingList onSelect={handleSelect} />
    </div>
  );
}
