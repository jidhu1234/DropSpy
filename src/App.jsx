// WinningHunter — React Frontend (main App component)
// npm install axios react-router-dom recharts @stripe/stripe-js @stripe/react-stripe-js

import { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
const AuthCtx = createContext(null);

// ─── API Client ───────────────────────────────────────────────────────────────
const api = axios.create({ baseURL: API });
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem("wh_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── Auth Provider ────────────────────────────────────────────────────────────
function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("wh_user") || "null"));

  const login = async (email, password) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("wh_token", data.token);
    localStorage.setItem("wh_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password, name) => {
    const { data } = await api.post("/api/auth/register", { email, password, name });
    localStorage.setItem("wh_token", data.token);
    localStorage.setItem("wh_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("wh_token");
    localStorage.removeItem("wh_user");
    setUser(null);
  };

  return <AuthCtx.Provider value={{ user, login, register, logout }}>{children}</AuthCtx.Provider>;
}

const useAuth = () => useContext(AuthCtx);

// ─── Score Badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  const color = score >= 80 ? "#1D9E75" : score >= 60 ? "#EF9F27" : "#E24B4A";
  return (
    <div style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${color}`,
      background: color + "22", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 600, color }}>
      {score}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV = [
  { icon: "🏠", label: "Dashboard", path: "/dashboard" },
  { icon: "🔥", label: "Products", path: "/products" },
  { icon: "📢", label: "Ad Spy", path: "/ads" },
  { icon: "📈", label: "Trends", path: "/trends" },
  { icon: "🏪", label: "Store Tracker", path: "/stores" },
  { icon: "🔖", label: "Saved", path: "/saved" },
];

function Sidebar() {
  const { user, logout } = useAuth();
  const limits = { starter: 50, pro: 500, agency: "∞" };
  return (
    <div style={{ width: 220, background: "#fff", borderRight: "1px solid #f0f0f0",
      display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0 }}>
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16 }}>
          ⚡ WinningHunter
          <span style={{ background: "#1D9E75", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 4 }}>
            {user?.plan?.toUpperCase()}
          </span>
        </div>
      </div>
      <nav style={{ flex: 1, padding: 12 }}>
        {NAV.map(n => (
          <Link key={n.path} to={n.path} style={{ display: "flex", alignItems: "center", gap: 10,
            padding: "9px 12px", borderRadius: 8, textDecoration: "none", color: "#555",
            fontSize: 14, marginBottom: 2, transition: "all 0.15s" }}
            className="nav-link">
            {n.icon} {n.label}
          </Link>
        ))}
      </nav>
      <div style={{ margin: 12, padding: 12, background: "#E1F5EE", borderRadius: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#0F6E56" }}>
          {user?.plan === "agency" ? "Agency Plan" : user?.plan === "pro" ? "Pro Plan" : "Starter Plan"}
        </div>
        <div style={{ fontSize: 11, color: "#1D9E75", margin: "4px 0 8px" }}>
          Limit: {limits[user?.plan]} searches/day
        </div>
        {user?.plan !== "agency" && (
          <Link to="/billing" style={{ display: "block", textAlign: "center", background: "#1D9E75",
            color: "#fff", padding: "7px", borderRadius: 7, fontSize: 12, textDecoration: "none" }}>
            Upgrade Plan →
          </Link>
        )}
      </div>
      <button onClick={logout} style={{ margin: "0 12px 12px", padding: "8px", background: "none",
        border: "1px solid #eee", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#999" }}>
        Sign out
      </button>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState({});
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    api.get("/api/dashboard").then(r => setStats(r.data));
    api.get("/api/products?sort=score&limit=5").then(r => setTrending(r.data));
  }, []);

  const chartData = [
    { day: "Mon", fb: 310, tt: 180 },
    { day: "Tue", fb: 420, tt: 240 },
    { day: "Wed", fb: 390, tt: 300 },
    { day: "Thu", fb: 510, tt: 410 },
    { day: "Fri", fb: 480, tt: 520 },
    { day: "Sat", fb: 620, tt: 680 },
    { day: "Sun", fb: 710, tt: 790 },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Trending Products", value: stats.trending_products || "2,847", icon: "🔥" },
          { label: "Active Ads Tracked", value: stats.active_ads || "48,203", icon: "📢" },
          { label: "Stores Monitored", value: stats.stores_monitored || "1,204", icon: "🏪" },
          { label: "Saved Products", value: stats.saved_products || "37", icon: "🔖" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #f0f0f0",
            borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{s.icon} {s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Engagement this week</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="fb" stroke="#3266ad" strokeWidth={2} name="Facebook" dot={false} />
              <Line type="monotone" dataKey="tt" stroke="#1D9E75" strokeWidth={2} name="TikTok" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Top niches</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              { niche: "Health", count: 412 }, { niche: "Pet", count: 287 },
              { niche: "Beauty", count: 265 }, { niche: "Home", count: 198 },
              { niche: "Fitness", count: 174 },
            ]} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="niche" type="category" tick={{ fontSize: 11 }} width={50} />
              <Tooltip />
              <Bar dataKey="count" fill="#9FE1CB" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top products */}
      <ProductTable products={trending} title="🔥 Top Winning Products Today" />
    </div>
  );
}

// ─── Products Page ────────────────────────────────────────────────────────────
function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState({ niche: "", source: "", min_score: "" });
  const [loading, setLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    const { data } = await api.get("/api/products", { params });
    setProducts(data);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Winning Products</h1>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <select value={filters.niche} onChange={e => setFilters(f => ({ ...f, niche: e.target.value }))}
          style={{ padding: "8px 12px", border: "1px solid #eee", borderRadius: 8, fontSize: 13 }}>
          <option value="">All Niches</option>
          {["Health","Pet","Beauty","Home","Fitness","Kitchen","Baby","Tech","Fashion"].map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <select value={filters.source} onChange={e => setFilters(f => ({ ...f, source: e.target.value }))}
          style={{ padding: "8px 12px", border: "1px solid #eee", borderRadius: 8, fontSize: 13 }}>
          <option value="">All Sources</option>
          <option value="facebook">Facebook</option>
          <option value="tiktok">TikTok</option>
          <option value="amazon">Amazon</option>
        </select>
        <select value={filters.min_score} onChange={e => setFilters(f => ({ ...f, min_score: e.target.value }))}
          style={{ padding: "8px 12px", border: "1px solid #eee", borderRadius: 8, fontSize: 13 }}>
          <option value="">Any Score</option>
          <option value="90">90+ (🔥 Hot)</option>
          <option value="70">70+ (Good)</option>
          <option value="50">50+ (Decent)</option>
        </select>
        <button onClick={fetchProducts} style={{ padding: "8px 20px", background: "#1D9E75",
          color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
          Search
        </button>
      </div>

      {loading ? <div style={{ textAlign: "center", padding: 40, color: "#999" }}>Loading...</div>
        : <ProductTable products={products} />}
    </div>
  );
}

// ─── Reusable Product Table ───────────────────────────────────────────────────
function ProductTable({ products = [], title }) {
  const [saved, setSaved] = useState({});

  const toggleSave = async (id) => {
    const { data } = await api.post(`/api/products/${id}/save`);
    setSaved(s => ({ ...s, [id]: data.saved }));
  };

  const mockProducts = [
    { id: 1, title: "Infrared Ear Thermometer", niche: "Health", source: "tiktok", score: 94, spend_estimate: 24000, engagement_7d: 87400 },
    { id: 2, title: "Pet Hair Remover Brush", niche: "Pet", source: "facebook", score: 91, spend_estimate: 18000, engagement_7d: 64000 },
    { id: 3, title: "LED Sunset Projector Lamp", niche: "Home", source: "tiktok", score: 78, spend_estimate: 11000, engagement_7d: 43000 },
    { id: 4, title: "Vitamin C Serum 30ml", niche: "Beauty", source: "facebook", score: 73, spend_estimate: 9000, engagement_7d: 31000 },
  ];

  const rows = products.length ? products : mockProducts;

  return (
    <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 12, overflow: "hidden" }}>
      {title && (
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f0f0", fontSize: 14, fontWeight: 600 }}>
          {title}
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#fafafa" }}>
            {["Product", "Niche", "Source", "Ad Spend/day", "Engagement", "Score", ""].map(h => (
              <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11,
                color: "#999", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.id} style={{ borderTop: "1px solid #f5f5f5" }}
              onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
              onMouseLeave={e => e.currentTarget.style.background = ""}>
              <td style={{ padding: "13px 16px" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.title}</div>
              </td>
              <td style={{ padding: "13px 16px", fontSize: 13, color: "#555" }}>{p.niche}</td>
              <td style={{ padding: "13px 16px" }}>
                <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500,
                  background: p.source === "tiktok" ? "#E6F1FB" : "#E1F5EE",
                  color: p.source === "tiktok" ? "#185FA5" : "#0F6E56" }}>
                  {p.source}
                </span>
              </td>
              <td style={{ padding: "13px 16px", fontSize: 13 }}>
                ${(p.spend_estimate / 1000).toFixed(0)}k/day
              </td>
              <td style={{ padding: "13px 16px", fontSize: 13, color: "#555" }}>
                {(p.engagement_7d / 1000).toFixed(0)}k
              </td>
              <td style={{ padding: "13px 16px" }}><ScoreBadge score={p.score} /></td>
              <td style={{ padding: "13px 16px" }}>
                <button onClick={() => toggleSave(p.id)} style={{ background: "none", border: "none",
                  cursor: "pointer", fontSize: 18 }}>
                  {saved[p.id] ? "❤️" : "🤍"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Billing Page ─────────────────────────────────────────────────────────────
function BillingPage() {
  const PLANS = [
    { id: "starter", name: "Starter", price: 0, searches: 50, features: ["50 searches/day", "Basic product data", "Email alerts"] },
    { id: "pro", name: "Pro", price: 49, searches: 500, features: ["500 searches/day", "Ad Spy access", "Store tracker (10 stores)", "Profit calculator", "Priority support"] },
    { id: "agency", name: "Agency", price: 149, searches: "∞", features: ["Unlimited searches", "Full ad spy", "Unlimited store tracking", "API access", "White-label reports", "Dedicated support"] },
  ];

  return (
    <div style={{ padding: 40, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Choose your plan</h1>
      <p style={{ color: "#888", marginBottom: 32 }}>Upgrade to unlock more searches, features, and winning products.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {PLANS.map(plan => (
          <div key={plan.id} style={{ background: "#fff", border: plan.id === "pro" ? "2px solid #1D9E75" : "1px solid #f0f0f0",
            borderRadius: 16, padding: 24, position: "relative" }}>
            {plan.id === "pro" && (
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                background: "#1D9E75", color: "#fff", fontSize: 11, padding: "3px 12px", borderRadius: 20 }}>
                Most Popular
              </div>
            )}
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{plan.name}</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
              {plan.price === 0 ? "Free" : `$${plan.price}`}
              {plan.price > 0 && <span style={{ fontSize: 14, fontWeight: 400, color: "#888" }}>/mo</span>}
            </div>
            <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>{plan.searches} searches/day</div>
            {plan.features.map(f => (
              <div key={f} style={{ fontSize: 13, color: "#555", marginBottom: 6, display: "flex", gap: 6 }}>
                <span style={{ color: "#1D9E75" }}>✓</span> {f}
              </div>
            ))}
            {plan.price > 0 && (
              <button style={{ marginTop: 20, width: "100%", padding: 12, background: plan.id === "pro" ? "#1D9E75" : "#f5f5f5",
                color: plan.id === "pro" ? "#fff" : "#333", border: "none", borderRadius: 10,
                fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
                Get {plan.name}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Login / Register ─────────────────────────────────────────────────────────
function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const submit = async () => {
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.email, form.password, form.name);
      navigate("/dashboard");
    } catch (e) {
      setError(e.response?.data?.error || "Something went wrong");
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#f8faf8" }}>
      <div style={{ background: "#fff", border: "1px solid #f0f0f0", borderRadius: 16, padding: 40, width: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28 }}>⚡</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>WinningHunter</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Find your next winning product</div>
        </div>

        {mode === "register" && (
          <input placeholder="Your name" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #eee", borderRadius: 8,
              fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
        )}
        <input placeholder="Email" type="email" value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #eee", borderRadius: 8,
            fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
        <input placeholder="Password" type="password" value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #eee", borderRadius: 8,
            fontSize: 14, marginBottom: 16, boxSizing: "border-box" }} />

        {error && <div style={{ color: "#E24B4A", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <button onClick={submit} style={{ width: "100%", padding: 12, background: "#1D9E75",
          color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 15 }}>
          {mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#888" }}>
          {mode === "login" ? "No account?" : "Already have an account?"}{" "}
          <span onClick={() => setMode(mode === "login" ? "register" : "login")}
            style={{ color: "#1D9E75", cursor: "pointer", fontWeight: 600 }}>
            {mode === "login" ? "Sign up free" : "Sign in"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
function ProtectedLayout() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8faf8" }}>
      <Sidebar />
      <div style={{ flex: 1, overflow: "auto" }}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/*" element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
