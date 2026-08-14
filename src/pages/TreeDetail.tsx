import { useGetTree, useUpdateTree, useDeleteTree, useListTreeReadings, getGetTreeQueryKey, getListTreesQueryKey, getGetDashboardSummaryQueryKey, resolvePhotoUrl } from "@/lib/api-client";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, 
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Droplet, Thermometer, Gauge, Settings, Edit2, Trash2, Camera, Activity, CalendarClock } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { formatDateTime, formatDate, formatTime } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useImageWithHeaders } from "@/hooks/useImageWithHeaders";

// Recharts for the history
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";

export default function TreeDetail() {
  const { id } = useParams<{ id: string }>();
  const treeId = parseInt(id, 10);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: tree, isLoading: isTreeLoading } = useGetTree(treeId);
  const { data: readings, isLoading: isReadingsLoading } = useListTreeReadings(treeId);
  
  const updateTree = useUpdateTree();
  const deleteTree = useDeleteTree();

  const photoSrc = useImageWithHeaders(
    tree?.latestReading?.photoUrl ? resolvePhotoUrl(tree.latestReading.photoUrl) : null
  );

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");

  const handleEditOpen = () => {
    if (tree) setEditName(tree.name);
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!editName.trim() || !tree) return;
    updateTree.mutate(
      { treeId, data: { name: editName } },
      {
        onSuccess: (updatedTree) => {
          queryClient.setQueryData(getGetTreeQueryKey(treeId), (old: any) => 
            old ? { ...old, name: updatedTree.name } : old
          );
          queryClient.invalidateQueries({ queryKey: getListTreesQueryKey() });
          setIsEditOpen(false);
          toast({ title: "Saved", description: "Tree renamed successfully." });
        },
        onError: () => toast({ title: "Error", description: "Failed to rename tree.", variant: "destructive" })
      }
    );
  };

  const handleDelete = () => {
    deleteTree.mutate(
      { treeId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTreesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          toast({ title: "Deleted", description: "Tree removed from monitoring." });
          setLocation("/");
        },
        onError: () => toast({ title: "Error", description: "Failed to remove tree.", variant: "destructive" })
      }
    );
  };

  if (isTreeLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-serif">Tree not found</h2>
        <p className="text-muted-foreground mt-2 mb-6">This tree may have been removed or the ID is invalid.</p>
        <Link href="/">
          <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const latestReading = tree.latestReading;

  // Format data for chart, sorting chronological
  const chartData = readings 
    ? [...readings].reverse().map(r => ({
        ...r,
        formattedTime: formatTime(r.timestamp),
        date: formatDate(r.timestamp)
      }))
    : [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-500">
      <Link href="/">
        <Button variant="ghost" className="pl-0 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Overview
        </Button>
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl sm:text-4xl font-serif text-foreground">{tree.name}</h1>
            {tree.alertActive && (
              <Badge variant="destructive" className="ml-2 animate-pulse">Needs Attention</Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4" /> Added {formatDate(tree.createdAt)}
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={handleEditOpen}><Edit2 className="w-4 h-4 mr-2" /> Edit</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rename Tree</DialogTitle>
                <DialogDescription>Update the identifier for this tree.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} className="mt-2" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdate} disabled={updateTree.isPending || !editName.trim()}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border-transparent">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Tree</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to stop monitoring this tree? This will permanently delete its history and readings.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {deleteTree.isPending ? "Removing..." : "Remove"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Stats & Chart */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Current Readings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Latest Readings</CardTitle>
              <CardDescription>
                {latestReading ? `Recorded at ${formatDateTime(latestReading.timestamp)}` : "No readings yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latestReading ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/20 rounded-lg border border-border">
                    <div className="text-muted-foreground text-sm flex items-center gap-1.5 mb-2">
                      <Droplet className="w-4 h-4 text-blue-500" /> Moisture
                    </div>
                    <div className="text-3xl font-mono">{latestReading.moistureValue}%</div>
                    <div className="text-xs text-muted-foreground mt-2 capitalize">{latestReading.soilStatus.replace('_', ' ')}</div>
                  </div>
                  
                  <div className="p-4 bg-muted/20 rounded-lg border border-border">
                    <div className="text-muted-foreground text-sm flex items-center gap-1.5 mb-2">
                      <Thermometer className="w-4 h-4 text-orange-500" /> Temp
                    </div>
                    <div className="text-3xl font-mono">{latestReading.tempC != null ? `${latestReading.tempC}°C` : '--'}</div>
                  </div>
                  
                  <div className="p-4 bg-muted/20 rounded-lg border border-border">
                    <div className="text-muted-foreground text-sm flex items-center gap-1.5 mb-2">
                      <Gauge className="w-4 h-4 text-purple-500" /> Pressure
                    </div>
                    <div className="text-3xl font-mono">{latestReading.pressureHpa != null ? `${latestReading.pressureHpa}` : '--'}</div>
                    <div className="text-xs text-muted-foreground mt-2">hPa</div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground italic">
                  Awaiting robot sync for initial readings.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">History</CardTitle>
            </CardHeader>
            <CardContent>
              {isReadingsLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : chartData.length > 1 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="formattedTime" 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        domain={['dataMin - 10', 'dataMax + 10']}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          color: 'hsl(var(--foreground))'
                        }}
                        itemStyle={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-mono)' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="moistureValue" 
                        name="Moisture %"
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
                      />
                      <ReferenceLine y={30} stroke="hsl(var(--destructive))" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Low Moisture', fill: 'hsl(var(--destructive))', fontSize: 10 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/10">
                  <div className="text-center text-muted-foreground">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Not enough data points yet.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Photo & Health */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="pb-0">
              <CardTitle className="text-xl flex items-center gap-2">
                <Camera className="w-5 h-5 text-muted-foreground" /> 
                Latest Visual
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {latestReading?.photoUrl ? (
                <div className="rounded-lg overflow-hidden border border-border bg-black/5 aspect-[4/3] relative">
                  <img 
                    src={photoSrc ?? undefined} 
                    alt={`Latest photo of ${tree.name}`} 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm font-mono">
                    {formatTime(latestReading.timestamp)}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 aspect-[4/3] flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <Camera className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">No photo captured yet</p>
                  <p className="text-xs mt-1 opacity-70">The robot will upload a photo on its next visit.</p>
                </div>
              )}

              {latestReading && (
                <div className="mt-6 space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Plant Health</span>
                      <Badge variant={latestReading.plantStatus === 'healthy' ? 'healthy' : latestReading.plantStatus === 'stressed' ? 'stressed' : 'uncertain'} className="capitalize">
                        {latestReading.plantStatus}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{latestReading.plantMessage}</p>
                  </div>
                  
                  <div className="h-px w-full bg-border" />
                  
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium">Soil Status</span>
                      <Badge variant={latestReading.soilStatus === 'soil_ok' ? 'healthy' : 'stressed'}>
                        {latestReading.soilStatus === 'soil_ok' ? 'OK' : 'Issue'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{latestReading.soilMessage}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}