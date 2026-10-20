import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Overview from '@/pages/Overview';
import TreeDetail from '@/pages/TreeDetail';
import Login from '@/pages/Login';
import Routes from '@/pages/Routes';
import RouteEditor from '@/pages/RouteEditor';
import Schedule from '@/pages/Schedule';
import { Shell } from '@/components/layout/shell';
import { ProtectedRoute } from '@/components/protected-route';
import { Route, Switch, Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <ProtectedRoute>
          <Shell>
            <Switch>
              <Route path="/" component={Overview} />
              <Route path="/routes" component={Routes} />
              <Route path="/routes/:id/edit" component={RouteEditor} />
              <Route path="/routes/:id/schedule" component={Schedule} />
              <Route path="/trees/:id" component={TreeDetail} />
              <Route component={NotFound} />
            </Switch>
          </Shell>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
