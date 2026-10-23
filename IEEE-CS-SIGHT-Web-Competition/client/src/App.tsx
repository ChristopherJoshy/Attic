import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import React, { Suspense } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { BackToTop } from "@/components/ui/back-to-top";

// Pages (lazy-loaded for faster initial load)
const Home = React.lazy(() => import("@/pages/home"));
const About = React.lazy(() => import("@/pages/about"));
const Execom = React.lazy(() => import("@/pages/execom"));
const Activities = React.lazy(() => import("@/pages/activities"));
const Achievements = React.lazy(() => import("@/pages/achievements"));
const Contact = React.lazy(() => import("@/pages/contact"));
const NotFound = React.lazy(() => import("@/pages/not-found"));

function Router() {
  return (
    <div className="min-h-screen cosmic-bg relative overflow-x-hidden">
  {/* Fixed theme background */}
  <div className="site-bg fixed inset-0 -z-10" />
  <div className="min-h-screen text-foreground">
        <Navbar />
        <main id="main-content" className="relative">
          <ErrorBoundary>
            <Suspense fallback={<div className="p-6 text-center text-muted-foreground">Loading…</div>}>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/about" component={About} />
                <Route path="/execom" component={Execom} />
                <Route path="/activities" component={Activities} />
                <Route path="/achievements" component={Achievements} />
                <Route path="/contact" component={Contact} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </ErrorBoundary>
        </main>
  <Footer />
  <BackToTop />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
  <ThemeProvider defaultTheme="light" storageKey="web-comp-theme">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
