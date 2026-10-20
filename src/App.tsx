import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Flag,
  Home,
  Trash2,
} from "lucide-react";
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
  const routeId = Number.parseInt(id ?? "", 10);
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
  const activeActionRef = useRef<Action | null>(null);

  const sendDriveCommand = useCallback(async (left: number, right: number) => {
    try {
      const response = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ left, right }),
      });

      if (!response.ok) {
        throw new Error(`Drive command failed (HTTP ${response.status})`);
      }
      setDriveError(null);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : "Network failure");
    }
  }, []);

  const sendKeepalive = useCallback(async () => {
    try {
      const response = await fetch("/api/keepalive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeoutMs: ROVER_HEARTBEAT_TIMEOUT_MS }),
      });
      if (!response.ok) {
        throw new Error(`Heartbeat failed (HTTP ${response.status})`);
      }
    } catch (err) {
      console.warn("Heartbeat connection lost:", err);
    }
  }, []);

  useEffect(() => {
    void sendKeepalive();
    keepaliveInterval.current = setInterval(
      () => void sendKeepalive(),
      ROVER_HEARTBEAT_TIMEOUT_MS - 5000,
    );

    return () => {
      if (keepaliveInterval.current) clearInterval(keepaliveInterval.current);
      // Best-effort stop if the page is closed while the rover is moving.
      void fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ left: 0, right: 0 }),
        keepalive: true,
      }).catch(() => undefined);
    };
  }, [sendKeepalive]);

  const startAction = (action: Action) => {
    if (returnedToStation || activeActionRef.current) return;
    activeActionRef.current = action;
    setActiveAction(action);
    const vector = DIRECTION_VECTORS[action];
    void sendDriveCommand(vector.left, vector.right);
  };

  const endAction = async () => {
    const action = activeActionRef.current;
    if (!action) return;

    // Clear immediately so multiple pointer/touch events cannot log twice.
    activeActionRef.current = null;
    setActiveAction(null);
    await sendDriveCommand(0, 0);

    try {
      const response = await fetch("/api/drive/stop", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Encoder snapshot failed (HTTP ${response.status})`);
      }

      const telemetry = await response.json();
      setCurrentSteps((prev) => [
        ...prev,
        {
          action,
          left_pulses: Number(telemetry.left_pulses) || 0,
          right_pulses: Number(telemetry.right_pulses) || 0,
          speed: SPEED,
        },
      ]);
    } catch (err) {
      console.error("Encoder snapshot failed:", err);
      setDriveError(
        err instanceof Error ? err.message : "Could not record encoder snapshot",
      );
    }
  };

  const addStop = () => {
    if (!treeName.trim() || currentSteps.length === 0 || returnedToStation) return;

    const parsedMarker = markerId.trim() === "" ? null : Number.parseInt(markerId, 10);
    if (parsedMarker !== null && (!Number.isInteger(parsedMarker) || parsedMarker < 0 || parsedMarker > 49)) {
      setDriveError("Hardware ID Pin must be an integer between 0 and 49.");
      return;
    }

    setStops((prev) => [
      ...prev,
      {
        treeName: treeName.trim(),
        markerId: parsedMarker,
        steps: currentSteps,
      },
    ]);
    setCurrentSteps([]);
    setTreeName("");
    setMarkerId("");
    setSaved(false);
    setDriveError(null);
  };

  const removeStop = (i: number) => {
    setStops((prev) => {
      const removed = prev[i];
      if (removed?.isReturn) setReturnedToStation(false);
      return prev.filter((_, idx) => idx !== i);
    });
    setSaved(false);
  };

  const markBackAtStation = () => {
    if (currentSteps.length === 0 || returnedToStation) return;
    setStops((prev) => [
      ...prev,
      { treeName: "Station", markerId: null, isReturn: true, steps: currentSteps },
    ]);
    setCurrentSteps([]);
    setReturnedToStation(true);
    setSaved(false);
  };

  const handleSaveRoute = () => {
    if (!Number.isInteger(routeId) || routeId <= 0) {
      setDriveError("Invalid route ID. Return to the routes page and open the route again.");
      return;
    }
    if (stops.length === 0) return;

    setSaved(false);
    setDriveError(null);
    saveStops.mutate(
      { routeId, stops },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => {
          setDriveError(err instanceof Error ? err.message : "Could not save route.");
        },
      },
    );
  };

  const DirButton = ({
    action,
    icon: Icon,
  }: {
    action: Action;
    icon: typeof ArrowUp;
  }) => (
    <button
      type="button"
      disabled={returnedToStation}
      aria-label={action.replace("_", " ")}
      className={`h-16 w-16 select-none rounded-lg border-2 flex items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        activeAction === action
          ? "bg-primary border-primary text-primary-foreground"
          : "border-primary hover:bg-muted"
      }`}
      onPointerDown={(event) => {
        event.preventDefault();
        (event.currentTarget as HTMLButtonElement).setPointerCapture?.(event.pointerId);
        startAction(action);
      }}
      onPointerUp={(event) => {
        event.preventDefault();
        void endAction();
      }}
      onPointerCancel={() => void endAction()}
      onLostPointerCapture={() => void endAction()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <Icon className="h-6 w-6" />
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation("/routes")}
          className="-ml-2 mb-2"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to routes
        </Button>
        <h1 className="font-serif text-3xl">Drive &amp; Record Route (Precision Encoder Mode)</h1>
        <p className="mt-1 text-muted-foreground">
          Steer the rover in the field and record wheel encoder readings at each stop.
        </p>
      </div>

      <Card className="border-dashed bg-muted/40">
        <CardContent className="pt-6">
          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Line the rover up at the home dock/station before driving.</li>
            <li>Manually drive to each tree using the direction controls.</li>
            <li>Enter the tree label and click <strong>Add stop</strong> to record the segments.</li>
            <li>Drive back near the station after the final tree.</li>
            <li>Click <strong>I'm back at the station</strong> to mark the return leg.</li>
          </ol>
        </CardContent>
      </Card>

      {returnedToStation && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6 text-sm text-green-800">
            Return-to-station leg recorded. Click "Save route" to save the route data.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="flex flex-col items-center gap-2 pt-6">
          <DirButton action="forward" icon={ArrowUp} />
          <div className="flex gap-2">
            <DirButton action="turn_left" icon={ArrowLeft} />
            <DirButton action="backward" icon={ArrowDown} />
            <DirButton action="turn_right" icon={ArrowRight} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {currentSteps.length > 0
              ? `${currentSteps.length} movement segments logged`
              : "Drive to record your route"}
          </p>
          {driveError && (
            <p role="alert" className="mt-1 text-sm text-destructive">
              Connection Error: {driveError}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Register Target Stop</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="mb-1 block text-sm">Tree Row Label</Label>
            <Input
              value={treeName}
              onChange={(event) => setTreeName(event.target.value)}
              placeholder="e.g. Tree 1"
              className="w-40"
              disabled={returnedToStation}
            />
          </div>
          <div>
            <Label className="mb-1 block text-sm">Hardware ID Pin</Label>
            <Input
              type="number"
              min={0}
              max={49}
              step={1}
              value={markerId}
              onChange={(event) => setMarkerId(event.target.value)}
              placeholder="3"
              className="w-28"
              disabled={returnedToStation}
            />
          </div>
          <Button
            onClick={addStop}
            disabled={returnedToStation || !treeName.trim() || currentSteps.length === 0}
          >
            <Flag className="mr-1 h-4 w-4" /> Add stop
          </Button>
          {stops.some((stop) => !stop.isReturn) && !returnedToStation && (
            <Button
              variant="outline"
              onClick={markBackAtStation}
              disabled={currentSteps.length === 0}
            >
              <Home className="mr-1 h-4 w-4" /> I'm back at the station
            </Button>
          )}
        </CardContent>
      </Card>

      {stops.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Indexed Paths Registry</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stops.map((stop, index) => (
              <div
                key={`${stop.treeName}-${index}`}
                className="flex items-center justify-between border-b border-border py-2 last:border-0"
              >
                <div>
                  <span className="font-medium">
                    {stop.isReturn
                      ? "🏠 Station Return"
                      : `#${index + 1} Target: ${stop.treeName}`}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({stop.steps.length} segments registered)
                  </span>
                  {stop.markerId !== null && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      Pin {stop.markerId}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${stop.treeName}`}
                  onClick={() => removeStop(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={handleSaveRoute}
          disabled={stops.length === 0 || saveStops.isPending}
        >
          {saveStops.isPending ? "Saving..." : "Save route"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setLocation(`/routes/${routeId}/edit`)}
          disabled={!Number.isInteger(routeId) || routeId <= 0}
        >
          Review route configuration
        </Button>
      </div>


            
