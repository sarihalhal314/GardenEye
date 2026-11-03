def edit(path, old, new):
    s = open(path).read()
    assert old in s, f"anchor not found in {path}:\n{old}"
    open(path, "w").write(s.replace(old, new, 1))

edit("src/lib/api-client.tsx",
     "  isReturn?: boolean;\n  steps: RouteStep[];\n",
     '  isReturn?: boolean;\n  kind?: "pass" | "inspect";\n  steps: RouteStep[];\n')

hooks = '''export function useSaveRouteMarkers(): UseMutationResult<
  RouteDetail,
  Error,
  { routeId: number; markers: { markerId: number; kind: "pass" | "inspect"; treeName: string }[] }
> {
  return useMutation({
    mutationFn: ({ routeId, markers }) =>
      request<RouteDetail>(`/api/routes/${routeId}/markers`, { method: "PUT", body: JSON.stringify({ markers }) }),
  });
}

export function useRunRoute(): UseMutationResult<{ ok: boolean }, Error, { routeId: number }> {
  return useMutation({
    mutationFn: ({ routeId }) => request<{ ok: boolean }>(`/api/routes/${routeId}/run`, { method: "POST" }),
  });
}

export function useStopRoute(): UseMutationResult<{ ok: boolean }, Error, void> {
  return useMutation({
    mutationFn: () => request<{ ok: boolean }>("/api/routes/stop", { method: "POST" }),
  });
}

'''
edit("src/lib/api-client.tsx", "export function useSaveSchedule(", hooks + "export function useSaveSchedule(")

edit("src/App.tsx", "import Drive from '@/pages/Drive';\n",
     "import Drive from '@/pages/Drive';\nimport MarkerRoute from '@/pages/MarkerRoute';\n")
edit("src/App.tsx", '              <Route path="/routes/:id/drive" component={Drive} />\n',
     '              <Route path="/routes/:id/markers" component={MarkerRoute} />\n'
     '              <Route path="/routes/:id/drive" component={Drive} />\n')

edit("src/pages/Routes.tsx",
     "            <Button variant=\"outline\" size=\"sm\" onClick={() => setLocation(`/routes/${route.id}/drive`)}>\n",
     "            <Button variant=\"outline\" size=\"sm\" onClick={() => setLocation(`/routes/${route.id}/markers`)}>\n"
     "              <ListOrdered className=\"w-4 h-4 mr-1\" /> Marker route\n"
     "            </Button>\n"
     "            <Button variant=\"outline\" size=\"sm\" onClick={() => setLocation(`/routes/${route.id}/drive`)}>\n")
print("frontend patched")
