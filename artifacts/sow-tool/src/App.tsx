import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Journey from "@/pages/journey";
import Workspace from "@/pages/workspace";
import Prospect from "@/pages/prospect";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Journey} />
      <Route path="/assessment/:id" component={Workspace} />
      {/* Pipeline is now the single home; keep the old path working. */}
      <Route path="/prospecting"><Redirect to="/" replace /></Route>
      <Route path="/prospect/:id" component={Prospect} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}

export default App;
