import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Flag, Save, Trash2, Home } from "lucide-react";
import { useSaveRouteStops } from "@/lib/api-client";

const SPEED = 0.3;
const ROVER_HEARTBEAT_TIMEOUT_MS = 15000;

type Action = "forward" | "backward" | "turn_left" | "turn_right";

interface PreciseRouteStep {
  action: Action;
  left_pulses: number;
  right_pulses: number;
  speed: number;
}

interface PreciseRouteStop {
  treeName: string;
  markerId: number | null;
  steps: PreciseRouteStep[];
  isReturn?: boolean;
}

const DIRECTION_VECTORS: Record<Action, { left: number; right: number }> = {
  forward: { left: SPEED, right: SPEED },
  backward: { left: -SPEED, right: -SPEED },
  turn_left: { left: -SPEED, right: SPEED },
  turn_right: { left: SPEED, right: -SPEED },
};

export default function Drive() {
  const { id } = useParams<{ id: string }>();
  const routeId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const saveStops = useSaveRouteStops();

  const [stops, setStops] = useState<PreciseRouteStop[]>([]);
  const [currentSteps, setCurrentSteps] = useState<PreciseRouteStep[]>([]);
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [treeName, setTreeName] = useState("");
  const [markerId, setMarkerId] = useState("");
  const [saved, setSaved] = useState(false);
  const [returnedToStation, setReturnedToStation] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  const keepaliveInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const sendDriveCommand = async (left: number, right: number) => {
    try {
      setDriveError(null);
      await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ left, right }),
      });
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : "Network failure");
    }
  };

  const sendKeepalive = async () => {
    try {
      await fetch("/api/keepalive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeoutMs: ROVER_HEARTBEAT_TIMEOUT_MS }),
      });
    } catch (err) {
      console.warn("Heartbeat connection lost:", err);
    }
  };

  useEffect(() => {
    sendKeepalive();
    keepaliveInterval.current = setInterval(
      () => sendKeepalive(),
      ROVER_HEARTBEAT_TIMEOUT_MS - 5000
    );
    return () => {
      if (keepaliveInterval.current) clearInterval(keepaliveInterval.current);
    };
  }, []);

  const startAction = (action: Action) => {
    if (activeAction) return; 
    setActiveAction(action);
    const vector = DIRECTION_VECTORS[action];
    sendDriveCommand(vector.left, vector.right);
  };

  const endAction = async () => {
    if (!activeAction) return;
    await sendDriveCommand(0, 0);
    
    try {
      const response = await fetch("/api/drive/stop", { method: "POST" });
      if (response.ok) {
        const telemetry = await response.json(); 
        setCurrentSteps((prev) => [
          ...prev,
          {
            action: activeAction,
            left_pulses: telemetry.left_pulses || 0,
            right_pulses: telemetry.right_pulses || 0,
            speed: SPEED,
          },
        ]);
      }
    } catch (err) {
      console.error("Encoder connection drop:", err);
    }
    setActiveAction(null);
  };

  const addStop = () => {
    if (!treeName.trim() || currentSteps.length === 0) return;
    setStops((prev) => [
      ...prev,
      {
        treeName: treeName.trim(),
        markerId: markerId ? parseInt(markerId, 10) : null,
        steps: currentSteps,
      },
    ]);
    setCurrentSteps([]);
    setTreeName("");
    setMarkerId("");
  };

  const removeStop = (i: number) => {
    setStops((prev) => {
      const removed = prev[i];
      if (removed?.isReturn) setReturnedToStation(false);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const markBackAtStation = () => {
    if (currentSteps.length === 0) return;
    setStops((prev) => [...prev, { treeName: "Station", isReturn: true, steps: currentSteps }]);
    setCurrentSteps([]);
    setReturnedToStation(true);
  };

  const handleSaveRoute = () => {
    setSaved(false);
    saveStops.mutate({ routeId, stops }, { onSuccess: () => setSaved(true) });
  };

  const DirButton = ({ action, icon: Icon, className }: { action: Action; icon: typeof ArrowUp; className?: string }) => (
    <button
      disabled={returnedToStation}
      className={`w-16 h-16 rounded-lg border-2 flex items-center justify-center transition-colors select-none disabled:opacity-40 disabled:cursor-not-allowed ${
        activeAction === action ? "bg-primary border-primary text-primary-foreground" : "border-primary hover:bg-muted"
      } ${className || ""}`}
      onMouseDown={() => startAction(action)}
      onMouseUp={endAction}
      onMouseLeave={() => activeAction === action && endAction()}
      onTouchStart={(e) => { e.preventDefault(); startAction(action); }}
      onTouchEnd={(e) => { e.preventDefault(); endAction(); }}
    >
      <Icon className="w-6 h-6" />
    </button>
  );
  
 return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24">
      <div>
        <Button variant="ghost" size="sm" onClick={() => setLocation("/routes")} className="mb-2 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to routes
        </Button>
        <h1 className="text-3xl font-serif">Drive & Record Route (Precision Encoder Mode)</h1>
        <p className="text-muted-foreground mt-1">
          Steer the car in the field. Physical wheel rotations are mapped to isolate and eliminate terrain drift.
        </p>
      </div>

      <Card className="bg-muted/40 border-dashed">
        <CardContent className="pt-6">
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Line the rover up at the home dock/station before driving.</li>
            <li>Manually drive to each tree corridor using the track pad.</li>
            <li>Lock your positions with <strong>"Add stop"</strong> to log wheel vectors.</li>
            <li>When done with your final leg, drive back near the terminal station hub.</li>
            <li>Click <strong>"I'm back at the station"</strong> to unlock the auto-inversion return route compiler.</li>
          </ol>
        </CardContent>
      </Card>

      {returnedToStation && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6 text-green-800 text-sm">
            Route structural tracing complete! Click "Save route" to construct the automatic inverted return script.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-2">
          <DirButton action="forward" icon={ArrowUp} />
          <div className="flex gap-2">
            <DirButton action="turn_left" icon={ArrowLeft} />
            <DirButton action="backward" icon={ArrowDown} />
            <DirButton action="turn_right" icon={ArrowRight} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {currentSteps.length > 0
              ? `${currentSteps.length} pulse segments logged`
              : "Drive to map out your tracking paths"}
          </p>
          {driveError && <p className="text-xs text-destructive mt-1">Connection Error: {driveError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Register Target Stop Vector</CardTitle></CardHeader>
        <CardContent className="flex items-end gap-3 flex-wrap">
          <div>
            <Label className="mb-1 block text-sm">Tree Row Label</Label>
            <Input value={treeName} onChange={(e) => setTreeName(e.target.value)} placeholder="e.g. Tree 1" className="w-40" disabled={returnedToStation} />
          </div>
          <div>
            <Label className="mb-1 block text-sm">Hardware ID Pin</Label>
            <Input type="number" min={0} max={49} value={markerId} onChange={(e) => setMarkerId(e.target.value)} placeholder="3" className="w-28" disabled={returnedToStation} />
          </div>
          <Button onClick={addStop} disabled={returnedToStation || !treeName.trim() || currentSteps.length === 0}>
            <Flag className="w-4 h-4 mr-1" /> Add stop
          </Button>
          {stops.some((s) => !s.isReturn) && !returnedToStation && (
            <Button variant="outline" onClick={markBackAtStation} disabled={currentSteps.length === 0}>
              <Home className="w-4 h-4 mr-1" /> I'm back at the station
            </Button>
          )}
        </CardContent>
      </Card>

      {stops.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Indexed Paths Registry</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stops.map((stop, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                <div>
                  <span className="font-medium">
                    {stop.isReturn ? "🏠 Station Return Autopilot Active" : `#${i + 1} Target: ${stop.treeName}`}
                  </span>
                  <span className="text-muted-foreground text-sm ml-2">
                    ({stop.steps.length} coordinates registered)
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeStop(i)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 sticky bottom-4 bg-background/95 backdrop-blur p-4 rounded-lg border">
        <Button onClick={handleSaveRoute} disabled={stops.length === 0 || saveStops.isPending}>
          <Save className="w-4 h-4 mr-1" /> {saveStops.isPending ? "Compiling..." : "Save route"}
        </Button>
        <Button variant="outline" onClick={() => setLocation(`/routes/${routeId}/edit`)}>Review configuration database</Button>
        {saved && <span className="text-sm text-green-600">Spatial arrays verified and committed!</span>}
      </div>
    </div>
  );
}
