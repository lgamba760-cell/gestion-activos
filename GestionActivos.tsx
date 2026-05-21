import { useState, useEffect, useRef, useCallback } from "react";
import {
  Package, Wrench, AlertTriangle, MapPin, QrCode, FileText, Bell,
  ArrowLeft, Search, Save, Download, Check, Edit, Plus, X, Clock,
  AlertCircle, ChevronRight, LogOut, User, Shield, Activity, Eye,
  CheckCircle, RefreshCw, Printer, Filter
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

// ─── GLOBAL STATE via localStorage ────────────────────────────────────────────
const STORAGE_KEY = "sga_activos";
const NOTIF_KEY   = "sga_notificaciones";
const USER_KEY    = "sga_user";

const INITIAL_ACTIVOS = [
  { id: "1", codigo: "ACT-001", tipo: "Laptop",    marca: "Dell",     serial: "DL123456", estado: "Activo",        responsable: "Juan Pérez",    ubicacion: "Oficina 201", fecha: "2025-01-15", garantiaVence: "2026-01-15", area: "IT",      historial: [{ fecha: "2026-05-10", accion: "Estado actualizado", detalle: "Cambio a Activo",           usuario: "Admin"       }, { fecha: "2026-04-20", accion: "Asignación", detalle: "Asignado a Juan Pérez", usuario: "Admin" }] },
  { id: "2", codigo: "ACT-002", tipo: "Monitor",   marca: "Samsung",  serial: "SM789012", estado: "Activo",        responsable: "María García",  ubicacion: "Oficina 305", fecha: "2025-02-10", garantiaVence: "2026-05-30", area: "RRHH",    historial: [{ fecha: "2026-02-01", accion: "Registro inicial",    detalle: "Activo ingresado al sistema", usuario: "Admin"       }] },
  { id: "3", codigo: "ACT-003", tipo: "Teclado",   marca: "Logitech", serial: "LG345678", estado: "Mantenimiento", responsable: "Carlos López",  ubicacion: "Almacén",     fecha: "2025-03-05", garantiaVence: "2027-03-05", area: "Ventas",  historial: [{ fecha: "2026-05-01", accion: "Mantenimiento",        detalle: "Revisión preventiva programada", usuario: "Técnico IT" }] },
  { id: "4", codigo: "ACT-004", tipo: "Impresora", marca: "HP",       serial: "HP901234", estado: "Activo",        responsable: "Ana Martínez",  ubicacion: "Sala Reuniones", fecha: "2025-04-01", garantiaVence: "2025-04-01", area: "Finanzas", historial: [] },
];

function loadActivos() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : INITIAL_ACTIVOS;
  } catch { return INITIAL_ACTIVOS; }
}

function saveActivos(activos) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activos));
}

function loadNotificaciones(activos) {
  const today = new Date();
  const in30  = new Date(today); in30.setDate(in30.getDate() + 30);
  const notifs = [];
  activos.forEach(a => {
    if (a.estado === "Mantenimiento") {
      notifs.push({ id: `m-${a.id}`, tipo: "Mantenimiento", activo: `${a.tipo} ${a.marca}`, codigo: a.codigo, responsable: a.responsable, prioridad: "Alta", fecha: a.fecha, detalle: "Mantenimiento preventivo programado", aprobado: false, activoId: a.id });
    }
    if (a.garantiaVence) {
      const vence = new Date(a.garantiaVence);
      if (vence <= in30 && vence >= today) {
        notifs.push({ id: `g-${a.id}`, tipo: "Garantía próxima", activo: `${a.tipo} ${a.marca}`, codigo: a.codigo, responsable: a.responsable, prioridad: vence <= new Date(today.getTime() + 10*86400000) ? "Alta" : "Media", fecha: a.garantiaVence, detalle: `Garantía vence el ${a.garantiaVence}`, aprobado: false, activoId: a.id });
      } else if (vence < today) {
        notifs.push({ id: `gv-${a.id}`, tipo: "Garantía vencida", activo: `${a.tipo} ${a.marca}`, codigo: a.codigo, responsable: a.responsable, prioridad: "Alta", fecha: a.garantiaVence, detalle: "Garantía ya vencida", aprobado: false, activoId: a.id });
      }
    }
  });
  return notifs;
}

// ─── QR GENERATOR (canvas-based, no external lib) ─────────────────────────────
function generateQRDataURL(text) {
  // Simple visual QR placeholder with deterministic pattern based on text hash
  const canvas = document.createElement("canvas");
  canvas.width = 160; canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,160,160);
  ctx.fillStyle = "#1e293b";
  // Border squares (finder patterns)
  [[4,4],[4,116],[116,4]].forEach(([x,y]) => {
    ctx.fillRect(x,y,40,40); ctx.fillStyle="#fff"; ctx.fillRect(x+8,y+8,24,24); ctx.fillStyle="#1e293b"; ctx.fillRect(x+16,y+16,8,8);
    ctx.fillStyle="#1e293b";
  });
  // Deterministic data modules from text hash
  let hash = 0; for (let i=0;i<text.length;i++) hash = ((hash<<5)-hash)+text.charCodeAt(i);
  const size = 11;
  for (let r=0;r<size;r++) for (let c=0;c<size;c++) {
    if (r<3&&c<3) continue; if (r<3&&c>size-4) continue; if (r>size-4&&c<3) continue;
    const bit = (hash >> ((r*size+c)%32)) & 1;
    if (bit) { ctx.fillRect(8+c*13, 8+r*13, 11, 11); }
  }
  return canvas.toDataURL("image/png");
}

// ─── EXCEL EXPORT (CSV as xlsx-compatible) ────────────────────────────────────
function exportToExcel(activos) {
  const headers = ["Código","Tipo","Marca","Serial","Estado","Responsable","Ubicación","Área","Fecha Adquisición","Garantía Vence"];
  const rows = activos.map(a => [a.codigo,a.tipo,a.marca,a.serial,a.estado,a.responsable,a.ubicacion,a.area||"",a.fecha,a.garantiaVence||""]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `Reporte_Activos_${new Date().toISOString().split("T")[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── COLOR UTILS ──────────────────────────────────────────────────────────────
const estadoColor = (e) => ({
  Activo:        "bg-emerald-100 text-emerald-800",
  Inactivo:      "bg-red-100 text-red-800",
  Mantenimiento: "bg-amber-100 text-amber-800",
}[e] || "bg-gray-100 text-gray-700");

const prioColor = (p) => ({
  Alta:  "bg-red-100 text-red-700",
  Media: "bg-amber-100 text-amber-700",
  Baja:  "bg-sky-100 text-sky-700",
}[p] || "bg-gray-100 text-gray-700");

// ══════════════════════════════════════════════════════════════════════════════
// SCREENS
// ══════════════════════════════════════════════════════════════════════════════

// ─── LOGIN ─────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass,  setPass]  = useState("");
  const [err,   setErr]   = useState("");

  const submit = () => {
    if (!email || !pass) { setErr("Completa todos los campos"); return; }
    const user = { email, nombre: email.split("@")[0] || "Administrador", rol: "admin" };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    onLogin(user);
  };

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%)", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      <div style={{ background:"rgba(255,255,255,0.05)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:24, padding:"48px 40px", width:"100%", maxWidth:400, boxShadow:"0 25px 50px rgba(0,0,0,0.4)" }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:64, height:64, background:"linear-gradient(135deg,#3b82f6,#06b6d4)", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <Shield size={32} color="#fff" />
          </div>
          <h1 style={{ color:"#f1f5f9", fontSize:22, fontWeight:700, margin:0 }}>Sistema de Gestión</h1>
          <p style={{ color:"#94a3b8", fontSize:14, marginTop:6 }}>de Activos</p>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={{ color:"#94a3b8", fontSize:13, display:"block", marginBottom:6 }}>Correo electrónico</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
              placeholder="usuario@empresa.com"
              style={{ width:"100%", padding:"12px 14px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ color:"#94a3b8", fontSize:13, display:"block", marginBottom:6 }}>Contraseña</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
              placeholder="••••••••"
              style={{ width:"100%", padding:"12px 14px", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:10, color:"#f1f5f9", fontSize:14, outline:"none", boxSizing:"border-box" }} />
          </div>
          {err && <p style={{ color:"#f87171", fontSize:13, margin:0 }}>{err}</p>}
          <button onClick={submit}
            style={{ marginTop:6, padding:"13px", background:"linear-gradient(135deg,#3b82f6,#06b6d4)", border:"none", borderRadius:10, color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>
            Iniciar sesión
          </button>
        </div>
        <p style={{ textAlign:"center", color:"#475569", fontSize:12, marginTop:24 }}>
          🔒 Acceso controlado por roles
        </p>
      </div>
    </div>
  );
}

// ─── LAYOUT WRAPPER ─────────────────────────────────────────────────────────
function Layout({ title, onBack, actions, children, user, onLogout }) {
  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'DM Sans',system-ui,sans-serif" }}>
      <header style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {onBack && (
              <button onClick={onBack} style={{ background:"#f1f5f9", border:"none", borderRadius:8, padding:"6px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:4, color:"#475569", fontSize:14 }}>
                <ArrowLeft size={16}/> Volver
              </button>
            )}
            {!onBack && (
              <div style={{ width:32, height:32, background:"linear-gradient(135deg,#3b82f6,#06b6d4)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <Shield size={16} color="#fff" />
              </div>
            )}
            <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:"#0f172a" }}>{title}</h1>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {actions}
            {user && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:13, color:"#64748b" }}>{user.nombre}</span>
                <button onClick={onLogout} style={{ background:"#f1f5f9", border:"none", borderRadius:8, padding:"6px 8px", cursor:"pointer", color:"#64748b" }}>
                  <LogOut size={15}/>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main style={{ maxWidth:1200, margin:"0 auto", padding:"28px 24px" }}>
        {children}
      </main>
    </div>
  );
}

// ─── DASHBOARD ──────────────────────────────────────────────────────────────
function Dashboard({ activos, notificaciones, onNavigate, user, onLogout }) {
  const activos_count    = activos.length;
  const mantenimientos   = activos.filter(a=>a.estado==="Mantenimiento").length;
  const alertas_count    = notificaciones.filter(n=>n.prioridad==="Alta").length;
  const asignados        = activos.filter(a=>a.responsable).length;
  const pendAprobacion   = notificaciones.filter(n=>!n.aprobado);

  const chartData = [
    { name:"Activos",        value: activos.filter(a=>a.estado==="Activo").length,        color:"#10b981" },
    { name:"Mantenimiento",  value: activos.filter(a=>a.estado==="Mantenimiento").length,  color:"#f59e0b" },
    { name:"Inactivos",      value: activos.filter(a=>a.estado==="Inactivo").length,       color:"#ef4444" },
  ].filter(d=>d.value>0);

  const stats = [
    { label:"Activos registrados",      value: activos_count,   emoji:"📦", nav:"inventario" },
    { label:"Mantenimientos pendientes", value: mantenimientos,   emoji:"🔧", nav:"notificaciones" },
    { label:"Alertas activas",           value: alertas_count,    emoji:"⚠️", nav:"notificaciones" },
    { label:"Activos asignados",         value: asignados,        emoji:"📍", nav:"inventario" },
  ];

  const quickActions = [
    { label:"Inventario",      icon:Package,  nav:"inventario" },
    { label:"QR",              icon:QrCode,   nav:"escaneo" },
    { label:"Reportes",        icon:FileText, nav:"reportes" },
    { label:"Notificaciones",  icon:Bell,     nav:"notificaciones" },
  ];

  return (
    <Layout title="Sistema de Gestión de Activos" user={user} onLogout={onLogout}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:16, marginBottom:24 }}>
        {stats.map(s=>(
          <div key={s.label} onClick={()=>onNavigate(s.nav)}
            style={{ background:"#fff", borderRadius:14, padding:"20px 20px", cursor:"pointer", border:"1px solid #e2e8f0", transition:"box-shadow .2s", display:"flex", alignItems:"center", gap:14 }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.08)"}
            onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
            <span style={{ fontSize:34 }}>{s.emoji}</span>
            <div>
              <p style={{ margin:0, fontSize:12, color:"#64748b" }}>{s.label}</p>
              <p style={{ margin:"2px 0 0", fontSize:28, fontWeight:800, color:"#0f172a" }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:24, border:"1px solid #e2e8f0" }}>
          <h2 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#0f172a" }}>Estado de Activos</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value">
                {chartData.map(e=><Cell key={e.name} fill={e.color}/>)}
              </Pie>
              <Tooltip/>
              <Legend iconSize={10} wrapperStyle={{ fontSize:12 }}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background:"#fff", borderRadius:14, padding:24, border:"1px solid #e2e8f0" }}>
          <h2 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#0f172a" }}>Menú Rápido</h2>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {quickActions.map(a=>{
              const Icon = a.icon;
              return (
                <button key={a.label} onClick={()=>onNavigate(a.nav)}
                  style={{ background:"#f8fafc", border:"2px solid #e2e8f0", borderRadius:12, padding:"14px 8px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:6, transition:"all .15s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#3b82f6";e.currentTarget.style.background="#eff6ff";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";e.currentTarget.style.background="#f8fafc";}}>
                  <Icon size={22} color="#3b82f6"/>
                  <span style={{ fontSize:12, fontWeight:600, color:"#374151" }}>{a.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notificaciones pendientes de aprobación */}
      {pendAprobacion.length > 0 && (
        <div style={{ background:"#fff", borderRadius:14, padding:24, border:"1px solid #fde68a", borderLeft:"4px solid #f59e0b" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <h2 style={{ margin:0, fontSize:15, fontWeight:700, color:"#92400e", display:"flex", alignItems:"center", gap:8 }}>
              <Bell size={17}/> Pendientes de aprobación ({pendAprobacion.length})
            </h2>
            <button onClick={()=>onNavigate("notificaciones")} style={{ fontSize:12, color:"#3b82f6", background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>Ver todas →</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {pendAprobacion.slice(0,3).map(n=>(
              <div key={n.id} onClick={()=>onNavigate("notificaciones")}
                style={{ background:"#fffbeb", borderRadius:10, padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <span style={{ fontWeight:600, fontSize:13, color:"#1e293b" }}>{n.activo}</span>
                  <span style={{ fontSize:12, color:"#64748b", marginLeft:8 }}>{n.detalle}</span>
                </div>
                <span className={prioColor(n.prioridad)} style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:20, background: n.prioridad==="Alta"?"#fee2e2":"#fef3c7", color: n.prioridad==="Alta"?"#b91c1c":"#92400e" }}>
                  {n.prioridad}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}

// ─── INVENTARIO ─────────────────────────────────────────────────────────────
function Inventario({ activos, setActivos, onNavigate, onBack }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch]     = useState("");
  const [form, setForm]         = useState({ codigo:"", tipo:"", marca:"", serial:"", estado:"Activo", responsable:"", ubicacion:"", area:"IT", garantiaVence:"" });
  const [qrModal, setQrModal]   = useState(null); // activo para mostrar QR
  const [saved, setSaved]       = useState(false);

  const filtered = activos.filter(a =>
    [a.codigo,a.tipo,a.marca,a.serial,a.responsable,a.ubicacion].some(v=>v.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSave = () => {
    if (!form.codigo||!form.tipo||!form.marca||!form.serial||!form.responsable||!form.ubicacion) {
      alert("Por favor completa todos los campos obligatorios."); return;
    }
    if (activos.find(a=>a.codigo===form.codigo)) {
      alert("Ya existe un activo con ese código."); return;
    }
    const nuevo = { ...form, id: Date.now().toString(), fecha: new Date().toISOString().split("T")[0],
      historial: [{ fecha: new Date().toISOString().split("T")[0], accion:"Registro inicial", detalle:"Activo ingresado al sistema", usuario:"Admin" }] };
    const updated = [nuevo, ...activos];
    setActivos(updated); saveActivos(updated);
    setForm({ codigo:"", tipo:"", marca:"", serial:"", estado:"Activo", responsable:"", ubicacion:"", area:"IT", garantiaVence:"" });
    setShowForm(false); setSaved(true); setTimeout(()=>setSaved(false),2500);
  };

  const downloadQR = (activo) => {
    const url = generateQRDataURL(activo.codigo);
    const a = document.createElement("a"); a.href = url;
    a.download = `QR_${activo.codigo}.png`; a.click();
  };

  return (
    <Layout title="Gestión de Inventario" onBack={onBack}
      actions={
        <button onClick={()=>setShowForm(!showForm)}
          style={{ background:"#3b82f6", border:"none", borderRadius:8, color:"#fff", padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          <Plus size={15}/> {showForm?"Ver listado":"Nuevo Activo"}
        </button>
      }>
      {saved && (
        <div style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:10, padding:"10px 16px", marginBottom:16, color:"#065f46", fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
          <CheckCircle size={16}/> Activo registrado exitosamente.
        </div>
      )}

      {showForm ? (
        <div style={{ background:"#fff", borderRadius:14, padding:28, border:"1px solid #e2e8f0" }}>
          <h2 style={{ margin:"0 0 20px", fontSize:16, fontWeight:700, color:"#0f172a" }}>Registrar Nuevo Activo</h2>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            {[
              { label:"Código Activo *",  key:"codigo",      type:"text",   placeholder:"ACT-005" },
              { label:"Tipo de Equipo *", key:"tipo",        type:"select", options:["Laptop","Monitor","Teclado","Mouse","Impresora","Servidor","Tablet","Teléfono"] },
              { label:"Marca *",          key:"marca",       type:"text",   placeholder:"Dell, HP, Samsung..." },
              { label:"Serial *",         key:"serial",      type:"text",   placeholder:"SN-XXXXXX" },
              { label:"Estado",           key:"estado",      type:"select", options:["Activo","Inactivo","Mantenimiento"] },
              { label:"Responsable *",    key:"responsable", type:"text",   placeholder:"Nombre completo" },
              { label:"Área",             key:"area",        type:"select", options:["IT","RRHH","Ventas","Marketing","Finanzas","Operaciones"] },
              { label:"Garantía vence",   key:"garantiaVence",type:"date",  placeholder:"" },
            ].map(f=>(
              <div key={f.key} style={f.key==="ubicacion"?{ gridColumn:"1/-1" }:{}}>
                <label style={{ display:"block", fontSize:13, fontWeight:500, color:"#374151", marginBottom:6 }}>{f.label}</label>
                {f.type==="select"
                  ? <select value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})}
                      style={{ width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none", background:"#fff" }}>
                      {f.options.map(o=><option key={o}>{o}</option>)}
                    </select>
                  : <input type={f.type} value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})}
                      placeholder={f.placeholder}
                      style={{ width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" }}/>
                }
              </div>
            ))}
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ display:"block", fontSize:13, fontWeight:500, color:"#374151", marginBottom:6 }}>Ubicación *</label>
              <input value={form.ubicacion} onChange={e=>setForm({...form,ubicacion:e.target.value})}
                placeholder="Ej: Oficina 201, Almacén, Sala Reuniones..."
                style={{ width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" }}/>
            </div>
          </div>
          <div style={{ marginTop:20, display:"flex", gap:10 }}>
            <button onClick={handleSave}
              style={{ background:"#3b82f6", border:"none", borderRadius:8, color:"#fff", padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              <Save size={15}/> Guardar Activo
            </button>
            <button onClick={()=>setShowForm(false)}
              style={{ background:"#f1f5f9", border:"none", borderRadius:8, color:"#64748b", padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background:"#fff", borderRadius:14, border:"1px solid #e2e8f0", overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", borderBottom:"1px solid #f1f5f9", display:"flex", alignItems:"center", gap:10 }}>
            <Search size={16} color="#94a3b8"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por código, tipo, serial, responsable..."
              style={{ border:"none", outline:"none", fontSize:14, flex:1, color:"#374151" }}/>
            <span style={{ fontSize:12, color:"#94a3b8" }}>{filtered.length} activos</span>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#f8fafc" }}>
                  {["Código","Tipo","Serial","Responsable","Ubicación","Estado","Fecha","QR"].map(h=>(
                    <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a=>(
                  <tr key={a.id} style={{ borderTop:"1px solid #f1f5f9", cursor:"pointer", transition:"background .1s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
                    onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    <td style={{ padding:"12px 16px", fontSize:13, fontWeight:600, color:"#3b82f6" }} onClick={()=>onNavigate("detalle",a.id)}>{a.codigo}</td>
                    <td style={{ padding:"12px 16px", fontSize:13, color:"#374151" }} onClick={()=>onNavigate("detalle",a.id)}>{a.tipo} {a.marca}</td>
                    <td style={{ padding:"12px 16px", fontSize:12, color:"#64748b", fontFamily:"monospace" }} onClick={()=>onNavigate("detalle",a.id)}>{a.serial}</td>
                    <td style={{ padding:"12px 16px", fontSize:13, color:"#374151" }} onClick={()=>onNavigate("detalle",a.id)}>{a.responsable}</td>
                    <td style={{ padding:"12px 16px", fontSize:13, color:"#374151" }} onClick={()=>onNavigate("detalle",a.id)}>{a.ubicacion}</td>
                    <td style={{ padding:"12px 16px" }} onClick={()=>onNavigate("detalle",a.id)}>
                      <span style={{ fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:20, ...getStatStyle(a.estado) }}>{a.estado}</span>
                    </td>
                    <td style={{ padding:"12px 16px", fontSize:12, color:"#64748b" }} onClick={()=>onNavigate("detalle",a.id)}>{a.fecha}</td>
                    <td style={{ padding:"12px 16px" }}>
                      <button onClick={e=>{e.stopPropagation();setQrModal(a);}}
                        style={{ background:"#eff6ff", border:"none", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:"#3b82f6", display:"flex", alignItems:"center", gap:4, fontSize:12 }}>
                        <QrCode size={14}/> Ver QR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length===0 && (
              <div style={{ textAlign:"center", padding:"40px", color:"#94a3b8", fontSize:14 }}>No se encontraron activos.</div>
            )}
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setQrModal(null)}>
          <div style={{ background:"#fff", borderRadius:16, padding:32, width:280, textAlign:"center" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:"0 0 4px", fontSize:16, fontWeight:700 }}>Código QR</h3>
            <p style={{ margin:"0 0 16px", fontSize:12, color:"#64748b" }}>{qrModal.codigo} — {qrModal.tipo} {qrModal.marca}</p>
            <img src={generateQRDataURL(qrModal.codigo)} alt="QR" style={{ width:160, height:160, margin:"0 auto 16px", display:"block", border:"1px solid #e2e8f0", borderRadius:8 }}/>
            <button onClick={()=>downloadQR(qrModal)}
              style={{ background:"#3b82f6", border:"none", borderRadius:8, color:"#fff", padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6, margin:"0 auto 10px" }}>
              <Download size={14}/> Descargar QR
            </button>
            <button onClick={()=>setQrModal(null)} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:13 }}>Cerrar</button>
          </div>
        </div>
      )}
    </Layout>
  );
}

function getStatStyle(estado) {
  return {
    Activo:        { background:"#d1fae5", color:"#065f46" },
    Inactivo:      { background:"#fee2e2", color:"#991b1b" },
    Mantenimiento: { background:"#fef3c7", color:"#92400e" },
  }[estado] || { background:"#f1f5f9", color:"#475569" };
}

// ─── DETALLE ACTIVO ──────────────────────────────────────────────────────────
function DetalleActivo({ activoId, activos, setActivos, onBack, onNavigate }) {
  const activo = activos.find(a=>a.id===activoId);
  const [modal, setModal]   = useState(null); // "estado" | "mantenimiento"
  const [formData, setFormData] = useState({ estado:"", detalle:"", tecnico:"" });
  const [success, setSuccess]   = useState("");

  if (!activo) return <Layout title="Activo no encontrado" onBack={onBack}><p>No se encontró el activo.</p></Layout>;

  const qrUrl = generateQRDataURL(activo.codigo);

  const downloadQR = () => {
    const a = document.createElement("a"); a.href = qrUrl;
    a.download = `QR_${activo.codigo}.png`; a.click();
  };

  const handleSubmitCambio = () => {
    if (!formData.detalle || !formData.tecnico) { alert("Completa todos los campos"); return; }
    const hoy = new Date().toISOString().split("T")[0];
    const entrada = {
      fecha: hoy,
      accion: modal==="estado" ? `Estado actualizado a: ${formData.estado}` : "Mantenimiento registrado",
      detalle: formData.detalle,
      usuario: formData.tecnico,
    };
    const nuevoEstado = modal==="estado" ? formData.estado : (modal==="mantenimiento" ? "Mantenimiento" : activo.estado);
    const updated = activos.map(a => a.id===activoId
      ? { ...a, estado: nuevoEstado, historial: [entrada, ...(a.historial||[])] }
      : a
    );
    setActivos(updated); saveActivos(updated);
    setModal(null); setFormData({ estado:"", detalle:"", tecnico:"" });
    setSuccess(modal==="estado" ? "Estado actualizado correctamente." : "Mantenimiento registrado correctamente.");
    setTimeout(()=>setSuccess(""),3000);
  };

  return (
    <Layout title="Detalle del Activo" onBack={onBack}>
      {success && (
        <div style={{ background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:10, padding:"10px 16px", marginBottom:16, color:"#065f46", fontSize:13, display:"flex", alignItems:"center", gap:8 }}>
          <CheckCircle size={16}/> {success}
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20 }}>
        <div>
          <div style={{ background:"#fff", borderRadius:14, padding:24, border:"1px solid #e2e8f0", marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <h2 style={{ margin:0, fontSize:18, fontWeight:800, color:"#0f172a" }}>{activo.tipo} {activo.marca}</h2>
              <span style={{ fontSize:12, fontWeight:700, padding:"4px 10px", borderRadius:20, ...getStatStyle(activo.estado) }}>{activo.estado}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px 24px" }}>
              {[
                ["Código",             activo.codigo],
                ["Serial",             activo.serial],
                ["Tipo",               activo.tipo],
                ["Marca",              activo.marca],
                ["Responsable",        activo.responsable],
                ["Ubicación",          activo.ubicacion],
                ["Área",               activo.area||"—"],
                ["Fecha Adquisición",  activo.fecha],
                ["Garantía vence",     activo.garantiaVence||"—"],
              ].map(([k,v])=>(
                <div key={k} style={{ borderBottom:"1px solid #f1f5f9", paddingBottom:10 }}>
                  <p style={{ margin:0, fontSize:11, color:"#94a3b8", textTransform:"uppercase", letterSpacing:.5 }}>{k}</p>
                  <p style={{ margin:"3px 0 0", fontSize:14, fontWeight:600, color:"#1e293b" }}>{v}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop:20, display:"flex", gap:10 }}>
              <button onClick={()=>{ setFormData({...formData,estado:activo.estado}); setModal("estado"); }}
                style={{ background:"#3b82f6", border:"none", borderRadius:8, color:"#fff", padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                <Edit size={14}/> Actualizar estado
              </button>
              <button onClick={()=>setModal("mantenimiento")}
                style={{ background:"#f59e0b", border:"none", borderRadius:8, color:"#fff", padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
                <Wrench size={14}/> Registrar mantenimiento
              </button>
            </div>
          </div>

          <div style={{ background:"#fff", borderRadius:14, padding:24, border:"1px solid #e2e8f0" }}>
            <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#0f172a" }}>Historial de Cambios</h3>
            {(activo.historial||[]).length === 0
              ? <p style={{ color:"#94a3b8", fontSize:13 }}>Sin historial registrado.</p>
              : (activo.historial||[]).map((h,i)=>(
                <div key={i} style={{ display:"flex", gap:16, paddingBottom:14, borderBottom: i<activo.historial.length-1?"1px solid #f1f5f9":"none", marginBottom: i<activo.historial.length-1?14:0 }}>
                  <div style={{ minWidth:90, fontSize:12, color:"#94a3b8" }}>{h.fecha}</div>
                  <div>
                    <p style={{ margin:"0 0 2px", fontSize:13, fontWeight:700, color:"#1e293b" }}>{h.accion}</p>
                    <p style={{ margin:"0 0 2px", fontSize:13, color:"#475569" }}>{h.detalle}</p>
                    <p style={{ margin:0, fontSize:11, color:"#94a3b8" }}>Por: {h.usuario}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        <div style={{ background:"#fff", borderRadius:14, padding:24, border:"1px solid #e2e8f0", alignSelf:"start" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700, color:"#0f172a" }}>Código QR</h3>
          <img src={qrUrl} alt="QR" style={{ width:"100%", borderRadius:8, border:"1px solid #e2e8f0", marginBottom:12 }}/>
          <p style={{ textAlign:"center", fontSize:12, color:"#64748b", margin:"0 0 12px" }}>{activo.codigo}</p>
          <button onClick={downloadQR}
            style={{ width:"100%", background:"#f1f5f9", border:"none", borderRadius:8, padding:"9px", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6, color:"#374151" }}>
            <Download size={14}/> Descargar QR
          </button>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setModal(null)}>
          <div style={{ background:"#fff", borderRadius:16, padding:32, width:400, maxWidth:"90vw" }} onClick={e=>e.stopPropagation()}>
            <h3 style={{ margin:"0 0 20px", fontSize:17, fontWeight:700 }}>
              {modal==="estado" ? "Actualizar Estado" : "Registrar Mantenimiento"}
            </h3>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              {modal==="estado" && (
                <div>
                  <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:6 }}>Nuevo estado</label>
                  <select value={formData.estado} onChange={e=>setFormData({...formData,estado:e.target.value})}
                    style={{ width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none" }}>
                    <option value="">Seleccionar...</option>
                    {["Activo","Inactivo","Mantenimiento"].map(o=><option key={o}>{o}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:6 }}>
                  {modal==="estado" ? "Motivo del cambio" : "Descripción del mantenimiento"}
                </label>
                <textarea value={formData.detalle} onChange={e=>setFormData({...formData,detalle:e.target.value})}
                  rows={3} placeholder={modal==="estado" ? "Ej: Equipo reparado, listo para uso." : "Ej: Cambio de batería, limpieza interna."}
                  style={{ width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none", resize:"vertical", boxSizing:"border-box" }}/>
              </div>
              <div>
                <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:6 }}>Técnico responsable</label>
                <input value={formData.tecnico} onChange={e=>setFormData({...formData,tecnico:e.target.value})}
                  placeholder="Nombre del técnico"
                  style={{ width:"100%", padding:"9px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" }}/>
              </div>
            </div>
            <div style={{ marginTop:20, display:"flex", gap:10 }}>
              <button onClick={handleSubmitCambio}
                style={{ background:"#3b82f6", border:"none", borderRadius:8, color:"#fff", padding:"10px 20px", fontSize:13, fontWeight:600, cursor:"pointer", flex:1 }}>
                Guardar registro
              </button>
              <button onClick={()=>setModal(null)}
                style={{ background:"#f1f5f9", border:"none", borderRadius:8, color:"#64748b", padding:"10px 16px", fontSize:13, cursor:"pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ─── ESCANEO QR ──────────────────────────────────────────────────────────────
function Escaneo({ activos, onNavigate, onBack }) {
  const [codigo, setCodigo] = useState("");
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const buscar = () => {
    const found = activos.find(a=>a.codigo.toLowerCase()===codigo.toLowerCase().trim());
    if (found) { setResult(found); setNotFound(false); }
    else { setResult(null); setNotFound(true); }
  };

  return (
    <Layout title="Escaneo de Activos" onBack={onBack}>
      <div style={{ maxWidth:560, margin:"0 auto" }}>
        <div style={{ background:"#fff", borderRadius:14, padding:32, border:"1px solid #e2e8f0", textAlign:"center" }}>
          <div style={{ width:80, height:80, background:"#eff6ff", borderRadius:20, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 20px" }}>
            <QrCode size={40} color="#3b82f6"/>
          </div>
          <h2 style={{ margin:"0 0 8px", fontSize:18, fontWeight:700, color:"#0f172a" }}>Escanear Activo</h2>
          <p style={{ margin:"0 0 24px", fontSize:14, color:"#64748b" }}>Ingresa el código del activo para consultar su información.</p>

          <div style={{ display:"flex", gap:10 }}>
            <input value={codigo} onChange={e=>setCodigo(e.target.value)} onKeyDown={e=>e.key==="Enter"&&buscar()}
              placeholder="Ej: ACT-001"
              style={{ flex:1, padding:"11px 14px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none" }}/>
            <button onClick={buscar}
              style={{ background:"#3b82f6", border:"none", borderRadius:8, color:"#fff", padding:"11px 20px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
              Buscar
            </button>
          </div>

          {notFound && (
            <div style={{ marginTop:16, background:"#fee2e2", borderRadius:10, padding:"12px", color:"#991b1b", fontSize:13 }}>
              No se encontró ningún activo con ese código.
            </div>
          )}
        </div>

        {result && (
          <div style={{ background:"#fff", borderRadius:14, padding:24, border:"1px solid #e2e8f0", marginTop:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>{result.tipo} {result.marca}</h3>
              <span style={{ fontSize:11, fontWeight:700, padding:"4px 10px", borderRadius:20, ...getStatStyle(result.estado) }}>{result.estado}</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              {[["Código",result.codigo],["Serial",result.serial],["Responsable",result.responsable],["Ubicación",result.ubicacion]].map(([k,v])=>(
                <div key={k} style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px" }}>
                  <p style={{ margin:0, fontSize:11, color:"#94a3b8", textTransform:"uppercase" }}>{k}</p>
                  <p style={{ margin:"2px 0 0", fontSize:13, fontWeight:600, color:"#1e293b" }}>{v}</p>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:16 }}>
              <p style={{ margin:"0 0 6px", fontSize:12, fontWeight:600, color:"#64748b", textTransform:"uppercase" }}>Último historial</p>
              {(result.historial||[]).slice(0,2).map((h,i)=>(
                <div key={i} style={{ background:"#f8fafc", borderRadius:8, padding:"9px 12px", marginBottom:6, fontSize:12 }}>
                  <span style={{ color:"#94a3b8" }}>{h.fecha}</span> — <span style={{ color:"#374151", fontWeight:600 }}>{h.accion}</span>
                </div>
              ))}
            </div>
            <button onClick={()=>onNavigate("detalle",result.id)}
              style={{ background:"#3b82f6", border:"none", borderRadius:8, color:"#fff", padding:"9px 16px", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
              Ver detalle completo <ChevronRight size={14}/>
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

// ─── NOTIFICACIONES ──────────────────────────────────────────────────────────
function Notificaciones({ notificaciones, setNotificaciones, activos, setActivos, onNavigate, onBack }) {
  const [filter, setFilter] = useState("Todas");

  const tipos = ["Todas", "Mantenimiento", "Garantía próxima", "Garantía vencida"];
  const filtered = filter==="Todas" ? notificaciones : notificaciones.filter(n=>n.tipo===filter);

  const aprobar = (notif) => {
    const hoy = new Date().toISOString().split("T")[0];
    // Registrar en historial del activo
    const updated = activos.map(a => a.id===notif.activoId
      ? { ...a, historial: [{ fecha:hoy, accion:`Aprobado: ${notif.tipo}`, detalle: notif.detalle, usuario:"Admin" }, ...(a.historial||[])] }
      : a
    );
    setActivos(updated); saveActivos(updated);
    setNotificaciones(prev => prev.map(n=>n.id===notif.id?{...n,aprobado:true}:n));
  };

  const iconos = { "Mantenimiento": Wrench, "Garantía próxima": Clock, "Garantía vencida": AlertTriangle };
  const colors = {
    "Mantenimiento":    { bg:"#fee2e2", text:"#b91c1c", border:"#fca5a5" },
    "Garantía próxima": { bg:"#fef3c7", text:"#92400e", border:"#fcd34d" },
    "Garantía vencida": { bg:"#ffedd5", text:"#9a3412", border:"#fdba74" },
  };

  return (
    <Layout title="Notificaciones" onBack={onBack}>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {tipos.map(t=>(
          <button key={t} onClick={()=>setFilter(t)}
            style={{ padding:"6px 14px", borderRadius:20, border:"1px solid", fontSize:13, fontWeight:600, cursor:"pointer",
              borderColor: filter===t?"#3b82f6":"#e2e8f0",
              background: filter===t?"#3b82f6":"#fff",
              color: filter===t?"#fff":"#475569" }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {filtered.length===0 && <p style={{ color:"#94a3b8", fontSize:14 }}>No hay notificaciones en esta categoría.</p>}
        {filtered.map(n=>{
          const Icon = iconos[n.tipo] || Bell;
          const c = colors[n.tipo] || { bg:"#f1f5f9", text:"#475569", border:"#e2e8f0" };
          return (
            <div key={n.id} style={{ background:"#fff", borderRadius:12, padding:20, border:"1px solid #e2e8f0", borderLeft:`4px solid ${c.border}`, opacity: n.aprobado ? .6 : 1 }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                <div style={{ background:c.bg, borderRadius:10, padding:10, flexShrink:0 }}>
                  <Icon size={20} color={c.text}/>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontWeight:700, fontSize:14, color:"#0f172a" }}>{n.tipo}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:20,
                        background: n.prioridad==="Alta"?"#fee2e2":n.prioridad==="Media"?"#fef3c7":"#dbeafe",
                        color: n.prioridad==="Alta"?"#991b1b":n.prioridad==="Media"?"#92400e":"#1d4ed8" }}>
                        {n.prioridad}
                      </span>
                      {n.aprobado && <span style={{ fontSize:11, fontWeight:600, color:"#065f46", background:"#d1fae5", padding:"2px 8px", borderRadius:20 }}>✓ Aprobado</span>}
                    </div>
                  </div>
                  <p style={{ margin:"0 0 6px", fontSize:13, color:"#475569" }}>{n.detalle}</p>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:4, fontSize:12, color:"#64748b" }}>
                    <span><b>Activo:</b> {n.activo}</span>
                    <span><b>Código:</b> {n.codigo}</span>
                    <span><b>Resp.:</b> {n.responsable}</span>
                  </div>
                  {!n.aprobado && (
                    <div style={{ marginTop:12, display:"flex", gap:8 }}>
                      <button onClick={()=>aprobar(n)}
                        style={{ background:"#10b981", border:"none", borderRadius:7, color:"#fff", padding:"7px 14px", fontSize:12, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
                        <Check size={12}/> Aprobar
                      </button>
                      <button onClick={()=>onNavigate("detalle",n.activoId)}
                        style={{ background:"#f1f5f9", border:"none", borderRadius:7, color:"#475569", padding:"7px 14px", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                        Ver activo
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}

// ─── REPORTES ────────────────────────────────────────────────────────────────
function Reportes({ activos, onBack }) {
  const porArea = {};
  activos.forEach(a => { porArea[a.area||"Sin área"] = (porArea[a.area||"Sin área"]||0)+1; });
  const areaData = Object.entries(porArea).map(([area,cantidad])=>({ area,cantidad }));

  const estadoData = [
    { name:"Activos",       value: activos.filter(a=>a.estado==="Activo").length,        color:"#10b981" },
    { name:"Mantenimiento", value: activos.filter(a=>a.estado==="Mantenimiento").length,  color:"#f59e0b" },
    { name:"Inactivos",     value: activos.filter(a=>a.estado==="Inactivo").length,       color:"#ef4444" },
  ].filter(d=>d.value>0);

  const today = new Date();
  const in30  = new Date(); in30.setDate(in30.getDate()+30);
  const garantiasVencer = activos.filter(a=>{ if(!a.garantiaVence) return false; const d=new Date(a.garantiaVence); return d>=today&&d<=in30; }).length;

  const indicadores = [
    { label:"Áreas con activos",     value: Object.keys(porArea).length, color:"#3b82f6" },
    { label:"Equipos activos",       value: activos.filter(a=>a.estado==="Activo").length, color:"#10b981" },
    { label:"En mantenimiento",      value: activos.filter(a=>a.estado==="Mantenimiento").length, color:"#f59e0b" },
    { label:"Garantías próx. (30d)", value: garantiasVencer, color:"#ef4444" },
  ];

  return (
    <Layout title="Dashboard / Reportes" onBack={onBack}
      actions={
        <button onClick={()=>exportToExcel(activos)}
          style={{ background:"#3b82f6", border:"none", borderRadius:8, color:"#fff", padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}>
          <Download size={14}/> Exportar Excel
        </button>
      }>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:24 }}>
        {indicadores.map(i=>(
          <div key={i.label} style={{ background:"#fff", borderRadius:12, padding:"18px 20px", border:"1px solid #e2e8f0", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <p style={{ margin:0, fontSize:12, color:"#64748b" }}>{i.label}</p>
              <p style={{ margin:"3px 0 0", fontSize:26, fontWeight:800, color:"#0f172a" }}>{i.value}</p>
            </div>
            <div style={{ width:14, height:14, borderRadius:"50%", background:i.color }}/>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:24 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:24, border:"1px solid #e2e8f0" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700 }}>Activos por Área</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={areaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="area" tick={{ fontSize:12 }}/>
              <YAxis tick={{ fontSize:11 }}/>
              <Tooltip/>
              <Bar dataKey="cantidad" fill="#3b82f6" radius={[4,4,0,0]} name="Activos"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ background:"#fff", borderRadius:14, padding:24, border:"1px solid #e2e8f0" }}>
          <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:700 }}>Estado de Activos</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={estadoData} cx="50%" cy="50%" outerRadius={90}
                label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
                labelLine={false} dataKey="value">
                {estadoData.map(e=><Cell key={e.name} fill={e.color}/>)}
              </Pie>
              <Tooltip/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div style={{ background:"#fff", borderRadius:14, padding:24, border:"1px solid #e2e8f0" }}>
        <h3 style={{ margin:"0 0 14px", fontSize:15, fontWeight:700 }}>Resumen Ejecutivo</h3>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px 32px" }}>
          {[
            ["Total activos registrados", activos.length],
            ["Equipos activos", activos.filter(a=>a.estado==="Activo").length],
            ["En mantenimiento", activos.filter(a=>a.estado==="Mantenimiento").length],
            ["Inactivos", activos.filter(a=>a.estado==="Inactivo").length],
            ["Garantías próximas a vencer (30 días)", garantiasVencer],
            ["Áreas cubiertas", Object.keys(porArea).length],
          ].map(([k,v])=>(
            <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f8fafc", fontSize:13 }}>
              <span style={{ color:"#475569" }}>• {k}</span>
              <span style={{ fontWeight:700, color:"#0f172a" }}>{v}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize:12, color:"#94a3b8", marginTop:12 }}>
          * El botón "Exportar Excel" descarga un archivo .csv compatible con Microsoft Excel con todos los activos registrados.
        </p>
      </div>
    </Layout>
  );
}

// ─── VALIDACION ──────────────────────────────────────────────────────────────
function Validacion({ onBack }) {
  const [form, setForm] = useState({ tecnico:"", lider:"", fecha: new Date().toISOString().split("T")[0], accion:"" });
  const [done, setDone] = useState(false);

  const submit = () => {
    if (!form.tecnico||!form.lider||!form.accion) { alert("Completa todos los campos."); return; }
    setDone(true);
  };

  if (done) return (
    <Layout title="Validación / Firma" onBack={onBack}>
      <div style={{ maxWidth:480, margin:"60px auto", background:"#fff", borderRadius:16, padding:40, border:"1px solid #e2e8f0", textAlign:"center" }}>
        <div style={{ width:64, height:64, background:"#d1fae5", borderRadius:50, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
          <CheckCircle size={32} color="#10b981"/>
        </div>
        <h2 style={{ margin:"0 0 8px", fontSize:20, fontWeight:800 }}>Cambio aprobado</h2>
        <p style={{ color:"#64748b", marginBottom:24 }}>El registro fue validado por {form.lider} el {form.fecha}.</p>
        <button onClick={onBack} style={{ background:"#3b82f6", border:"none", borderRadius:8, color:"#fff", padding:"10px 24px", fontSize:14, fontWeight:600, cursor:"pointer" }}>
          Volver
        </button>
      </div>
    </Layout>
  );

  return (
    <Layout title="Validación / Firma" onBack={onBack}>
      <div style={{ maxWidth:480, margin:"0 auto", background:"#fff", borderRadius:16, padding:36, border:"1px solid #e2e8f0" }}>
        <h2 style={{ margin:"0 0 24px", fontSize:18, fontWeight:800, textAlign:"center", color:"#0f172a" }}>Validación de cambios</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {[
            { label:"Técnico responsable", key:"tecnico", placeholder:"Nombre del técnico" },
            { label:"Acción realizada",    key:"accion",  placeholder:"Ej: Mantenimiento preventivo, cambio de estado..." },
            { label:"Líder aprobador",     key:"lider",   placeholder:"Nombre del líder que aprueba" },
          ].map(f=>(
            <div key={f.key}>
              <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:6 }}>{f.label}</label>
              <input value={form[f.key]} onChange={e=>setForm({...form,[f.key]:e.target.value})}
                placeholder={f.placeholder}
                style={{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" }}/>
            </div>
          ))}
          <div>
            <label style={{ fontSize:13, fontWeight:500, color:"#374151", display:"block", marginBottom:6 }}>Fecha</label>
            <input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})}
              style={{ width:"100%", padding:"10px 12px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" }}/>
          </div>
        </div>
        <button onClick={submit}
          style={{ marginTop:24, width:"100%", background:"#10b981", border:"none", borderRadius:10, color:"#fff", padding:"13px", fontSize:15, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          <Check size={16}/> Aprobar cambio
        </button>
      </div>
    </Layout>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [user,    setUser]    = useState(() => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } });
  const [activos, setActivos] = useState(loadActivos);
  const [screen,  setScreen]  = useState("dashboard"); // dashboard | inventario | escaneo | detalle | notificaciones | reportes | validacion
  const [activoId,setActivoId]= useState(null);

  const notificaciones = loadNotificaciones(activos);
  const [notifState, setNotifState] = useState(notificaciones);

  // Refresh notifs whenever activos change
  useEffect(()=>{ setNotifState(loadNotificaciones(activos)); }, [activos]);

  const navigate = (to, id=null) => { setScreen(to); if(id) setActivoId(id); };
  const logout = () => { localStorage.removeItem(USER_KEY); setUser(null); };

  if (!user) return <Login onLogin={setUser}/>;

  const commonProps = { activos, setActivos, user, onLogout: logout };

  if (screen==="dashboard")      return <Dashboard {...commonProps} notificaciones={notifState} onNavigate={navigate}/>;
  if (screen==="inventario")     return <Inventario {...commonProps} onNavigate={navigate} onBack={()=>setScreen("dashboard")}/>;
  if (screen==="escaneo")        return <Escaneo    {...commonProps} onNavigate={navigate} onBack={()=>setScreen("dashboard")}/>;
  if (screen==="detalle")        return <DetalleActivo {...commonProps} activoId={activoId} onBack={()=>setScreen("inventario")} onNavigate={navigate}/>;
  if (screen==="notificaciones") return <Notificaciones {...commonProps} notificaciones={notifState} setNotificaciones={setNotifState} onNavigate={navigate} onBack={()=>setScreen("dashboard")}/>;
  if (screen==="reportes")       return <Reportes   {...commonProps} onBack={()=>setScreen("dashboard")}/>;
  if (screen==="validacion")     return <Validacion onBack={()=>setScreen("dashboard")}/>;
  return null;
}
