import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BusFront,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Hourglass,
  LogOut,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
  XCircle,
} from "lucide-react";
import "./admin.css";

const tokenKey = "campAdminToken";
const workflowStatuses = [
  { value: "received", label: "Received" },
  { value: "under_review", label: "Under Review" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

function formatStatus(value) {
  return workflowStatuses.find((status) => status.value === value)?.label || value;
}

function formatDate(value, includeTime = false) {
  if (!value) return "—";
  const date = includeTime ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function yesNo(value) {
  if (value === null || value === undefined) return "Not provided";
  return value ? "Yes" : "No";
}

function Detail({ label, value, wide = false }) {
  return <div className={`admin-detail ${wide ? "wide" : ""}`}><span>{label}</span><strong>{value === "" || value === null || value === undefined ? "—" : String(value)}</strong></div>;
}

export default function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem(tokenKey) || "");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [summary, setSummary] = useState({ total: 0, pendingReview: 0, upcoming: 0, expectedAttendance: 0 });
  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [campDate, setCampDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState("");

  const logout = useCallback(() => {
    sessionStorage.removeItem(tokenKey);
    setToken("");
    setRequests([]);
    setSelected(null);
  }, []);

  const api = useCallback(async (path, options = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && token) {
      logout();
      throw new Error("Your admin session expired. Please sign in again.");
    }
    if (!response.ok) throw new Error(data.message || "The request could not be completed.");
    return data;
  }, [logout, token]);

  const loadDashboard = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20", search, status, campDate });
      const [summaryData, listData] = await Promise.all([api("/api/admin/summary"), api(`/api/admin/requests?${params}`)]);
      setSummary(summaryData);
      setRequests(listData.items);
      setPages(listData.pages);
      setTotal(listData.total);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [api, campDate, page, search, status, token]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const login = async (event) => {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(credentials) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to sign in.");
      sessionStorage.setItem(tokenKey, data.token);
      setToken(data.token);
      setCredentials({ email: "", password: "" });
    } catch (requestError) {
      setLoginError(requestError.message);
    } finally {
      setLoggingIn(false);
    }
  };

  const openDetails = async (requestId) => {
    setDetailsLoading(true);
    setError("");
    try {
      const data = await api(`/api/admin/requests/${requestId}`);
      setSelected(data.item);
      setStatusError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const updateRequestStatus = async (nextStatus) => {
    if (!selected || nextStatus === selected.status) return;
    setStatusUpdating(true);
    setStatusError("");
    try {
      const data = await api(`/api/admin/requests/${selected.requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setSelected(data.item);
      await loadDashboard();
    } catch (requestError) {
      setStatusError(requestError.message);
    } finally {
      setStatusUpdating(false);
    }
  };

  if (!token) {
    return <main className="admin-login-page">
      <section className="admin-login-card">
        <a className="admin-back" href="/"><ArrowLeft /> Back to camp form</a>
        <div className="admin-login-brand"><ShieldCheck /><span>Authorized access</span></div>
        <h1>Camp Administration</h1>
        <p>Sign in to securely view registered camp requests and their complete details.</p>
        <form onSubmit={login}>
          <label htmlFor="admin-email">Admin email</label>
          <input id="admin-email" type="email" value={credentials.email} onChange={(event) => setCredentials({ ...credentials, email: event.target.value })} autoComplete="username" required />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" type="password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} autoComplete="current-password" minLength="8" required />
          {loginError && <p className="admin-error" role="alert">{loginError}</p>}
          <button type="submit" disabled={loggingIn}>{loggingIn ? "Signing in..." : "Sign in securely"}</button>
        </form>
      </section>
    </main>;
  }

  return <div className="admin-shell">
    <header className="admin-header">
      <div><div className="admin-header-icon"><ShieldCheck /></div><div><span>Adhiparasakthi Hospitals</span><h1>Camp Request Dashboard</h1></div></div>
      <div className="admin-header-actions"><a href="/"><ArrowLeft /> Public form</a><button type="button" onClick={logout}><LogOut /> Logout</button></div>
    </header>

    <main className="admin-content">
      <section className="admin-summary" aria-label="Camp request summary">
        <article><span><FileText /></span><div><small>Total Requests</small><strong>{summary.total}</strong></div></article>
        <article><span><Hourglass /></span><div><small>Pending Review</small><strong>{summary.pendingReview}</strong></div></article>
        <article><span><CalendarDays /></span><div><small>Upcoming Camps</small><strong>{summary.upcoming}</strong></div></article>
        <article><span><Users /></span><div><small>Expected Attendance</small><strong>{summary.expectedAttendance}</strong></div></article>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading"><div><h2>Registered camp requests</h2><p>{total} request{total === 1 ? "" : "s"} found</p></div></div>
        <form className="admin-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); }}>
          <div><Search /><input type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search ID, name, phone or village" /></div>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status">
            <option value="">All statuses</option>{workflowStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={campDate} onChange={(event) => { setCampDate(event.target.value); setPage(1); }} aria-label="Filter by camp date">
            <option value="">Camp Date</option><option value="today">Today</option><option value="upcoming">Upcoming</option><option value="past">Past</option>
          </select>
          <button type="submit">Search</button>
        </form>

        {error && <p className="admin-notice error" role="alert">{error}</p>}
        <div className="admin-table-wrap" aria-busy={loading}>
          <table>
            <thead><tr><th>Request ID</th><th>Requestor</th><th>Village</th><th>Camp date</th><th>People</th><th>Bus</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {!loading && requests.map((item) => <tr key={item.requestId}>
                <td><strong>{item.requestId}</strong><small>{formatDate(item.createdAt, true)}</small></td>
                <td>{item.requesterName}<small>{item.requesterPhone}</small></td><td>{item.village}</td><td>{formatDate(item.campDate)}</td><td>{item.personCount}</td><td>{yesNo(item.busRequired)}</td>
                <td><span className={`status-badge ${item.status}`}>{formatStatus(item.status)}</span></td>
                <td><button className="view-button" type="button" onClick={() => openDetails(item.requestId)} disabled={detailsLoading}><Eye /> View</button></td>
              </tr>)}
              {!loading && requests.length === 0 && <tr><td colSpan="8"><div className="admin-empty"><FileText /><strong>No requests found</strong><span>New camp registrations will appear here.</span></div></td></tr>}
              {loading && <tr><td colSpan="8"><div className="admin-empty"><span className="admin-loader" /><strong>Loading requests...</strong></div></td></tr>}
            </tbody>
          </table>
        </div>

        <div className="admin-pagination"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><ChevronLeft /> Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Next <ChevronRight /></button></div>
      </section>
    </main>

    {selected && <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="request-details-title">
      <button className="admin-modal-backdrop" type="button" aria-label="Close details" onClick={() => setSelected(null)} />
      <article className="admin-modal-card">
        <header className="admin-request-header">
          <div className="admin-request-title">
            <span>Mobile Mammography Camp</span>
            <h2 id="request-details-title">Camp Request</h2>
            <div><strong>{selected.requestId}</strong><span className={`status-badge ${selected.status}`}>{formatStatus(selected.status)}</span></div>
          </div>
          <button type="button" aria-label="Close request details" onClick={() => setSelected(null)}><X /></button>
        </header>
        <div className="admin-detail-section"><h3><UserRound /> Requestor</h3><div className="admin-detail-grid"><Detail label="Name" value={selected.requesterName} /><Detail label="Age" value={selected.requesterAge} /><Detail label="Designation" value={selected.designation} /><Detail label="Mobile" value={selected.requesterPhone} /></div></div>
        <div className="admin-detail-section"><h3><CalendarDays /> Camp</h3><div className="admin-detail-grid"><Detail label="Village" value={selected.village} /><Detail label="Taluk" value={selected.taluk} /><Detail label="Preferred Date" value={formatDate(selected.campDate)} /><Detail label="Expected People" value={selected.personCount} /></div></div>
        <div className="admin-detail-section"><h3><BusFront /> Bus</h3><div className="admin-detail-grid"><Detail label="Bus Required" value={yesNo(selected.busRequired)} /><Detail label="Space Available" value={yesNo(selected.spaceAvailable)} /><Detail label="Location" value={selected.parkingLocation} /><Detail label="Space" value={selected.spaceLength && selected.spaceWidth ? `${selected.spaceLength} × ${selected.spaceWidth} ft` : "Not provided"} /></div></div>
        <div className="admin-detail-section"><h3><Users /> Seating</h3><div className="admin-detail-grid"><Detail label="Required" value={yesNo(selected.seatingRequired)} /><Detail label="Capacity" value={selected.seatingCapacity} /><Detail label="Requirements" value={selected.seatingRequirements} wide /></div></div>
        <div className="admin-detail-section admin-remarks-section"><h3>Remarks</h3><p>{selected.additionalRemarks || "No additional remarks provided."}</p></div>
        <footer>
          <div className="admin-action-panel">
            <h3><CheckCircle2 /> Admin action</h3>
            {["received", "under_review"].includes(selected.status) && <div className="admin-action-buttons">
              <button className="reject" type="button" onClick={() => updateRequestStatus("rejected")} disabled={statusUpdating}><XCircle /> Reject</button>
              <button className="review" type="button" onClick={() => updateRequestStatus("under_review")} disabled={statusUpdating || selected.status === "under_review"}>Under Review</button>
              <button className="confirm" type="button" onClick={() => updateRequestStatus("confirmed")} disabled={statusUpdating}><CheckCircle2 /> Confirm</button>
            </div>}
            {selected.status === "confirmed" && <div className="admin-confirmed-state">
              <div><CheckCircle2 /><span><strong>Confirmed</strong><small>Confirmed Camp Date: <b>{formatDate(selected.campDate)}</b></small></span></div>
              <button type="button" onClick={() => updateRequestStatus("completed")} disabled={statusUpdating}>{statusUpdating ? "Updating..." : "Mark Camp Completed"}</button>
            </div>}
            {selected.status === "completed" && <div className="admin-terminal-state completed"><CheckCircle2 /><span><strong>Camp Completed</strong><small>Completed {formatDate(selected.completedAt || selected.updatedAt, true)}</small></span></div>}
            {selected.status === "rejected" && <div className="admin-terminal-state rejected"><XCircle /><span><strong>Request Rejected</strong><small>Rejected {formatDate(selected.rejectedAt || selected.updatedAt, true)}</small></span></div>}
            {statusError && <span className="admin-status-error" role="alert">{statusError}</span>}
          </div>
          <span className="admin-submitted-meta">Submitted {formatDate(selected.createdAt, true)} · Language: {selected.language === "ta" ? "Tamil" : "English"}</span>
        </footer>
      </article>
    </div>}
  </div>;
}
