import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppLayout } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Invoices from "@/pages/invoices";
import NewInvoice from "@/pages/new-invoice";
import InvoiceDetail from "@/pages/invoice-detail";
import Inventory from "@/pages/inventory";
import NewProduct from "@/pages/new-product";
import EditProduct from "@/pages/edit-product";
import Accounting from "@/pages/accounting";
import AccountingSummary from "@/pages/accounting-summary";
import AiAssistant from "@/pages/ai";
import Settings from "@/pages/settings";
import Customers from "@/pages/customers";
import Transactions from "@/pages/transactions";
import GstReport from "@/pages/gst-report";
import CreditDebit from "@/pages/credit-debit";
import Alerts from "@/pages/alerts";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  return (
    <AuthGuard>
      <AppLayout>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/invoices/new" component={NewInvoice} />
          <Route path="/invoices/:id" component={InvoiceDetail} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/inventory/new" component={NewProduct} />
          <Route path="/inventory/:id" component={EditProduct} />
          <Route path="/inventory" component={Inventory} />
          <Route path="/customers" component={Customers} />
          <Route path="/transactions" component={Transactions} />
          <Route path="/accounting" component={Accounting} />
          <Route path="/accounting/summary" component={AccountingSummary} />
          <Route path="/credit-debit" component={CreditDebit} />
          <Route path="/gst-report" component={GstReport} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/ai" component={AiAssistant} />
          <Route path="/settings" component={Settings} />
          <Route component={NotFound} />
        </Switch>
      </AppLayout>
    </AuthGuard>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/onboarding">
        <AuthGuard>
          <Onboarding />
        </AuthGuard>
      </Route>
      <Route path="/" component={() => <Login />} />
      <Route path="/:rest*">
        <AuthenticatedApp />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
