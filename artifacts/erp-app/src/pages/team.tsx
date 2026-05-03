import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, X, Building2, Users, Crown, Shield, Calculator, Eye, Pencil } from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("bizos_token") ?? "";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...opts, headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

type Company = { id: number; name: string; gstin?: string; businessType?: string; city?: string; state?: string; role?: string; isOwner?: boolean };
type CompForm = { name: string; legalName: string; gstin: string; businessType: string; address: string; city: string; state: string; phone: string; email: string };
const emptyComp: CompForm = { name: "", legalName: "", gstin: "", businessType: "", address: "", city: "", state: "", phone: "", email: "" };

const ROLES = [
  { value: "owner", label: "Owner", icon: Crown, desc: "Full access to everything", color: "text-amber-600" },
  { value: "admin", label: "Admin", icon: Shield, desc: "All modules except billing", color: "text-indigo-600" },
  { value: "accountant", label: "Accountant", icon: Calculator, desc: "Finance, invoices, expenses", color: "text-emerald-600" },
  { value: "staff", label: "Staff", icon: Users, desc: "View and create records", color: "text-blue-600" },
  { value: "viewer", label: "Viewer", icon: Eye, desc: "Read-only access", color: "text-gray-500" },
];

export default function Team() {
  const [showCompForm, setShowCompForm] = useState(false);
  const [editComp, setEditComp] = useState<Company | null>(null);
  const [compForm, setCompForm] = useState<CompForm>(emptyComp);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: companiesData, isLoading } = useQuery({ queryKey: ["companies"], queryFn: () => apiFetch("/companies") });
  const { data: membersData } = useQuery({
    queryKey: ["company-members", selectedCompany],
    queryFn: () => selectedCompany ? apiFetch(`/companies/${selectedCompany}/members`) : Promise.resolve({ members: [] }),
    enabled: !!selectedCompany,
  });

  const createComp = useMutation({
    mutationFn: (body: object) => apiFetch("/companies", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["companies"] }); setShowCompForm(false); setCompForm(emptyComp); toast({ title: "Company added" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });
  const updateComp = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => apiFetch(`/companies/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["companies"] }); setEditComp(null); setShowCompForm(false); toast({ title: "Company updated" }); },
    onError: () => toast({ title: "Error", variant: "destructive" }),
  });

  const companies: Company[] = companiesData?.companies ?? [];
  const members = membersData?.members ?? [];
  const cf = (k: keyof CompForm, v: string) => setCompForm(p => ({ ...p, [k]: v }));

  function openAddComp() { setEditComp(null); setCompForm(emptyComp); setShowCompForm(true); }
  function openEditComp(c: Company) {
    setEditComp(c);
    setCompForm({ name: c.name, legalName: "", gstin: c.gstin ?? "", businessType: c.businessType ?? "", address: "", city: c.city ?? "", state: c.state ?? "", phone: "", email: "" });
    setShowCompForm(true);
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Companies & Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage multiple businesses and team member access</p>
        </div>
        <Button onClick={openAddComp} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 text-sm gap-1.5">
          <Plus className="h-4 w-4" /> Add Company
        </Button>
      </div>

      {/* Roles reference */}
      <Card className="border border-gray-100 dark:border-gray-800">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-gray-700 dark:text-gray-300">Role Permissions Reference</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3">
            {ROLES.map(role => {
              const Icon = role.icon;
              return (
                <div key={role.value} className="flex flex-col gap-1.5 p-3 rounded-lg bg-gray-50 dark:bg-gray-900">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("h-4 w-4", role.color)} />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{role.label}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">{role.desc}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Companies list */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : companies.length === 0 ? (
        <Card className="border border-gray-100 dark:border-gray-800">
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-4">No companies set up yet. Create your first company profile.</p>
            <Button onClick={openAddComp} className="bg-indigo-600 text-white h-8 text-xs gap-1"><Plus className="h-3 w-3" /> Add Company</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {companies.map(c => (
            <Card key={c.id} className={cn("border cursor-pointer transition-all hover:shadow-sm", selectedCompany === c.id ? "border-indigo-300 dark:border-indigo-700 ring-1 ring-indigo-200 dark:ring-indigo-800" : "border-gray-100 dark:border-gray-800")}
              onClick={() => setSelectedCompany(selectedCompany === c.id ? null : c.id)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                      <span className="text-base font-bold text-indigo-600">{c.name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{c.name}</h3>
                      {c.gstin && <p className="text-xs text-gray-400 font-mono mt-0.5">{c.gstin}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.isOwner && <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">Owner</Badge>}
                    {c.role && !c.isOwner && <Badge variant="outline" className="text-[10px] capitalize">{c.role}</Badge>}
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={e => { e.stopPropagation(); openEditComp(c); }}>
                      <Pencil className="h-3 w-3 text-gray-400" />
                    </Button>
                  </div>
                </div>
                {(c.city || c.businessType) && (
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {c.businessType && <Badge variant="outline" className="text-[10px]">{c.businessType}</Badge>}
                    {c.city && <span className="text-xs text-gray-400">{c.city}{c.state ? `, ${c.state}` : ""}</span>}
                  </div>
                )}
                {selectedCompany === c.id && members.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Team Members</p>
                    <div className="space-y-1.5">
                      {members.map((m: { id: number; role: string; userId: number; isOwner: boolean }) => (
                        <div key={m.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-indigo-600">U{m.userId}</span>
                            </div>
                            <span className="text-gray-600 dark:text-gray-400">User #{m.userId}</span>
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] capitalize", m.isOwner ? "text-amber-600 border-amber-200" : "")}>
                            {m.isOwner ? "Owner" : m.role}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Company Form */}
      {showCompForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-end" onClick={() => setShowCompForm(false)}>
          <div className="w-[400px] h-full bg-white dark:bg-gray-950 shadow-2xl overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">{editComp ? "Edit Company" : "New Company"}</h2>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowCompForm(false)}><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex-1 p-5 space-y-3">
              {([["name", "Company Name *"], ["legalName", "Legal Name"], ["gstin", "GSTIN"], ["businessType", "Business Type"], ["address", "Address"], ["city", "City"], ["state", "State"], ["phone", "Phone"], ["email", "Email"]] as [keyof CompForm, string][]).map(([k, label]) => (
                <div key={k} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <Input value={compForm[k]} onChange={e => cf(k, e.target.value)} className="h-8 text-sm" />
                </div>
              ))}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setShowCompForm(false)}>Cancel</Button>
              <Button className="flex-1 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => editComp ? updateComp.mutate({ id: editComp.id, body: compForm }) : createComp.mutate(compForm)}
                disabled={!compForm.name || createComp.isPending || updateComp.isPending}>
                {editComp ? "Save Changes" : "Create Company"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
