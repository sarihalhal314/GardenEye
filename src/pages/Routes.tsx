import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Trash2, ListOrdered, Clock } from "lucide-react";
import { useListRoutes, useCreateRoute, useDeleteRoute } from "@/lib/api-client";

const DAY_ABBREVIATIONS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function scheduleSummary(schedule: { dayOfWeek: number; time: string }[]) {
  if (schedule.length === 0) return "Not scheduled yet";
  const byTime = new Map<string, number[]>();
  for (const entry of schedule) {
    const days = byTime.get(entry.time) || [];
    days.push(entry.dayOfWeek);
    byTime.set(entry.time, days);
  }
  return Array.from(byTime.entries())
    .map(([time, days]) => `${days.map((d) => DAY_ABBREVIATIONS[d]).join("/")} at ${time}`)
    .join(", ");
}

export default function Routes() {
  const { data: routes, isLoading } = useListRoutes();
  const createRoute = useCreateRoute();
  const deleteRoute = useDeleteRoute();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    createRoute.mutate(
      { name: newName.trim() },
      { onSuccess: () => { setNewName(""); queryClient.invalidateQueries({ queryKey: ["routes"] }); } }
    );
  };

  const handleDelete = (routeId: number) => {
    if (!confirm("Delete this route? This can't be undone.")) return;
    deleteRoute.mutate(
      { routeId },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["routes"] }) }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-3xl font-serif">Routes</h1>
        <p className="text-muted-foreground mt-1">
          Each route is a set of trees the car visits, on whatever schedule you set — no need to touch the Pi at all.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex items-end gap-3">
          <div className="flex-1">
            <Input
              placeholder="New route name (e.g. Apple & Peach Row)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <Button onClick={handleCreate} disabled={!newName.trim() || createRoute.isPending}>
            <Plus className="w-4 h-4 mr-1" /> New route
          </Button>
        </CardContent>
      </Card>

      {createRoute.isError && (
        <p className="text-sm text-destructive">
          Couldn't create the route: {createRoute.error instanceof Error ? createRoute.error.message : "unknown error"}
        </p>
      )}

      {isLoading && <p className="text-muted-foreground">Loading routes...</p>}

      {routes && routes.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          No routes yet — create one above, then drive it once to record the stops.
        </p>
      )}

      {routes?.map((route) => (
        <Card key={route.id}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">{route.name}</CardTitle>
              <CardDescription className="mt-1">
                {route.stopCount} stop{route.stopCount === 1 ? "" : "s"} · {scheduleSummary(route.schedule)}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(route.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setLocation(`/routes/${route.id}/edit`)}>
              <ListOrdered className="w-4 h-4 mr-1" /> Edit stops
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLocation(`/routes/${route.id}/schedule`)}>
              <Clock className="w-4 h-4 mr-1" /> Schedule
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
