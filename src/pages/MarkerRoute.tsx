import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, ArrowUp, ArrowDown, ArrowLeft } from "lucide-react";
import { useGetRoute, useSaveRouteMarkers, useRunRoute, useStopRoute } from "@/lib/api-client";

type Row = { markerId: string; kind: "pass" | "inspect"; treeName: string };

const MARKER_NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);
const API = import.meta.env.VITE_API_BASE_URL || "";

function emptyRow(): Row {
  return { markerId: "1", kind: "pass", treeName: "" };
}

export default function MarkerRoute() {
  const { id } = useParams<{ id: string }>();
  const routeId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { data: route, isLoading } = useGetRoute(routeId);
  const saveMarkers = useSaveRouteMarkers();
  const runRoute = useRunRoute();
  const stopRoute = useStopRoute();
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!route) return;
    const loaded = route.stops
      .filter((s) => s.markerId != null)
      .map<Row>((s) => ({
        markerId: String(s.markerId),
        kind: s.kind ?? (s.isReturn ? "pass" : "inspect"),
        treeName: s.treeName ?? "",
      }));
    setRows(loaded.length ? loaded : [emptyRow()]);
  }, [route]);

  const update = (i: number, patch: Partial<Row>) => {
    setMessage(null);
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const remove = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const validate = (): string | null => {
    if (rows.length === 0) return "Add at least one marker.";
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].kind === "inspect" && !rows[i].treeName.trim()) {
        return `Stop ${i + 1}: an inspect marker needs a tree name.`;
      }
    }
    return null;
  };

  const handleSave = () => {
    const problem = validate();
    if (problem) return setMessage(problem);
    saveMarkers.mutate(
      {
        routeId,
        markers: rows.map((r) => ({
          markerId: parseInt(r.markerId, 10),
          kind: r.kind,
          treeName: r.kind === "inspect" ? r.treeName.trim() : "",
        })),
      },
      {
        onSuccess: () => setMessage("Saved!"),
        onError: () => setMessage("Failed to save. Try again."),
      }
    );
  };

  const handleRun = () => {
    if (!window.confirm("The rover will start driving by itself. Is the area clear?")) return;
    runRoute.mutate(
      { routeId },
      {
        onSuccess: () => setMessage("Started! Watch the rover. Press Stop to abort."),
        onError: () => setMessage("Could not start (is a route already running?)."),
      }
    );
  };

  const handleStop = () => {
    stopRoute.mutate(undefined, {
      onSuccess: () => setMessage("Stop sent."),
      onError: () => setMessage("Could not send stop."),
    });
  };

  if (isLoading) return <p className="p-4">Loading...</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/routes")}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to routes
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{route?.name ?? "Route"}: choose markers</CardTitle>
          <CardDescription>
            The rover drives from marker to marker in this order. <strong>Pass through</strong> markers are
            waypoints along the way. <strong>Inspect tree</strong> markers are trees to measure.{" "}
            <a className="underline" href={`${API}/api/markers/sheet`} target="_blank" rel="noreferrer">
              Print the marker sheet
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2 border rounded-md p-3">
              <span className="text-sm text-muted-foreground w-6 pb-2">{i + 1}</span>
              <div className="w-28">
                <Label className="mb-1 block text-sm">Marker #</Label>
                <Select value={row.markerId} onValueChange={(v) => update(i, { markerId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MARKER_NUMBERS.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label className="mb-1 block text-sm">What to do</Label>
                <Select value={row.kind} onValueChange={(v) => update(i, { kind: v as Row["kind"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pass">Pass through</SelectItem>
                    <SelectItem value="inspect">Inspect tree</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {row.kind === "inspect" && (
                <div className="flex-1 min-w-[140px]">
                  <Label className="mb-1 block text-sm">Tree name</Label>
                  <Input
                    value={row.treeName}
                    onChange={(e) => update(i, { treeName: e.target.value })}
                    placeholder="e.g. Apple tree"
                  />
                </div>
              )}
              <div className="flex gap-1 ml-auto">
                <Button variant="ghost" size="icon" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(i)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setRows((p) => [...p, emptyRow()])}>
            <Plus className="w-4 h-4 mr-1" /> Add marker
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSave} disabled={saveMarkers.isPending}>
          {saveMarkers.isPending ? "Saving..." : "Save route"}
        </Button>
        <Button variant="outline" onClick={handleRun} disabled={runRoute.isPending}>
          Run now
        </Button>
        <Button variant="destructive" onClick={handleStop} disabled={stopRoute.isPending}>
          Stop
        </Button>
        {message && <span className="text-sm">{message}</span>}
      </div>
    </div>
  );
}
