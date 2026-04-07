import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { CalendarDays, Plus, Edit, Trash2, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Event } from "@shared/schema";

const categoryColors: Record<string, string> = {
  Gemeinde: "bg-blue-500/20 text-blue-400",
  Kultur: "bg-purple-500/20 text-purple-400",
  Sport: "bg-green-500/20 text-green-400",
  Privat: "bg-amber-500/20 text-amber-400",
};

const categories = ["Gemeinde", "Kultur", "Sport", "Privat"];

function EventForm({
  event,
  onSubmit,
  onClose,
}: {
  event?: Event;
  onSubmit: (data: { title: string; description: string; date: string; time: string; category: string }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(event?.title || "");
  const [description, setDescription] = useState(event?.description || "");
  const [date, setDate] = useState(event?.date || "");
  const [time, setTime] = useState(event?.time || "");
  const [category, setCategory] = useState(event?.category || "Privat");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !category) return;
    onSubmit({ title, description, date, time, category });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Titel *</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Termin-Titel" data-testid="input-event-title" />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Beschreibung</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details..." data-testid="input-event-description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Datum *</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-event-date" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Uhrzeit</label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="input-event-time" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Kategorie *</label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger data-testid="select-event-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
        <Button type="submit" data-testid="button-save-event">Speichern</Button>
      </DialogFooter>
    </form>
  );
}

export default function Termine() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description: string; date: string; time: string; category: string }) =>
      apiRequest("POST", "/api/events", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/events"] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Event> }) =>
      apiRequest("PATCH", `/api/events/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/events"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/events/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/events"] }),
  });

  const handleSubmit = (data: { title: string; description: string; date: string; time: string; category: string }) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
    setEditingEvent(undefined);
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };

  // Group by date
  const grouped = events.reduce<Record<string, Event[]>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date].push(e);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Termine</h1>
          <p className="text-sm text-muted-foreground">Veranstaltungen in Sissach</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingEvent(undefined); }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-event">
              <Plus className="h-4 w-4 mr-1.5" /> Neuer Termin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEvent ? "Termin bearbeiten" : "Neuer Termin"}</DialogTitle>
            </DialogHeader>
            <EventForm
              event={editingEvent}
              onSubmit={handleSubmit}
              onClose={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((c) => (
          <Badge key={c} variant="outline" className={`text-xs cursor-default ${categoryColors[c]}`}>
            {c}
          </Badge>
        ))}
      </div>

      {/* Events List */}
      {isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Laden...</CardContent></Card>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarDays className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Keine Termine vorhanden</p>
            <p className="text-xs text-muted-foreground mt-1">Erstellen Sie Ihren ersten Termin.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((date) => (
            <div key={date}>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                {new Date(date + "T00:00:00").toLocaleDateString("de-CH", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <div className="space-y-2">
                {grouped[date].map((event) => (
                  <Card key={event.id} data-testid={`card-event-${event.id}`}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${categoryColors[event.category]}`}>
                          {event.category}
                        </Badge>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{event.title}</div>
                          {event.description && (
                            <div className="text-xs text-muted-foreground truncate">{event.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {event.time && (
                          <span className="text-xs text-muted-foreground tabular-nums flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {event.time}
                          </span>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(event)} data-testid={`button-edit-event-${event.id}`}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMutation.mutate(event.id)}
                          data-testid={`button-delete-event-${event.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
