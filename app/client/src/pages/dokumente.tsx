import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FolderOpen, Upload, Download, Trash2, FileText, File, FileImage, FileArchive,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Document } from "@shared/schema";

const CATEGORIES = ["Alle", "Verträge", "Versicherungen", "Haus", "Fahrzeuge", "Finanzen", "Sonstiges"];

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

function getFileIcon(mime: string | null) {
  if (!mime) return File;
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("pdf") || mime.includes("document")) return FileText;
  if (mime.includes("zip") || mime.includes("archive")) return FileArchive;
  return File;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Dokumente() {
  const [category, setCategory] = useState("Alle");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadCategory, setUploadCategory] = useState("Sonstiges");

  const { data: docs = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: globalThis.File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", uploadCategory);
      const res = await fetch(`${API_BASE}/api/documents/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload fehlgeschlagen");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/documents"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/documents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/documents"] }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      uploadMutation.mutate(files[i]);
    }
    e.target.value = "";
  };

  const handleDownload = (id: number, name: string) => {
    const link = document.createElement("a");
    link.href = `${API_BASE}/api/documents/${id}/download`;
    link.download = name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = category === "Alle" ? docs : docs.filter((d) => d.category === category);

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dokumente</h1>
          <p className="text-sm text-muted-foreground">Dateiverwaltung & Archiv</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={uploadCategory} onValueChange={setUploadCategory}>
            <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-upload-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.filter((c) => c !== "Alle").map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-upload">
            <Upload className="h-4 w-4 mr-1.5" /> Hochladen
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="hidden"
            data-testid="input-file-upload"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <Badge
            key={c}
            variant={category === c ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setCategory(c)}
            data-testid={`filter-category-${c.toLowerCase()}`}
          >
            {c} {c !== "Alle" ? `(${docs.filter((d) => d.category === c).length})` : `(${docs.length})`}
          </Badge>
        ))}
      </div>

      {/* Documents Table */}
      {isLoading ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">Laden...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FolderOpen className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Keine Dokumente vorhanden</p>
            <p className="text-xs text-muted-foreground mt-1">Laden Sie Dateien hoch, um zu beginnen.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Kategorie</TableHead>
                  <TableHead className="text-right">Grösse</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((doc) => {
                  const Icon = getFileIcon(doc.mimeType);
                  return (
                    <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                      <TableCell>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{doc.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                        {formatSize(doc.size)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground tabular-nums">
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString("de-CH") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(doc.id, doc.name)}
                            data-testid={`button-download-${doc.id}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate(doc.id)}
                            data-testid={`button-delete-doc-${doc.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
