import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ProGate } from "@/components/auth/pro-gate";
import { AppLayout } from "@/components/layout/app-layout";
import NotFound from "@/pages/not-found";

// V1/V2 pages
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Invoices from "@/pages/invoices";
import NewInvoice from "@/pages/new-invoice";
import InvoiceDetail from "@/pages/invoice-detail";
import InvoiceGenerator from "@/pages/invoice-generator";
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
import ComplianceAlerts from "@/pages/compliance-alerts";
import Billing from "@/pages/billing";
import Backup from "@/pages/backup";
import Devices from "@/pages/devices";

// V3 pages
import Analytics from "@/pages/analytics";
import Expenses from "@/pages/expenses";
import Vendors from "@/pages/vendors";
import Team from "@/pages/team";
import Approvals from "@/pages/approvals";

// V4 pages

// V5 pages
import AiAgents from "@/pages/ai-agents";
import Reconciliation from "@/pages/reconciliation";
import Policy from "@/pages/policy";
import Tasks from "@/pages/tasks";
import Enterprise from "@/pages/enterprise";

const queryClient = new QueryClient();

function AuthenticatedApp() {
  return (
    <AuthGuard>
      <AppLayout>
        <Switch>
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/invoice-generator" component={InvoiceGenerator} />
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
          <Route path="/alerts" component={ComplianceAlerts} />
          {/* V3 routes */}
          <Route path="/analytics" component={Analytics} />
          <Route path="/expenses" component={Expenses} />
          <Route path="/vendors" component={Vendors} />
          <Route path="/team">
            <ProGate feature="Companies & Team"><Team /></ProGate>
          </Route>
          <Route path="/approvals">
            <ProGate feature="Approvals"><Approvals /></ProGate>
          </Route>
          {/* AI command centre with tab routing */}
          <Route path="/ai" component={AiAssistant} />
          <Route path="/workflows">{() => { window.location.replace("/erp-app/ai?tab=automations"); return null; }}</Route>
          <Route path="/integrations">{() => { window.location.replace("/erp-app/ai?tab=integrations"); return null; }}</Route>
          <Route path="/webhooks">{() => { window.location.replace("/erp-app/ai?tab=webhooks"); return null; }}</Route>
          {/* Cloud / account */}
          <Route path="/billing" component={Billing} />
          <Route path="/backup" component={Backup} />
          <Route path="/settings" component={Settings} />
          <Route path="/branding">
            {() => { window.location.replace("/settings"); return null; }}
          </Route>
          {/* V5 routes — Pro only */}
          <Route path="/ai-agents">
            <ProGate feature="AI Agent Workspace"><AiAgents /></ProGate>
          </Route>
          <Route path="/reconciliation">
            <ProGate feature="Reconciliation Engine"><Reconciliation /></ProGate>
          </Route>
          <Route path="/policy">
            <ProGate feature="Policy & Compliance"><Policy /></ProGate>
          </Route>
          <Route path="/tasks" component={Tasks} />
          <Route path="/enterprise">
            <ProGate feature="Enterprise Admin"><Enterprise /></ProGate>
          </Route>
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
        <AuthGuard><Onboarding /></AuthGuard>
      </Route>
      <Route path="/" component={() => <Login />} />
      <Route path="/:rest*"><AuthenticatedApp /></Route>
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
