import React, { useMemo, useState, useEffect } from "react";
import { Camera, MapPin, Clock, DollarSign, Search, CheckCircle2, AlertTriangle, ClipboardList, FileText, Navigation, CreditCard, Lock, LogOut } from "lucide-react";

const API_URL = process.env.REACT_APP_API_URL || "/api";

function badge(status) {
  const map = {
    New: "bg-slate-100 text-slate-700",
    Assigned: "bg-blue-100 text-blue-700",
    Accepted: "bg-indigo-100 text-indigo-700",
    "In Progress": "bg-amber-100 text-amber-700",
    "Photos Uploaded": "bg-purple-100 text-purple-700",
    "Correction Needed": "bg-red-100 text-red-700",
    Approved: "bg-emerald-100 text-emerald-700",
    Paid: "bg-slate-950 text-white"
  };
  return map[status] || "bg-slate-100 text-slate-700";
}

function PasswordGate({ onUnlock }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === "bpo2025") {
      onUnlock();
      setPassword("");
    } else {
      setError("Invalid password");
      setPassword("");
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border-slate-700 shadow-2xl bg-slate-950 p-8">
        <div className="flex justify-center mb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-800 text-amber-400 shadow-lg">
            <Lock className="h-8 w-8" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-white mb-2">BPO Task Force</h1>
        <p className="text-sm text-slate-400 text-center mb-6">Field Work Portal</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">Portal Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Enter password"
              className="w-full rounded-2xl border border-slate-600 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>
          {error && <div className="rounded-xl bg-red-900/30 border border-red-700/50 p-3 text-sm text-red-300">{error}</div>}
          <button type="submit" className="w-full rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3">
            Unlock Portal
          </button>
        </form>
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-slate-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

export default function BPOTaskForcePortal() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [role, setRole] = useState("agent");
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) { loadOrders(); }
  }, [isAuthenticated]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/orders`);
      if (!response.ok) throw new Error("Failed to load orders");
      const data = await response.json();
      setOrders(data);
      if (data.length > 0) setSelectedId(data[0].id);
      setError("");
    } catch (err) {
      setError("Could not load orders. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

 

  const order = orders.find(o => o.id === selectedId) || orders[0];
  const filteredOrders = useMemo(() => {
    return orders.filter(o =>
      `${o.id} ${o.address} ${o.city} ${o.state} ${o.county} ${o.status} ${o.type}`
        .toLowerCase().includes(query.toLowerCase())
    );
  }, [orders, query]);
if (!isAuthenticated) return <PasswordGate onUnlock={() => setIsAuthenticated(true)} />;
  const photoCount = order ? Object.values(order.photos || {}).filter(Boolean).length : 0;
  const photoTotal = order ? Object.keys(order.photos || {}).length : 0;
  const photoPercent = photoTotal > 0 ? Math.round((photoCount / photoTotal) * 100) : 0;

  const patchOrder = async (patch) => {
    try {
      const response = await fetch(`${API_URL}/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      if (!response.ok) throw new Error("Failed to update order");
      await loadOrders();
    } catch (err) {
      setError("Failed to save changes");
    }
  };

  const updatePcr = (field, value) => {
    patchOrder({ [field]: value, status: order.status === "New" ? "In Progress" : order.status });
  };

  const togglePhoto = (name) => {
    const nextPhotos = { ...order.photos, [name]: !order.photos[name] };
    const complete = Object.values(nextPhotos).every(Boolean);
    patchOrder({ photos: nextPhotos, status: complete ? "Photos Uploaded" : "In Progress" });
  };

  const acceptJob = () => {
    patchOrder({ status: "Accepted", assignedTo: order.assignedTo === "Unassigned" ? "Current User" : order.assignedTo });
  };

  const submitJob = () => {
    const complete = Object.values(order.photos).every(Boolean);
    patchOrder({ status: complete ? "Photos Uploaded" : "Correction Needed" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-950 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">BPO Task Force</h1>
              <p className="text-xs text-slate-500">Field Work Portal</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setRole("agent")} className={`rounded-2xl px-4 py-2 font-semibold ${role === "agent" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white"}`}>Field Agent</button>
            <button onClick={() => setRole("admin")} className={`rounded-2xl px-4 py-2 font-semibold ${role === "admin" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white"}`}>Admin</button>
            <button onClick={() => setIsAuthenticated(false)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
      </header>
      {error && <div className="mx-auto max-w-7xl px-4 py-3 bg-red-50 border-b border-red-200 text-red-800 text-sm">{error}</div>}
      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <div className="rounded-3xl border border-slate-200 shadow-sm bg-white p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assignments" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400" />
            </div>
            <div className="space-y-3">
              {filteredOrders.map(o => (
                <button key={o.id} onClick={() => setSelectedId(o.id)} className={`w-full rounded-2xl border p-4 text-left transition hover:bg-slate-50 ${selectedId === o.id ? "border-slate-950 bg-slate-50" : "border-slate-200 bg-white"}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-400">{o.id}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge(o.status)}`}>{o.status}</span>
                  </div>
                  <h2 className="font-semibold leading-tight">{o.address}</h2>
                  <p className="text-sm text-slate-500">{o.city}, {o.state}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {o.due}</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-700"><DollarSign className="h-3.5 w-3.5" /> {o.fee}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
        <section className="space-y-5">
          {order && (
            <>
              <div className="rounded-3xl border border-slate-200 shadow-sm bg-white p-5 md:p-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge(order.status)}`}>{order.status}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 border border-slate-200">{order.type}</span>
                    </div>
                    <h2 className="text-2xl font-bold md:text-3xl">{order.address}</h2>
                    <p className="mt-1 flex items-center gap-1 text-slate-500"><MapPin className="h-4 w-4" /> {order.city}, {order.state}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm border border-slate-200 md:min-w-56">
                    <p className="flex items-center gap-2"><Clock className="h-4 w-4" /> Due: {order.due}</p>
                    <p className="mt-2 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Fee: ${order.fee}</p>
                    <p className="mt-2 flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Assigned: {order.assignedTo}</p>
                  </div>
                </div>
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-2 font-bold">Instructions</h3>
                  <p className="text-sm leading-relaxed text-slate-600">{order.notes}</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {role === "agent" && <button onClick={acceptJob} className="rounded-2xl bg-slate-950 text-white px-4 py-2 font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Accept Job</button>}
                  <button className="rounded-2xl border border-slate-200 px-4 py-2 font-semibold flex items-center gap-2"><Navigation className="h-4 w-4" />Open Directions</button>
                  {role === "agent" && <button onClick={submitJob} className="rounded-2xl border border-slate-200 px-4 py-2 font-semibold flex items-center gap-2"><Camera className="h-4 w-4" />Submit Assignment</button>}
                  {role === "admin" && <button onClick={() => patchOrder({ status: "Approved" })} className="rounded-2xl bg-slate-950 text-white px-4 py-2 font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />Approve Photos</button>}
                  {role === "admin" && <button onClick={() => patchOrder({ status: "Paid" })} className="rounded-2xl border border-slate-200 px-4 py-2 font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" />Mark Paid</button>}
                </div>
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 shadow-sm bg-white p-5 md:p-7">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2"><Camera className="h-5 w-5" /><h3 className="text-xl font-bold">Photo Checklist</h3></div>
                    <span className="text-sm font-semibold text-slate-500">{photoCount}/{photoTotal}</span>
                  </div>
                  <div className="mb-5 h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${photoPercent}%` }} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(order.photos || {}).map(([name, uploaded]) => (
                      <button key={name} onClick={() => togglePhoto(name)} className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${uploaded ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                        <span className="font-medium text-sm">{name}</span>
                        {uploaded ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Camera className="h-5 w-5 text-slate-400" />}
                      </button>
                    ))}
                  </div>
                  {order.status === "Correction Needed" && (
                    <p className="mt-4 flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700"><AlertTriangle className="h-4 w-4" />Required photos are missing.</p>
                  )}
                </div>
                <div className="rounded-3xl border border-slate-200 shadow-sm bg-white p-5 md:p-7">
                  <div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5" /><h3 className="text-xl font-bold">PCR Data</h3></div>
                  <div className="space-y-4">
                    <SelectField label="Occupancy" value={order.occupancy} onChange={(v) => updatePcr("occupancy", v)} options={["Unknown", "Occupied", "Vacant", "Appears Vacant"]} />
                    <SelectField label="Property Condition" value={order.condition} onChange={(v) => updatePcr("condition", v)} options={["Unknown", "Excellent", "Good", "Average", "Fair", "Poor"]} />
                    <SelectField label="Utilities" value={order.utilities} onChange={(v) => updatePcr("utilities", v)} options={["Unknown", "On", "Off", "Partially On"]} />
                    <SelectField label="Neighborhood" value={order.neighborhood} onChange={(v) => updatePcr("neighborhood", v)} options={["Unknown", "Stable", "Improving", "Declining"]} />
                    <div>
                      <label className="mb-2 block text-sm font-bold text-slate-600">Field Notes</label>
                      <textarea value={order.pcrNotes || ""} onChange={(e) => updatePcr("pcrNotes", e.target.value)} placeholder="Visible condition, occupancy indicators..." className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-slate-400" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
