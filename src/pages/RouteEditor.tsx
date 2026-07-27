import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash2, Plus, ArrowUp, ArrowDown, ArrowLeft, MapPin, Save } from "lucide-react";
import { useGetRoute, useSaveRouteStops, useGetLiveGpsLocation, type RouteStop } from "@/lib/api-client";

function emptyStop(): RouteStop {
  return { treeName: "", latitude: NaN, longitude: NaN };
}

export default function RouteEditor() {
  const { id } = useParams<{ id: string }>();
  const routeId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const { data: route, isLoading } = useGetRoute(routeId);
  const saveStops = useSaveRouteStops();
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [saved, setSaved] = useState(false);
  const [liveTrackingOn, setLiveTrackingOn] = useState(true);
  const { data: liveGps, isFetching: gpsLoading } = useGetLiveGpsLocation(liveTrackingOn);

  useEffect(() => {
    if (route) setStops(route.stops.length ? route.stops : [emptyStop()]);
  }, [route]);

  const updateStop = (i: number, patch: Partial<RouteStop>) => {
    setStops((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  const captureCurrentLocation = (i: number) => {
    if (!liveGps?.hasFix || liveGps.latitude == null || liveGps.longitude == null) return;
    updateStop(i, { latitude: liveGps.latitude, longitude: liveGps.longitude });
  };

  const addStop = () => setStops((prev) => [...prev, emptyStop()]);
  const removeStop = (i: number) => setStops((prev) => prev.filter((_, idx) => idx !== i));
  const moveStop = (i: number, dir: -1 | 1) => {
    setStops((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const canSave = stops.every(
    (s) => s.treeName.trim() && Number.isFinite(s.latitude) && Number.isFinite(s.longitude)
  );

  const handleSave = () => {
    setSaved(false);
    saveStops.mutate({ routeId, stops }, { onSuccess: () => setSaved(true) });
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading route...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      <div>
        <Button variant="ghost" size="sm" onClick={() => setLocation("/routes")} className="mb-2 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to routes
        </Button>
        <h1 className="text-3xl font-serif">Set Locations{route ? `: ${route.name}` : ""}</h1>
        <p className="text-muted-foreground mt-1">
          Drive the car to each tree (using the rover's own control page), then click "Use current location" to save that spot.
        </p>
      </div>

      <Card className="bg-muted/40">
        <CardContent className="pt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            {!liveTrackingOn ? (
              <span className="text-sm text-muted-foreground">Live tracking paused</span>
            ) : gpsLoading && !liveGps ? (
              <span className="text-sm text-muted-foreground">Checking GPS...</span>
            ) : liveGps?.hasFix ? (
              <span className="text-sm">
                Car is currently at <strong>{liveGps.latitude?.toFixed(6)}, {liveGps.longitude?.toFixed(6)}</strong>
              </span>
            ) : (
              <span className="text-sm text-destructive">No GPS fix right now</span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setLiveTrackingOn((v) => !v)}>
            {liveTrackingOn ? "Pause" : "Resume"} tracking
          </Button>
        </CardContent>
      </Card>

      {stops.map((stop, stopIdx) => (
        <Card key={stopIdx}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-muted-foreground font-mono text-sm">#{stopIdx + 1}</span>
              {stop.isReturn && (
                <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">🏠 Return to station</span>
              )}
              <Input
                placeholder="Tree name (e.g. Tree_1)"
                value={stop.treeName}
                onChange={(e) => updateStop(stopIdx, { treeName: e.target.value })}
                className="max-w-xs"
              />
              <Input
                type="number" min={0} max={49}
                placeholder="Marker #"
                value={stop.markerId ?? ""}
                onChange={(e) => updateStop(stopIdx, { markerId: e.target.value ? parseInt(e.target.value, 10) : null })}
                className="w-24"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => moveStop(stopIdx, -1)} disabled={stopIdx === 0}>
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => moveStop(stopIdx, 1)} disabled={stopIdx === stops.length - 1}>
                <ArrowDown className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => removeStop(stopIdx)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline" size="sm"
              onClick={() => captureCurrentLocation(stopIdx)}
              disabled={!liveGps?.hasFix}
            >
              <MapPin className="w-4 h-4 mr-1" /> Use current location
            </Button>
            {Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude) ? (
              <span className="text-sm text-muted-foreground font-mono">
                {stop.latitude.toFixed(6)}, {stop.longitude.toFixed(6)}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">No location saved yet</span>
            )}
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addStop} className="w-full">
        <Plus className="w-4 h-4 mr-1" /> Add tree stop
      </Button>

      <div className="flex items-center gap-3 sticky bottom-4 bg-background/95 backdrop-blur p-4 rounded-lg border">
        <Button onClick={handleSave} disabled={!canSave || saveStops.isPending}>
          <Save className="w-4 h-4 mr-1" /> {saveStops.isPending ? "Saving..." : "Save route"}
        </Button>
        {!canSave && <span className="text-sm text-muted-foreground">Every stop needs a name and a saved location</span>}
        {saved && <span className="text-sm text-green-600">Saved — the car will use these locations next run</span>}
        {saveStops.isError && <span className="text-sm text-destructive">Failed to save. Try again.</span>}
      </div>
    </div>
  );
}
