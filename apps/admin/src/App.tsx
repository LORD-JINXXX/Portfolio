import React from "react";
import type {
  Binding,
  ContentBinding,
  RuntimeManifest,
  RuntimeRoute,
  StudioNode,
} from "@platform/contracts";
import { RuntimeSitePreview, matchRuntimeRoute } from "@platform/runtime-renderer";
import {
  ActionFeedback,
  AppThemeProvider,
  AppThemeSelector,
  useMutationActions,
} from "@platform/ui";
import { AdminAuthContext, AuthGate } from "./AuthGate";
import { deleteMediaAndRefresh, uploadMediaAndRefresh } from "./media-upload";
import { apiFetch } from "./api";
import {
  ContentPublishedRefreshError,
  publishContentAndRefresh,
} from "./content-publish";
import { ReleaseManager } from "./ReleaseManager";

type Screen =
  | "dashboard"
  | "projects"
  | "notes"
  | "experience"
  | "apps"
  | "content"
  | "media"
  | "layouts"
  | "releases"
  | "settings";
const nav: [Screen, string][] = [
  ["dashboard", "Dashboard"],
  ["projects", "Projects"],
  ["notes", "Notes"],
  ["experience", "Experience"],
  ["apps", "AI Apps"],
  ["content", "Site Content"],
  ["media", "Media"],
  ["layouts", "Layouts"],
  ["releases", "Releases"],
  ["settings", "Settings"],
];
const B: React.CSSProperties = {
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  borderRadius: 7,
  padding: "8px 11px",
  cursor: "pointer",
};
const P: React.CSSProperties = {
  ...B,
  background: "var(--primary)",
  borderColor: "var(--primary)",
  color: "var(--primary-text)",
  fontWeight: 700,
};
const I: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 9px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--surface-alt)",
  color: "var(--text)",
};
const singular = (title: string) => title === "Experience" ? title : title.replace(/s$/, "");

export default function App() {
  return (
    <AppThemeProvider
      defaultTheme="codex-black"
      storageKey="portfolio-admin-theme"
    >
      <AuthGate>
        <AdminApp />
      </AuthGate>
    </AppThemeProvider>
  );
}
function AdminApp() {
  const [screen, setScreen] = React.useState<Screen>("dashboard");
  const auth = React.useContext(AdminAuthContext);
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [screen]);
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "system-ui,sans-serif",
      }}
    >
      <aside
        style={{
          width: 245,
          flexShrink: 0,
          height: "100vh",
          position: "sticky",
          top: 0,
          borderRight: "1px solid var(--border)",
          background: "var(--surface)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <strong style={{ fontSize: 18 }}>Admin CMS</strong>
          <AppThemeSelector align="left" />
        </div>
        <nav style={{ display: "grid", gap: 5 }}>
          {nav.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setScreen(id)}
              style={{
                ...B,
                textAlign: "left",
                borderColor: screen === id ? "var(--primary)" : "transparent",
                background: screen === id ? "var(--primary)" : "transparent",
                color:
                  screen === id
                    ? "var(--primary-text)"
                    : "var(--text-secondary)",
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <button
          style={{ ...B, marginBottom: 12 }}
          disabled={auth?.signingOut}
          aria-busy={auth?.signingOut}
          onClick={auth?.logout}
        >
          {auth?.signingOut ? "Signing out..." : "Logout"}
        </button>
        <small style={{ color: "var(--text-muted)" }}>
          Content + Publishing Control
        </small>
      </aside>
      <main
        style={{ flex: 1, minWidth: 0, minHeight: "100vh", padding: "clamp(18px, 3vw, 34px)" }}
      >
        {screen === "dashboard" && <Dashboard />}
        {screen === "projects" && <Crud resource="projects" title="Projects" />}
        {screen === "notes" && <Crud resource="notes" title="Notes" />}
        {screen === "experience" && (
          <Crud resource="experience" title="Experience" />
        )}
        {screen === "apps" && <Crud resource="apps" title="AI Applications" />}
        {screen === "media" && <MediaManager />}
        {screen === "settings" && <Settings />}
        {screen === "layouts" && (
          <Layouts onConfigure={() => setScreen("content")} />
        )}{" "}
        {screen === "content" && <VisualContent onNavigate={setScreen} />}
        {screen === "releases" && <ReleaseManager />}
      </main>
    </div>
  );
}
function Header({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 22,
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 32 }}>{title}</h1>
        <p style={{ color: "var(--text-muted)", margin: "5px 0 0" }}>{sub}</p>
      </div>
      {action}
    </div>
  );
}
function Box({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--surface)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
function LoadingState({ label = "Loading data…" }: { label?: string }) {
  return (
    <Box style={{ padding: 22, color: "var(--text-muted)" }}>
      <span role="status" aria-live="polite">{label}</span>
    </Box>
  );
}
function Dashboard() {
  const [d, setD] = React.useState<any>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    let current = true;
    setLoading(true);
    apiFetch<any>("/api/admin/dashboard")
      .then((r) => { if (current) { setD(r.data); setError(""); } })
      .catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : "Dashboard data could not be loaded."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);
  return (
    <>
      <Header title="Dashboard" sub="Platform health and publishing overview" />
      {loading && <LoadingState label="Loading dashboard data…" />}
      {!loading && error && <Box style={{ padding: 18, color: "var(--danger)" }}>{error}</Box>}
      {!loading && !error && <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: 12,
        }}
      >
        {Object.entries(d?.counts || {}).map(([k, v]) => (
          <Box key={k} style={{ padding: 18 }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                textTransform: "capitalize",
              }}
            >
              {k.replace("_", " ")}
            </div>
            <strong style={{ fontSize: 28 }}>{String(v)}</strong>
          </Box>
        ))}
      </div>
      <Box style={{ padding: 18, marginTop: 14 }}>
        <strong>Active Release</strong>
        <p style={{ color: "var(--text-muted)" }}>
          {d?.activeRelease
            ? `Release #${d.activeRelease.release_number}`
            : "No active release yet"}
        </p>
      </Box>
      </>}
    </>
  );
}

const configs: any = {
  projects: {
    fields: [
      ["title", "text"],
      ["slug", "text"],
      ["short_description", "textarea"],
      ["full_description", "textarea"],
      ["thumbnail_media_id", "media"],
      ["gallery_media_ids", "media-array"],
      ["technologies", "array"],
      ["github_url", "text"],
      ["live_url", "text"],
      ["display_order", "number"],
      ["seo", "json"],
      ["featured", "boolean"],
      ["published", "boolean"],
    ],
  },
  notes: {
    fields: [
      ["title", "text"],
      ["slug", "text"],
      ["summary", "textarea"],
      ["content", "textarea"],
      ["category", "text"],
      ["tags", "array"],
      ["cover_media_id", "media"],
      ["display_order", "number"],
      ["seo", "json"],
      ["featured", "boolean"],
      ["published", "boolean"],
    ],
  },
  experience: {
    fields: [
      ["company", "text"],
      ["role", "text"],
      ["employment_type", "text"],
      ["location", "text"],
      ["start_date", "date"],
      ["end_date", "date"],
      ["summary", "textarea"],
      ["responsibilities", "array"],
      ["technologies", "array"],
      ["logo_media_id", "media"],
      ["display_order", "number"],
      ["current", "boolean"],
      ["published", "boolean"],
    ],
  },
  apps: {
    fields: [
      ["name", "text"],
      ["slug", "text"],
      ["short_description", "textarea"],
      ["full_description", "textarea"],
      ["icon_media_id", "media"],
      ["cover_media_id", "media"],
      ["category", "text"],
      ["tags", "array"],
      ["status", "ai-status"],
      ["display_order", "number"],
      ["requires_login", "boolean"],
      ["featured", "boolean"],
      ["published", "boolean"],
    ],
  },
  media: {
    fields: [
      ["filename", "text"],
      ["storage_path", "text"],
      ["public_url", "text"],
      ["mime_type", "text"],
      ["size", "number"],
      ["kind", "text"],
      ["alt_text", "text"],
    ],
  },
};
function Crud({ resource, title }: { resource: string; title: string }) {
  const cfg = configs[resource],
    [rows, setRows] = React.useState<any[]>([]),
    [editing, setEditing] = React.useState<any | null>(null),
    [err, setErr] = React.useState(""),
    [loading, setLoading] = React.useState(true);
  const structuredActions = useMutationActions();
  const managedMutationUx = ["projects", "notes", "experience", "apps"].includes(resource);
  const load = (isCurrent: () => boolean = () => true) => {
    setLoading(true);
    return apiFetch<any>(`/api/admin/${resource}`)
      .then((r) => {
        if (isCurrent()) { setRows(r.data || []); setErr(""); }
      })
      .catch((e) => {
        if (isCurrent()) setErr(e.message);
      })
      .finally(() => { if (isCurrent()) setLoading(false); });
  };
  React.useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, [resource]);
  const fresh = () =>
    Object.fromEntries(
      cfg.fields.map(([k, t]: any) => [
        k,
        t === "boolean"
          ? false
          : t === "number"
            ? 0
            : t === "array"
              ? []
              : t === "json"
                ? {}
                : "",
      ]),
    );
  const save = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!editing) return;
    if (!managedMutationUx) {
      void apiFetch(
        editing.id ? `/api/admin/${resource}/${editing.id}` : `/api/admin/${resource}`,
        { method: editing.id ? "PATCH" : "POST", body: JSON.stringify(editing) },
      ).then(() => { setEditing(null); void load(); }).catch((cause) => setErr(cause.message));
      return;
    }
    const recordId = editing.id ? String(editing.id) : "new";
    const actionKey = editing.id ? `save-${resource}-${recordId}` : `create-${resource}`;
    void structuredActions.run({
      key: actionKey,
      conflictKey: `${resource}-record-${recordId}`,
      pending: editing.id ? `Saving ${title.toLowerCase()}...` : `Creating ${title.toLowerCase()}...`,
      success: editing.id ? `${singular(title)} updated successfully.` : `${singular(title)} created successfully.`,
      action: () => apiFetch(
        editing.id ? `/api/admin/${resource}/${editing.id}` : `/api/admin/${resource}`,
        { method: editing.id ? "PATCH" : "POST", body: JSON.stringify(editing) },
      ),
      onSuccess: async () => { setEditing(null); await load(); },
      error: `${singular(title)} could not be saved. Check the entered values and try again.`,
    });
  };
  const remove = (record: any) => {
    if (!confirm("Delete this record?")) return;
    if (!managedMutationUx) {
      void apiFetch(`/api/admin/${resource}/${record.id}`, { method: "DELETE" })
        .then(() => load())
        .catch((cause) => setErr(cause.message));
      return;
    }
    void structuredActions.run({
      key: `delete-${resource}-${record.id}`,
      conflictKey: `${resource}-record-${record.id}`,
      pending: `Deleting ${singular(title).toLowerCase()}...`,
      success: `${singular(title)} deleted successfully.`,
      action: () => apiFetch(`/api/admin/${resource}/${record.id}`, { method: "DELETE" }),
      onSuccess: async () => { await load(); },
      error: `${singular(title)} could not be deleted. Try again.`,
    });
  };
  return (
    <>
      <Header
        title={title}
        sub={`Manage structured ${title.toLowerCase()} data`}
        action={
          <button style={P} onClick={() => setEditing(fresh())}>
            + New
          </button>
        }
      />
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      <div style={{ display: "grid", gap: 9 }}>
        {loading && rows.length === 0 && <LoadingState label={`Loading ${title.toLowerCase()}…`} />}
        {!loading && !err && rows.length === 0 && (
          <Box style={{ padding: 22, color: "var(--text-muted)" }}>
            No records yet.
          </Box>
        )}
        {rows.map((r) => (
          <Box
            key={r.id}
            style={{
              padding: 14,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ flex: 1 }}>
              <strong>
                {r.title || r.name || r.company || r.filename || "Untitled"}
              </strong>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                {r.short_description ||
                  r.summary ||
                  r.role ||
                  r.storage_path ||
                  r.slug ||
                  ""}
              </div>
            </div>
            {"published" in r && (
              <span
                style={{
                  fontSize: 11,
                  color: r.published ? "var(--success)" : "var(--warning)",
                }}
              >
                {r.published ? "Published" : "Draft"}
              </span>
            )}
            <button style={B} onClick={() => setEditing({ ...r })}>
              Edit
            </button>
            <button
              style={B}
              disabled={managedMutationUx && structuredActions.isConflictPending(`${resource}-record-${r.id}`)}
              aria-busy={managedMutationUx && structuredActions.isPending(`delete-${resource}-${r.id}`)}
              onClick={() => remove(r)}
            >
              {managedMutationUx && structuredActions.isPending(`delete-${resource}-${r.id}`) ? "Deleting..." : "Delete"}
            </button>
          </Box>
        ))}
      </div>
      {editing && (
        <Modal
          title={editing.id ? `Edit ${title}` : `New ${title}`}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={save}>
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 10 }}
          >
            {cfg.fields.map(([k, t]: any) => (
              <Field
                key={k}
                label={k}
                type={t}
                resource={resource}
                value={editing[k]}
                onChange={(v: any) => setEditing({ ...editing, [k]: v })}
              />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 16,
            }}
          >
            <button type="button" style={B} onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              type="submit"
              style={P}
              disabled={managedMutationUx && structuredActions.isConflictPending(`${resource}-record-${editing.id ? String(editing.id) : "new"}`)}
              aria-busy={managedMutationUx && structuredActions.isPending(editing.id ? `save-${resource}-${editing.id}` : `create-${resource}`)}
            >
              {managedMutationUx && structuredActions.isPending(editing.id ? `save-${resource}-${editing.id}` : `create-${resource}`)
                ? editing.id ? "Saving..." : "Creating..."
                : "Save"}
            </button>
          </div>
          </form>
        </Modal>
      )}
      {managedMutationUx && <ActionFeedback feedback={structuredActions.feedback} onDismiss={structuredActions.dismiss} />}
    </>
  );
}
const AI_APP_STATUSES = [
  ["coming_soon", "Coming soon"],
  ["available", "Available"],
  ["maintenance", "Maintenance"],
  ["disabled", "Disabled"],
] as const;

function fieldPlaceholder(resource: string | undefined, label: string, type: string): string {
  const exact: Record<string, string> = {
    title: "e.g. Realtime Collaboration Platform",
    name: resource === "apps" ? "e.g. Resume Match Analyzer" : "Enter a name",
    slug: "lowercase-words-with-hyphens",
    short_description: "Short summary shown in cards",
    full_description: "Detailed description",
    summary: "Brief summary",
    content: "Write the full note content",
    category: "e.g. AI, Frontend, Backend",
    technologies: "Comma-separated, e.g. React, TypeScript, Node.js",
    tags: "Comma-separated, e.g. ai, jobs, resume",
    responsibilities: "Comma-separated responsibilities",
    github_url: "https://github.com/username/repository",
    live_url: "https://example.com",
    company: "e.g. Acme Technologies",
    role: "e.g. Full Stack Developer",
    employment_type: "e.g. Full-time, Contract, Internship",
    location: "e.g. Remote or Bengaluru, India",
    start_date: "YYYY-MM-DD",
    end_date: "YYYY-MM-DD (optional)",
    display_order: "0",
  };
  if (exact[label]) return exact[label];
  if (type === "array") return "Comma-separated values";
  if (type === "number") return "Enter a number";
  if (type === "textarea") return `Enter ${pretty(label).toLowerCase()}`;
  return `Enter ${pretty(label).toLowerCase()}`;
}

function fieldHelp(resource: string | undefined, label: string, type: string): string | undefined {
  if (label === "slug") return "Use lowercase letters, numbers and hyphens only.";
  if (type === "date") return label === "start_date" ? "Required. Choose a date from the calendar." : "Optional. Leave empty for an ongoing role.";
  if (type === "array") return "Separate multiple values with commas.";
  if (type === "ai-status") return "Controls whether the AI app is available to visitors.";
  if (label === "display_order") return "Lower numbers appear first.";
  if (label === "github_url" || label === "live_url") return "Use a complete http:// or https:// URL.";
  if (resource === "projects" && label === "gallery_media_ids") return "Select one or more managed images; duplicates are not allowed.";
  return undefined;
}

function Field({
  label,
  type,
  resource,
  value,
  onChange,
}: {
  label: string;
  type: string;
  resource?: string;
  value: any;
  onChange: (v: any) => void;
}) {
  if (type === "media")
    return (
      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {pretty(label)}
        <MediaIdPicker value={value || ""} onChange={onChange} />
      </label>
    );
  if (type === "media-array")
    return (
      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {pretty(label)}
        <MediaIdMultiPicker value={value || []} onChange={onChange} />
      </label>
    );
  if (type === "boolean")
    return (
      <label
        style={{
          fontSize: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
          paddingTop: 21,
        }}
      >
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
        {pretty(label)}
      </label>
    );
  if (type === "json")
    return <JsonField label={label} value={value} onChange={onChange} />;
  if (type === "ai-status") {
    return (
      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {pretty(label)}
        <select
          style={{ ...I, marginTop: 4 }}
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          required
        >
          <option value="" disabled>Select status…</option>
          {AI_APP_STATUSES.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
        </select>
        <span style={{ display: "block", marginTop: 4, fontSize: 10 }}>{fieldHelp(resource, label, type)}</span>
      </label>
    );
  }
  const placeholder = fieldPlaceholder(resource, label, type);
  const help = fieldHelp(resource, label, type);
  return (
    <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
      {pretty(label)}
      {type === "textarea" ? (
        <textarea
          rows={4}
          style={{ ...I, marginTop: 4 }}
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          style={{ ...I, marginTop: 4 }}
          type={type === "number" ? "number" : type === "date" ? "date" : (label === "github_url" || label === "live_url") ? "url" : "text"}
          value={type === "array" ? (value || []).join(", ") : (value ?? "")}
          placeholder={placeholder}
          onChange={(e) =>
            onChange(
              type === "number"
                ? Number(e.target.value)
                : type === "array"
                  ? e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean)
                  : e.target.value,
            )
          }
        />
      )}
      {help && <span style={{ display: "block", marginTop: 4, fontSize: 10 }}>{help}</span>}
    </label>
  );
}

function useImageMedia() {
  const [rows, setRows] = React.useState<any[]>([]);
  React.useEffect(() => {
    apiFetch<any>("/api/admin/media")
      .then((response) => setRows((response.data || []).filter((row: any) => String(row.mime_type || "").startsWith("image/"))))
      .catch(() => {});
  }, []);
  return rows;
}

function MediaIdPicker({ value, onChange }: { value: string; onChange: (value: string | null) => void }) {
  const rows = useImageMedia();
  return (
    <select style={{ ...I, marginTop: 4 }} value={value} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">No managed media</option>
      {rows.map((row) => <option key={row.id} value={row.id}>{row.filename}</option>)}
    </select>
  );
}

function MediaIdMultiPicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const rows = useImageMedia();
  return (
    <select multiple style={{ ...I, marginTop: 4, minHeight: 120 }} value={value} onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
      {rows.map((row) => <option key={row.id} value={row.id}>{row.filename}</option>)}
    </select>
  );
}
function JsonField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: any;
  onChange: (v: any) => void;
}) {
  const [text, setText] = React.useState(() =>
    JSON.stringify(value ?? {}, null, 2),
  );
  const [error, setError] = React.useState("");
  React.useEffect(() => setText(JSON.stringify(value ?? {}, null, 2)), [value]);
  return (
    <label
      style={{ fontSize: 11, color: "var(--text-muted)", gridColumn: "1 / -1" }}
    >
      {pretty(label)}
      <textarea
        rows={5}
        style={{ ...I, marginTop: 4, fontFamily: "ui-monospace,monospace" }}
        value={text}
        placeholder={'{\n  "title": "Example"\n}'}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          try {
            onChange(JSON.parse(text || "{}"));
            setError("");
          } catch {
            setError("Invalid JSON — fix it before saving.");
          }
        }}
      />
      {error && (
        <span
          style={{ display: "block", color: "var(--danger)", marginTop: 3 }}
        >
          {error}
        </span>
      )}
    </label>
  );
}

function Settings() {
  type SettingValueType = "text" | "number" | "boolean" | "json";
  const [rows, setRows] = React.useState<any[]>([]);
  const [revision, setRevision] = React.useState<any | null>(null);
  const [key, setKey] = React.useState("site.name");
  const [value, setValue] = React.useState("");
  const [valueType, setValueType] = React.useState<SettingValueType>("text");
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const settingsActions = useMutationActions();

  const load = React.useCallback(async (isCurrent: () => boolean = () => true) => {
    setLoading(true);
    try {
      const draftResponse = await apiFetch<any>("/api/admin/settings-revisions/draft", { method: "POST" });
      const response = await apiFetch<any>("/api/admin/settings");
      if (isCurrent()) {
        setRevision(draftResponse.data);
        setRows(response.data || []);
        setErr("");
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let current = true;
    void load(() => current).catch((cause) => { if (current) setErr(cause instanceof Error ? cause.message : "Settings draft could not be loaded."); });
    return () => { current = false; };
  }, [load]);

  const parseValue = () => {
    if (valueType === "number") {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error("Enter a valid number.");
      return parsed;
    }
    if (valueType === "boolean") {
      if (!["true", "false"].includes(value.trim().toLowerCase())) throw new Error("Boolean values must be true or false.");
      return value.trim().toLowerCase() === "true";
    }
    if (valueType === "json") {
      try { return JSON.parse(value); } catch { throw new Error("Enter valid JSON."); }
    }
    return value;
  };

  const saveSetting = (event: React.FormEvent) => {
    event.preventDefault();
    const settingKey = key.trim();
    if (!settingKey || !revision?.id) return;
    if (!/^[A-Za-z0-9._-]{1,160}$/.test(settingKey)) {
      setErr("Setting key may contain only letters, numbers, dots, underscores and hyphens (for example: site.name).");
      return;
    }
    let parsed: unknown;
    try { parsed = parseValue(); setErr(""); } catch (cause) { setErr(cause instanceof Error ? cause.message : "Invalid setting value."); return; }
    void settingsActions.run({
      key: `save-setting-${settingKey}`,
      conflictKey: "settings-revision-action",
      pending: "Saving setting draft...",
      success: (result: { refreshed: boolean }) => result.refreshed ? "Setting saved to the draft revision." : "Setting saved, but the Settings view could not refresh. Reload the page to see the committed value.",
      action: async () => {
        await apiFetch(`/api/admin/settings-revisions/${revision.id}/values`, {
          method: "PUT",
          body: JSON.stringify({ key: settingKey, value: parsed }),
        });
        try { await load(); return { refreshed: true }; }
        catch (cause) {
          setErr(cause instanceof Error ? `Setting was saved, but refresh failed: ${cause.message}` : "Setting was saved, but refresh failed.");
          return { refreshed: false };
        }
      },
      error: (cause) => cause instanceof Error ? cause.message : "Setting could not be saved. Check the value and try again.",
    });
  };

  const publishSettings = () => {
    if (!revision?.id || revision.status !== "draft") return;
    void settingsActions.run({
      key: "publish-settings",
      conflictKey: "settings-revision-action",
      pending: "Publishing settings revision...",
      success: (result: { refreshed: boolean }) => result.refreshed ? `Settings revision ${revision.revision_number} published. A new draft is ready for future edits.` : `Settings revision ${revision.revision_number} published, but the Settings view could not refresh. Reload to continue with the next draft.`,
      action: async () => {
        await apiFetch(`/api/admin/settings-revisions/${revision.id}/publish`, { method: "POST" });
        try { await load(); return { refreshed: true }; }
        catch (cause) {
          setErr(cause instanceof Error ? `Settings were published, but refresh failed: ${cause.message}` : "Settings were published, but refresh failed.");
          return { refreshed: false };
        }
      },
      error: "Settings revision could not be published.",
    });
  };

  const editExisting = (row: any) => {
    const current = row.value_json;
    setKey(row.key);
    if (typeof current === "number") { setValueType("number"); setValue(String(current)); }
    else if (typeof current === "boolean") { setValueType("boolean"); setValue(String(current)); }
    else if (current && typeof current === "object") { setValueType("json"); setValue(JSON.stringify(current, null, 2)); }
    else { setValueType("text"); setValue(String(current ?? "")); }
  };

  const pending = settingsActions.isConflictPending("settings-revision-action");
  const valuePlaceholder = valueType === "boolean" ? "true or false" : valueType === "number" ? "e.g. 10" : valueType === "json" ? '{ "theme": "dark" }' : "e.g. Mustafa's Portfolio";
  return (
    <>
      <Header
        title="Site Settings"
        sub="Edit a typed draft revision. Publishing settings does not activate the live site; Releases control production."
        action={<button style={P} disabled={pending || !revision?.id} aria-busy={settingsActions.isPending("publish-settings")} onClick={publishSettings}>{settingsActions.isPending("publish-settings") ? "Publishing..." : `Publish Settings r${revision?.revision_number ?? ""}`}</button>}
      />
      <Box style={{ padding: 14, marginBottom: 15 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>Editing immutable workflow draft: r{revision?.revision_number ?? "…"}. Values become release-eligible only after Publish Settings.</div>
        {loading && rows.length === 0 ? <LoadingState label="Loading site settings…" /> : <form onSubmit={saveSetting} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 10, alignItems: "start" }}>
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Setting Key
            <input aria-label="Setting key" style={{ ...I, marginTop: 4 }} value={key} onChange={(e) => setKey(e.target.value)} placeholder="site.name" />
            <span style={{ display: "block", fontSize: 10, marginTop: 4 }}>Letters, numbers, dots, underscores and hyphens only.</span>
          </label>
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Value Type
            <select style={{ ...I, marginTop: 4 }} aria-label="Setting value type" value={valueType} onChange={(event) => setValueType(event.target.value as SettingValueType)}><option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="json">JSON</option></select>
            <span style={{ display: "block", fontSize: 10, marginTop: 4 }}>Choose the type that matches the value you want to store.</span>
          </label>
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Value
            {valueType === "json" ? <textarea aria-label="Setting value" rows={4} style={{ ...I, marginTop: 4 }} value={value} onChange={(e) => setValue(e.target.value)} placeholder={valuePlaceholder} /> : <input aria-label="Setting value" style={{ ...I, marginTop: 4 }} value={value} onChange={(e) => setValue(e.target.value)} placeholder={valuePlaceholder} />}
            <span style={{ display: "block", fontSize: 10, marginTop: 4 }}>{valueType === "boolean" ? "Accepted values: true or false." : valueType === "json" ? "Enter valid JSON." : "This is the value used by content/layout bindings."}</span>
          </label>
          <button type="submit" style={{ ...P, alignSelf: "end", minHeight: 40 }} disabled={pending || !key.trim() || !revision?.id} aria-busy={settingsActions.isPending(`save-setting-${key.trim()}`)}>{settingsActions.isPending(`save-setting-${key.trim()}`) ? "Saving..." : "Save Draft"}</button>
        </form>
        }
      </Box>
      {err && <p role="alert" style={{ color: "var(--danger)" }}>{err}</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <Box key={r.id} style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 12, alignItems: "center" }}>
            <code>{r.key}</code>
            <span style={{ overflowWrap: "anywhere" }}>{typeof r.value_json === "string" ? r.value_json : JSON.stringify(r.value_json)}</span>
            <button style={{ ...B, justifySelf: "start" }} disabled={pending} onClick={() => editExisting(r)}>Edit Draft</button>
          </Box>
        ))}
      </div>
      <ActionFeedback feedback={settingsActions.feedback} onDismiss={settingsActions.dismiss} />
    </>
  );
}

function Layouts({ onConfigure }: { onConfigure: () => void }) {
  const [cards, setCards] = React.useState<any[]>([]),
    [preview, setPreview] = React.useState<RuntimeManifest | null>(null),
    [route, setRoute] = React.useState(0),
    [selectedVersions, setSelectedVersions] = React.useState<Record<string, string>>({}),
    [loading, setLoading] = React.useState(true),
    [loadError, setLoadError] = React.useState("");
  const layoutActions = useMutationActions();
  const preferredVersion = React.useCallback((card: any) =>
    card.versions?.find((version: any) => version.isConfiguring)?.id ||
    card.versions?.find((version: any) => version.isLive)?.id ||
    card.versions?.find((version: any) => version.compatible)?.id ||
    card.latestPublishedVersion?.id || "", []);
  const load = (isCurrent: () => boolean = () => true) => {
    setLoading(true);
    return apiFetch<any>("/api/admin/layouts").then((r) => {
      if (!isCurrent()) return;
      const nextCards = r.data || [];
      setCards(nextCards);
      setLoadError("");
      setSelectedVersions((previous) => {
        const next = { ...previous };
        for (const card of nextCards) {
          const stillExists = card.versions?.some((version: any) => version.id === next[card.layout.id]);
          if (!stillExists) next[card.layout.id] = preferredVersion(card);
        }
        return next;
      });
    }).catch((cause) => {
      if (isCurrent()) setLoadError(cause instanceof Error ? cause.message : "Layouts could not be loaded.");
    }).finally(() => { if (isCurrent()) setLoading(false); });
  };
  React.useEffect(() => {
    let current = true;
    void load(() => current);
    return () => { current = false; };
  }, [preferredVersion]);
  const open = (v: string) => {
    void layoutActions.run({
      key: `preview-layout-${v}`,
      pending: "Loading layout preview...",
      success: "Layout preview loaded.",
      action: () => apiFetch<any>(`/api/admin/layouts/versions/${v}/preview`),
      onSuccess: (response) => { setPreview(response.data); setRoute(0); },
      error: "Layout preview could not be loaded. Try again.",
    });
  };
  const configure = (v: string) => {
    void layoutActions.run({
      key: `configure-layout-${v}`,
      conflictKey: "layout-configuration",
      pending: "Configuring layout...",
      success: "Published layout version selected for content configuration. Production is unchanged.",
      action: () => apiFetch(`/api/admin/layouts/${v}/configure`, { method: "POST" }),
      onSuccess: async () => { await load(); onConfigure(); },
      error: "Layout version could not be selected for configuration. Check compatibility and try again.",
    });
  };
  return (
    <>
      <Header
        title="Layout Library"
        sub="Published Studio designs. Select any compatible published version, preview sample data, or configure content without changing production."
      />
      {loading && cards.length === 0 && <LoadingState label="Loading published layouts…" />}
      {!loading && loadError && <Box style={{ padding: 18, color: "var(--danger)" }}>{loadError}</Box>}
      {!loading && !loadError && cards.length === 0 && <Box style={{ padding: 22, color: "var(--text-muted)" }}>No published layouts yet.</Box>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
        {cards.map((c) => {
          const selectedId = selectedVersions[c.layout.id] || preferredVersion(c);
          const selected = c.versions?.find((version: any) => version.id === selectedId) || c.latestPublishedVersion;
          if (!selected) return null;
          return (
            <Box key={c.layout.id} style={{ overflow: "hidden" }}>
              <div style={{ height: 185, overflow: "hidden", background: "var(--workspace)", position: "relative" }}>
                {selected.homePage ? (
                  <div style={{ transform: "scale(.25)", transformOrigin: "top left", width: "400%", height: "400%", pointerEvents: "none" }}>
                    <Mini versionId={selected.id} />
                  </div>
                ) : (
                  <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--text-muted)" }}>No Home page</div>
                )}
                <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {selected.isLive && <Badge text="LIVE" color="var(--success)" />}
                  {selected.isConfiguring && <Badge text="CONFIGURING" color="var(--warning)" />}
                  <Badge text={selected.compatible ? "COMPATIBLE" : "INCOMPATIBLE"} color={selected.compatible ? "var(--success)" : "var(--danger)"} />
                </div>
              </div>
              <div style={{ padding: 15 }}>
                <h3 style={{ margin: "0 0 5px" }}>{c.layout.name}</h3>
                <label style={{ display: "grid", gap: 5, fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
                  Published version
                  <select
                    aria-label={`${c.layout.name} published version`}
                    style={I}
                    value={selected.id}
                    onChange={(event) => setSelectedVersions((current) => ({ ...current, [c.layout.id]: event.target.value }))}
                  >
                    {(c.versions || []).map((version: any) => (
                      <option key={version.id} value={version.id}>
                        v{version.version_number} · {version.compatible ? "Compatible" : "Incompatible"}{version.isLive ? " · Live" : ""}{version.isConfiguring ? " · Configuring" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                  v{selected.version_number} · {selected.pageCount} pages · schema {selected.schema_version} · runtime ≥ {selected.runtime_min_version || "1.0.0"}
                </div>
                {!selected.compatible && selected.compatibilityReason && (
                  <div role="alert" style={{ fontSize: 11, color: "var(--danger)", marginTop: 7 }}>{selected.compatibilityReason}</div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button
                    style={B}
                    disabled={layoutActions.isPending(`preview-layout-${selected.id}`)}
                    aria-busy={layoutActions.isPending(`preview-layout-${selected.id}`)}
                    onClick={() => open(selected.id)}
                  >
                    {layoutActions.isPending(`preview-layout-${selected.id}`) ? "Loading Preview..." : "Preview"}
                  </button>
                  <button
                    style={P}
                    disabled={!selected.compatible || layoutActions.isConflictPending("layout-configuration")}
                    aria-busy={layoutActions.isPending(`configure-layout-${selected.id}`)}
                    onClick={() => configure(selected.id)}
                  >
                    {layoutActions.isPending(`configure-layout-${selected.id}`) ? "Configuring..." : "Configure Content"}
                  </button>
                </div>
              </div>
            </Box>
          );
        })}
      </div>
      {preview && (
        <FullPreview manifest={preview} routeIndex={route} setRoute={setRoute} onClose={() => setPreview(null)} />
      )}
      <ActionFeedback feedback={layoutActions.feedback} onDismiss={layoutActions.dismiss} />
    </>
  );
}
function Mini({ versionId }: { versionId: string }) {
  const [m, setM] = React.useState<RuntimeManifest | null>(null);
  React.useEffect(() => {
    apiFetch<any>(`/api/admin/layouts/versions/${versionId}/preview`)
      .then((r) => setM(r.data))
      .catch(() => {});
  }, [versionId]);
  if (!m || !m.routes[0]) return null;
  return <RuntimeSitePreview manifest={m} route={m.routes[0]} mode="desktop" />;
}
function previewRouteIndex(manifest: RuntimeManifest, href: string) {
  let pathname = href.split("#")[0].split("?")[0] || "/";
  try { pathname = new URL(href, "https://preview.invalid").pathname || "/"; } catch {}
  const match = matchRuntimeRoute(manifest.routes, pathname);
  return match ? manifest.routes.findIndex((route) => route.pageId === match.route.pageId) : -1;
}
function FullPreview({
  manifest,
  routeIndex,
  setRoute,
  onClose,
}: {
  manifest: RuntimeManifest;
  routeIndex: number;
  setRoute: (n: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = React.useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const r = manifest.routes[routeIndex] || manifest.routes[0];
  return (
    <Modal wide title="Layout Preview · sample content" onClose={onClose}>
      <div
        style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}
      >
        {manifest.routes.map((x, i) => (
          <button
            key={x.pageId}
            style={{
              ...B,
              background:
                i === routeIndex ? "var(--primary)" : "var(--surface)",
              color: i === routeIndex ? "var(--primary-text)" : "var(--text)",
            }}
            onClick={() => setRoute(i)}
          >
            {x.name}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {(["desktop", "tablet", "mobile"] as const).map((x) => (
          <button
            key={x}
            style={{
              ...B,
              background: x === mode ? "var(--primary)" : "var(--surface)",
            }}
            onClick={() => setMode(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <div
        style={{
          height: "72vh",
          overflow: "auto",
          background: "var(--workspace)",
        }}
      >
        <div
          style={{
            width: mode === "desktop" ? "100%" : mode === "tablet" ? 768 : 375,
            maxWidth: "100%",
            margin: "0 auto",
          }}
        >
          <RuntimeSitePreview
            manifest={manifest}
            route={r}
            mode={mode}
            onNavigate={(href) => {
              const i = previewRouteIndex(manifest, href);
              if (i >= 0) setRoute(i);
            }}
          />
        </div>
      </div>
    </Modal>
  );
}

function VisualContent({
  onNavigate,
}: {
  onNavigate: (screen: Screen) => void;
}) {
  const [ctx, setCtx] = React.useState<any>(),
    [pageId, setPageId] = React.useState(""),
    [selected, setSelected] = React.useState<{
      node: StudioNode;
      keys: string[];
    } | null>(null),
    [detailItemKey, setDetailItemKey] = React.useState(""),
    [previewMode, setPreviewMode] = React.useState(false),
    [err, setErr] = React.useState("");
  const contentActions = useMutationActions();
  const createContentDraft = React.useCallback(
    () => apiFetch("/api/admin/content-revisions/draft", { method: "POST" }),
    [],
  );
  const loadEditorContext = React.useCallback(
    () =>
      apiFetch<any>("/api/admin/content/editor-context").then(
        (response) => response.data,
      ),
    [],
  );
  const applyEditorContext = React.useCallback((next: any) => {
    setCtx(next);
    setPageId((old: string) =>
      old && next.manifest.routes.some((x: any) => x.pageId === old)
          ? old
          : next.manifest.routes[0]?.pageId || "",
    );
    setErr("");
  }, []);
  const refreshEditorContext = React.useCallback(async () => {
    await createContentDraft();
    applyEditorContext(await loadEditorContext());
  }, [applyEditorContext, createContentDraft, loadEditorContext]);
  React.useEffect(() => {
    let current = true;
    void createContentDraft()
      .then(loadEditorContext)
      .then((next) => {
        if (current) applyEditorContext(next);
      })
      .catch((cause) => {
        if (current)
          setErr(
            cause instanceof Error
              ? cause.message
              : "The content editor could not be loaded.",
          );
      });
    return () => {
      current = false;
    };
  }, [applyEditorContext, createContentDraft, loadEditorContext]);
  if (err)
    return (
      <>
        <Header title="Site Content" sub="Visual content editor" />
        <Box style={{ padding: 20, color: "var(--danger)" }}>
          {err}
          <div style={{ color: "var(--text-muted)", marginTop: 8 }}>
            Publish a Studio layout and choose “Configure Content” in Layouts
            first.
          </div>
        </Box>
      </>
    );
  if (!ctx) return <div>Loading content editor…</div>;
  const manifest = ctx.manifest as RuntimeManifest;
  const ordinary = manifest.routes;
  const current = ordinary.find((x) => x.pageId === pageId) || ordinary[0];
  const pages = [
    { id: "__header", name: "Header", schema: manifest.globals.header },
    ...ordinary.map((route) => ({
      id: route.pageId,
      name: route.name,
      schema: route.schema,
    })),
    { id: "__footer", name: "Footer", schema: manifest.globals.footer },
  ].filter((x) => x.schema);
  const renderRoute: RuntimeRoute = current || ordinary[0];
  const detailItems = renderRoute?.pageType === "collection_detail" && renderRoute.collectionName
    ? (manifest.collections?.[renderRoute.collectionName] || []) as Record<string, unknown>[]
    : [];
  const fieldContext = detailItems.length
    ? detailItems.find((item: any) => String(item.slug ?? item.id) === detailItemKey) || detailItems[0]
    : undefined;
  const systemPage = pageId === "__header" || pageId === "__footer";
  const saveValue = (key: string, value: unknown) => {
    if (!ctx.revision?.id) return;
    const revisionId = ctx.revision.id;
    void contentActions.run({
      key: `save-content-${key}`,
      conflictKey: "content-revision-action",
      pending: "Saving draft...",
      success: "Draft saved successfully.",
      action: () => apiFetch(`/api/admin/content-revisions/${revisionId}/values`, {
        method: "PUT",
        body: JSON.stringify({ key, value }),
      }),
      onSuccess: () => setCtx((c: any) => ({
        ...c,
        manifest: {
          ...c.manifest,
          content: { ...c.manifest.content, [key]: value },
        },
        revision: {
          ...c.revision,
          values_json: { ...c.revision.values_json, [key]: value },
        },
      })),
      error: (cause) => cause instanceof Error ? cause.message : "Draft could not be saved.",
    });
  };
  const publishContent = () => {
    if (!ctx.revision?.id || ctx.revision.status !== "draft") return;
    const revisionId = ctx.revision.id;
    void contentActions.run({
      key: "publish-content",
      conflictKey: "content-revision-action",
      pending: "Publishing content...",
      success: "Content published successfully.",
      action: () =>
        publishContentAndRefresh({
          publish: () =>
            apiFetch<any>(
              `/api/admin/content-revisions/${revisionId}/publish`,
              { method: "POST" },
            ),
          markPublished: (response) =>
            setCtx((current: any) =>
              current?.revision?.id === revisionId
                ? {
                    ...current,
                    revision: {
                      ...current.revision,
                      ...response.data,
                      status: "published",
                    },
                  }
                : current,
            ),
          createNextDraft: createContentDraft,
          loadEditorContext,
          applyEditorContext,
        }),
      error: (cause) =>
        cause instanceof ContentPublishedRefreshError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Content could not be published.",
    });
  };
  const reloadEditorContext = () => {
    void contentActions.run({
      key: "refresh-content-editor",
      conflictKey: "content-revision-action",
      pending: "Reloading content editor...",
      success: "Content editor reloaded.",
      action: refreshEditorContext,
      error: "Content editor could not be reloaded. Try again.",
    });
  };
  const publishingContent = contentActions.isPending("publish-content");
  const reloadingContent = contentActions.isPending("refresh-content-editor");
  const contentActionPending = contentActions.isConflictPending(
    "content-revision-action",
  );
  const renderSystem =
    systemPage && pageId === "__header"
      ? manifest.globals.header
      : systemPage
        ? manifest.globals.footer
        : null;
  const sectionNames = (renderSystem?.root || renderRoute?.schema.root || [])
    .filter((n: any) => n.meta?.sectionLabel)
    .map((n: any) => ({ id: n.id, label: n.meta.sectionLabel }));
  return (
    <>
      <Header
        title="Site Content"
        sub="Click content to change real values. Design remains locked to Studio."
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              style={{
                ...B,
                background: !previewMode ? "var(--primary)" : "var(--surface)",
                color: !previewMode ? "var(--primary-text)" : "var(--text)",
              }}
              onClick={() => setPreviewMode(false)}
            >
              Edit Content
            </button>
            <button
              style={{
                ...B,
                background: previewMode ? "var(--primary)" : "var(--surface)",
                color: previewMode ? "var(--primary-text)" : "var(--text)",
              }}
              onClick={() => {
                setPreviewMode(true);
                setSelected(null);
              }}
            >
              Preview
            </button>
            <span
              style={{
                fontSize: 12,
                color: ctx.isLive ? "var(--success)" : "var(--warning)",
                alignSelf: "center",
              }}
            >
              {ctx.isLive
                ? "Editing live layout content"
                : "Configuring a non-live layout safely"}
            </span>
            <button
              style={P}
              disabled={
                contentActionPending ||
                !ctx.revision ||
                ctx.revision.status !== "draft"
              }
              aria-busy={publishingContent}
              onClick={publishContent}
            >
              {publishingContent ? "Publishing..." : "Publish Content"}
            </button>
            {ctx.revision?.status === "published" && (
              <button
                style={B}
                disabled={contentActionPending}
                aria-busy={reloadingContent}
                onClick={reloadEditorContext}
              >
                {reloadingContent ? "Reloading..." : "Reload Editor"}
              </button>
            )}
          </div>
        }
      />
      <div
        style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}
      >
        {pages.map((p: any) => (
          <button
            key={p.id}
            style={{
              ...B,
              whiteSpace: "nowrap",
              background: pageId === p.id ? "var(--primary)" : "var(--surface)",
              color: pageId === p.id ? "var(--primary-text)" : "var(--text)",
            }}
            onClick={() => {
              setPageId(p.id);
              setSelected(null);
            }}
          >
            {p.name}
          </button>
        ))}
      </div>
      {!systemPage && renderRoute?.pageType === "collection_detail" && renderRoute.collectionName && (
        <Box style={{ padding: 10, marginBottom: 10, display: "flex", gap: 10, alignItems: "center" }}>
          <strong style={{ fontSize: 11 }}>Detail preview</strong>
          <select
            aria-label="Detail preview item"
            style={{ ...I, maxWidth: 420 }}
            value={fieldContext ? String((fieldContext as any).slug ?? (fieldContext as any).id ?? "") : ""}
            onChange={(event) => setDetailItemKey(event.target.value)}
          >
            {detailItems.length === 0 && <option value="">No published {renderRoute.collectionName} items</option>}
            {detailItems.map((item: any) => {
              const value = String(item.slug ?? item.id ?? "");
              return <option key={String(item.id ?? value)} value={value}>{String(item.title ?? item.name ?? item.company ?? value)}</option>;
            })}
          </select>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Uses the same collection-detail field context as Public Web.</span>
        </Box>
      )}
      {sectionNames.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {sectionNames.map((s: any) => (
            <button
              key={s.id}
              style={{ ...B, fontSize: 11 }}
              onClick={() =>
                document
                  .querySelector(`[data-runtime-node-id="${s.id}"]`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            selected && !previewMode ? "minmax(0,1fr) 320px" : "1fr",
          gap: 12,
          alignItems: "start",
        }}
      >
        <Box
          style={{
            overflow: "auto",
            maxHeight: "calc(100vh - 210px)",
            background: "var(--workspace)",
          }}
        >
          {systemPage && renderSystem ? (
            <RuntimeSingle
              schema={renderSystem}
              manifest={manifest}
              editable={!previewMode}
              selected={selected?.node.id || null}
              onSelect={(node: any, keys: string[]) =>
                setSelected({ node, keys })
              }
              onDouble={(node: any, keys: string[]) =>
                quickEdit(node, keys, manifest, saveValue)
              }
            />
          ) : renderRoute ? (
            <RuntimeSitePreview
              manifest={previewMode ? manifest : { ...manifest, globals: {} }}
              route={renderRoute}
              mode="desktop"
              fieldContext={fieldContext}
              editable={!previewMode}
              selectedNodeId={selected?.node.id || null}
              onEditableClick={(node, keys) => setSelected({ node, keys })}
              onEditableDoubleClick={(node, keys) =>
                quickEdit(node, keys, manifest, saveValue)
              }
              onNavigate={
                previewMode
                  ? (href) => {
                      const i = previewRouteIndex(manifest, href);
                      if (i >= 0) {
                        setPageId(manifest.routes[i].pageId);
                        setSelected(null);
                      }
                    }
                  : undefined
              }
            />
          ) : null}
        </Box>
        {selected && !previewMode && (
          <ContentInspector
            node={selected.node}
            keys={selected.keys}
            manifest={manifest}
            isSaving={(key) => contentActions.isPending(`save-content-${key}`)}
            actionPending={contentActionPending}
            onSave={saveValue}
            onNavigate={onNavigate}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)" }}>
        Required missing: {ctx.compatibility?.missingRequired?.length || 0} ·
        Optional missing: {ctx.compatibility?.missingOptional?.length || 0} ·
        Unused stored keys: {ctx.compatibility?.unusedKeys?.length || 0}
      </div>
      {ctx.compatibility?.missingRequired?.length ||
      ctx.compatibility?.unusedKeys?.length ? (
        <Box style={{ padding: 12, marginTop: 8, fontSize: 11 }}>
          <strong>Content Compatibility</strong>
          {ctx.compatibility?.missingRequired?.length > 0 && (
            <div style={{ marginTop: 6, color: "var(--danger)" }}>
              Missing required:{" "}
              {ctx.compatibility.missingRequired
                .map((x: any) => `${x.label} (${x.key})`)
                .join(", ")}
            </div>
          )}
          {ctx.compatibility?.unusedKeys?.length > 0 && (
            <div style={{ marginTop: 6, color: "var(--text-muted)" }}>
              Stored but unused by this layout:{" "}
              {ctx.compatibility.unusedKeys.join(", ")}
            </div>
          )}
        </Box>
      ) : null}
      <ActionFeedback
        feedback={contentActions.feedback}
        onDismiss={contentActions.dismiss}
      />
    </>
  );
}
function RuntimeSingle({
  schema,
  manifest,
  editable,
  selected,
  onSelect,
  onDouble,
}: {
  schema: any;
  manifest: RuntimeManifest;
  editable: boolean;
  selected: string | null;
  onSelect: any;
  onDouble: any;
}) {
  const fake: RuntimeRoute = {
    path: "/",
    pageId: schema.pageId,
    slug: "global",
    name: "Global",
    pageType: "system",
    schema,
  };
  return (
    <RuntimeSitePreview
      manifest={{ ...manifest, globals: {} }}
      route={fake}
      mode="desktop"
      editable={editable}
      selectedNodeId={selected}
      onEditableClick={onSelect}
      onEditableDoubleClick={onDouble}
    />
  );
}
function contentBindings(node: StudioNode) {
  return Object.entries(node.bindings || {}).filter(
    ([, b]) =>
      b.type === "content" || b.type === "setting" || b.type === "collection",
  ) as [string, Binding][];
}
function quickEdit(
  node: StudioNode,
  keys: string[],
  manifest: RuntimeManifest,
  save: (k: string, v: unknown) => void,
) {
  const pair =
    contentBindings(node).find(([p]) => keys.includes(p)) ||
    contentBindings(node)[0];
  if (!pair) return;
  const b: any = pair[1];
  if (
    b.type !== "content" ||
    ["media", "boolean", "json", "button"].includes(b.contentType || "text")
  )
    return;
  const old = manifest.content[b.key] ?? b.sample ?? b.fallback ?? "";
  const v = prompt(b.label || b.key, String(old ?? ""));
  if (v !== null) save(b.key, b.contentType === "number" ? Number(v) : v);
}
function collectionScreen(name: string): Screen | null {
  if (name === "projects") return "projects";
  if (name === "notes") return "notes";
  if (name === "experience") return "experience";
  if (name === "apps") return "apps";
  return null;
}
function ContentInspector({
  node,
  keys,
  manifest,
  isSaving,
  actionPending,
  onSave,
  onNavigate,
  onClose,
}: {
  node: StudioNode;
  keys: string[];
  manifest: RuntimeManifest;
  isSaving: (key: string) => boolean;
  actionPending: boolean;
  onSave: (key: string, value: unknown) => void;
  onNavigate: (screen: Screen) => void;
  onClose: () => void;
}) {
  const pairs = contentBindings(node).filter(
    ([prop]) => keys.length === 0 || keys.includes(prop),
  );
  return (
    <Box style={{ position: "sticky", top: 0, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>Content Inspector</strong>
        <button style={{ ...B, padding: "2px 7px" }} onClick={onClose}>
          ×
        </button>
      </div>
      <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {node.meta?.adminLabel || node.meta?.label || node.type}
      </p>
      {pairs.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
          This element has no Admin-editable content. Change its binding source
          in Studio.
        </p>
      ) : (
        pairs.map(([prop, b]) => {
          if (b.type === "setting")
            return (
              <div
                key={prop}
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  Site setting · <code>{b.key}</code>
                </div>
                <button
                  style={{ ...B, marginTop: 8, width: "100%" }}
                  onClick={() => onNavigate("settings")}
                >
                  Open Settings
                </button>
              </div>
            );
          if (b.type === "collection") {
            const target = collectionScreen(b.collection);
            return (
              <div
                key={prop}
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid var(--border)",
                  fontSize: 12,
                }}
              >
                <strong>Collection: {pretty(b.collection)}</strong>
                <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
                  Filter:{" "}
                  {b.filters?.length ? JSON.stringify(b.filters) : "None"} ·
                  Limit: {b.limit ?? "All"}
                </div>
                {target && (
                  <button
                    style={{ ...P, marginTop: 8, width: "100%" }}
                    onClick={() => onNavigate(target)}
                  >
                    Manage {pretty(b.collection)}
                  </button>
                )}
              </div>
            );
          }
          const cb = b as ContentBinding;
          const val =
            manifest.content[cb.key] ?? cb.sample ?? cb.fallback ?? "";
          return (
            <EditValue
              key={prop}
              binding={cb}
              property={prop}
              value={val}
              manifest={manifest}
              saving={isSaving(cb.key)}
              disabled={actionPending}
              onSave={(v) => onSave(cb.key, v)}
            />
          );
        })
      )}
    </Box>
  );
}
function EditValue({
  binding,
  property,
  value,
  manifest,
  saving,
  disabled,
  onSave,
}: {
  binding: ContentBinding;
  property: string;
  value: any;
  manifest: RuntimeManifest;
  saving: boolean;
  disabled: boolean;
  onSave: (v: unknown) => void;
}) {
  const [v, setV] = React.useState<any>(value);
  const [jsonText, setJsonText] = React.useState("");
  const [jsonErr, setJsonErr] = React.useState("");
  React.useEffect(() => {
    setV(value);
    setJsonText(
      typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2),
    );
    setJsonErr("");
  }, [value]);
  const type = binding.contentType || "text";
  const saveJson = () => {
    try {
      const parsed = JSON.parse(jsonText || "{}");
      setJsonErr("");
      onSave(parsed);
    } catch {
      setJsonErr("Enter valid JSON before saving.");
    }
  };
  return (
    <div style={{ padding: "10px 0", borderTop: "1px solid var(--border)" }}>
      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {binding.label || binding.key} · {property}
      </label>
      {type === "media" ? (
        <MediaPicker
          value={String(v ?? "")}
          media={manifest.media}
          onChange={setV}
        />
      ) : type === "boolean" ? (
        <label style={{ display: "flex", gap: 8, marginTop: 7 }}>
          <input
            type="checkbox"
            checked={!!v}
            onChange={(e) => setV(e.target.checked)}
          />{" "}
          Enabled
        </label>
      ) : type === "richtext" ? (
        <textarea
          rows={6}
          style={{ ...I, marginTop: 6 }}
          value={String(v ?? "")}
          onChange={(e) => setV(e.target.value)}
        />
      ) : type === "button" ? (
        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          <input
            style={I}
            value={String(v?.label ?? v?.text ?? "")}
            onChange={(e) =>
              setV({
                ...(v && typeof v === "object" ? v : {}),
                label: e.target.value,
              })
            }
            placeholder="Button label"
          />
          <input
            style={I}
            value={String(v?.href ?? v?.url ?? "")}
            onChange={(e) =>
              setV({
                ...(v && typeof v === "object" ? v : {}),
                href: e.target.value,
              })
            }
            placeholder="/destination or https://…"
          />
        </div>
      ) : type === "json" ? (
        <>
          <textarea
            rows={8}
            style={{ ...I, marginTop: 6, fontFamily: "ui-monospace,monospace" }}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          {jsonErr && (
            <div style={{ color: "var(--danger)", fontSize: 10, marginTop: 4 }}>
              {jsonErr}
            </div>
          )}
        </>
      ) : (
        <input
          type={type === "number" ? "number" : type === "url" ? "url" : "text"}
          style={{ ...I, marginTop: 6 }}
          value={String(v ?? "")}
          onChange={(e) =>
            setV(type === "number" ? Number(e.target.value) : e.target.value)
          }
        />
      )}
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
        <code>{binding.key}</code>
        {binding.required ? " · Required" : ""}
      </div>
      <button
        style={{ ...P, marginTop: 8, width: "100%" }}
        disabled={saving || disabled}
        aria-busy={saving}
        onClick={() => (type === "json" ? saveJson() : onSave(v))}
      >
        {saving ? "Saving..." : "Save Draft"}
      </button>
    </div>
  );
}
function MediaPicker({
  value,
  media,
  onChange,
}: {
  value: string;
  media: RuntimeManifest["media"];
  onChange: (v: string) => void;
}) {
  const [rows, setRows] = React.useState<any[]>([]);
  React.useEffect(() => {
    apiFetch<any>("/api/admin/media")
      .then((r) =>
        setRows(
          (r.data || []).filter((x: any) =>
            String(x.mime_type || "").startsWith("image/"),
          ),
        ),
      )
      .catch(() => {});
  }, []);
  const preview =
    media[value]?.url ||
    rows.find((r) => r.id === value)?.public_url ||
    (/^https?:|^data:/.test(value) ? value : "");
  return (
    <div style={{ marginTop: 6 }}>
      {preview && (
        <img
          src={preview}
          alt="Selected media"
          style={{
            width: "100%",
            height: 120,
            objectFit: "cover",
            borderRadius: 6,
            marginBottom: 6,
          }}
        />
      )}
      <select
        style={I}
        value={rows.some((r) => r.id === value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose image…</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.filename}
          </option>
        ))}
      </select>
      <input
        style={{ ...I, marginTop: 6 }}
        value={rows.some((r) => r.id === value) ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste an external media URL"
      />
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
        Library selections are stored by stable media ID; external URLs remain
        URLs.
      </div>
    </div>
  );
}

function Releases() {
  const [rows, setRows] = React.useState<any[]>([]),
    [cards, setCards] = React.useState<any[]>([]),
    [preview, setPreview] = React.useState<any | null>(null),
    [err, setErr] = React.useState("");
  const load = (isCurrent: () => boolean = () => true) =>
    Promise.all([
      apiFetch<any>("/api/admin/releases"),
      apiFetch<any>("/api/admin/layouts"),
    ])
      .then(([a, b]) => {
        if (isCurrent()) {
          setRows(a.data || []);
          setCards(b.data || []);
        }
      })
      .catch((e) => {
        if (isCurrent()) setErr(e.message);
      });
  React.useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, []);
  const configuredCard = cards.find((c) => c.isConfiguring) || cards.find((c) => c.isLive);
  const configuredVersion = configuredCard
    ? (configuredCard.versions || []).find((version: any) => version.isConfiguring)
      || (configuredCard.versions || []).find((version: any) => version.isLive)
      || configuredCard.latestPublishedVersion
    : null;
  const create = async () => {
    if (!configuredVersion) return;
    try {
      await apiFetch("/api/admin/releases", {
        method: "POST",
        body: JSON.stringify({
          layout_version_id: configuredVersion.id,
        }),
      });
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const open = async (id: string) => {
    try {
      const r = await apiFetch<any>(`/api/admin/releases/${id}/preview`, {
        method: "POST",
      });
      setPreview(r.data);
    } catch (e: any) {
      setErr(e.message);
      if (e.payload?.data) setPreview(e.payload.data);
    }
  };
  return (
    <>
      <Header
        title="Releases"
        sub="Immutable layout + content + settings snapshots"
        action={
          <button style={P} disabled={!configuredVersion} onClick={create}>
            Create Candidate
          </button>
        }
      />
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      <div style={{ display: "grid", gap: 9 }}>
        {rows.map((r) => (
          <Box
            key={r.id}
            style={{
              padding: 14,
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <strong>Release #{r.release_number}</strong>
            <Badge
              text={r.status.toUpperCase()}
              color={
                r.status === "active"
                  ? "var(--success)"
                  : r.status === "draft"
                    ? "var(--warning)"
                    : "var(--text-muted)"
              }
            />
            <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>
              Layout v{r.layout_versions?.version_number} · Content r
              {r.content_revisions?.revision_number}
            </span>
            <button style={B} onClick={() => open(r.id)}>
              Preview
            </button>
            {r.status !== "active" && (
              <button
                style={P}
                onClick={async () => {
                  await apiFetch(
                    `/api/admin/releases/${r.id}/${r.status === "superseded" ? "rollback" : "activate"}`,
                    { method: "POST" },
                  );
                  load();
                }}
              >
                {r.status === "superseded" ? "Rollback" : "Activate"}
              </button>
            )}
          </Box>
        ))}
      </div>
      {preview?.manifest && (
        <ReleasePreview payload={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}

function ReleasePreview({
  payload,
  onClose,
}: {
  payload: any;
  onClose: () => void;
}) {
  const manifest = payload.manifest as RuntimeManifest;
  const [route, setRoute] = React.useState(0),
    [mode, setMode] = React.useState<"desktop" | "tablet" | "mobile">(
      "desktop",
    );
  const current = manifest.routes[route] || manifest.routes[0];
  return (
    <Modal
      wide
      title={`Release #${payload.release.release_number} Preview · real content`}
      onClose={onClose}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: payload.validation.valid
              ? "var(--success)"
              : "var(--danger)",
            marginRight: 8,
          }}
        >
          {payload.validation.valid
            ? "Ready to activate"
            : `${payload.validation.errors.length} blocking errors`}
        </span>
        {manifest.routes.map((r, i) => (
          <button
            key={r.pageId}
            style={{
              ...B,
              background: i === route ? "var(--primary)" : "var(--surface)",
              color: i === route ? "var(--primary-text)" : "var(--text)",
            }}
            onClick={() => setRoute(i)}
          >
            {r.name}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {(["desktop", "tablet", "mobile"] as const).map((x) => (
          <button
            key={x}
            style={{
              ...B,
              background: x === mode ? "var(--primary)" : "var(--surface)",
            }}
            onClick={() => setMode(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <div
        style={{
          height: "70vh",
          overflow: "auto",
          background: "var(--workspace)",
        }}
      >
        <div
          style={{
            width: mode === "desktop" ? "100%" : mode === "tablet" ? 768 : 375,
            maxWidth: "100%",
            margin: "0 auto",
          }}
        >
          <RuntimeSitePreview
            manifest={manifest}
            route={current}
            mode={mode}
            onNavigate={(href) => {
              const i = previewRouteIndex(manifest, href);
              if (i >= 0) setRoute(i);
            }}
          />
        </div>
      </div>
    </Modal>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      style={{
        padding: "4px 7px",
        borderRadius: 999,
        fontSize: 9,
        fontWeight: 800,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        color,
      }}
    >
      {text}
    </span>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,.65)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: wide ? "min(1500px,96vw)" : "min(760px,94vw)",
          maxHeight: "94vh",
          overflow: "auto",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          color: "var(--text)",
          boxShadow: "0 30px 80px var(--shadow)",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            padding: "13px 16px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <strong>{title}</strong>
          <button style={B} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </div>
  );
}
function pretty(x: string) {
  return x.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function MediaManager() {
  type MediaTab = "all" | "image" | "video" | "document";
  const [rows, setRows] = React.useState<any[]>([]);
  const [cleanupJobs, setCleanupJobs] = React.useState<any[]>([]);
  const [tab, setTab] = React.useState<MediaTab>("all");
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<any | null>(null);
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const mediaActions = useMutationActions();

  const load = React.useCallback(async (isCurrent: () => boolean = () => true) => {
    setLoading(true);
    const [mediaResponse, cleanupResponse] = await Promise.all([
      apiFetch<any>("/api/admin/media"),
      apiFetch<any>("/api/admin/media-cleanup-jobs").catch(() => ({ data: [] })),
    ]);
    if (isCurrent()) {
      setRows(mediaResponse.data || []);
      setCleanupJobs((cleanupResponse.data || []).filter((job: any) => job.status !== "complete"));
      setErr("");
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let current = true;
    void load(() => current).catch((cause) => { if (current) { setErr(cause.message); setLoading(false); } });
    return () => { current = false; };
  }, [load]);

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.currentTarget;
    void mediaActions.run({
      key: "media-upload",
      conflictKey: "media-upload",
      pending: "Uploading media...",
      success: (result: any) => result.refreshed ? "Media uploaded successfully." : "Media uploaded successfully, but the library could not refresh.",
      action: async () => {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        return uploadMediaAndRefresh({
          upload: () => apiFetch("/api/admin/media/upload", { method: "POST", body: JSON.stringify({ filename: file.name, mime_type: file.type || "application/octet-stream", dataBase64: data }) }),
          refresh: () => load(),
          preserveCreated: (created) => setRows((current) => [created, ...current.filter((record) => record.id !== created.id)]),
        });
      },
      error: "Media could not be uploaded. Check the file type and size, then try again.",
    }).finally(() => { input.value = ""; });
  };

  const removeMedia = (record: any) => {
    if (!confirm("Delete this media file? Deletion is blocked when any current authoring data or immutable release still references it.")) return;
    void mediaActions.run({
      key: `delete-media-${record.id}`,
      conflictKey: `media-record-${record.id}`,
      pending: "Deleting media...",
      success: (result: any) => result.refreshed ? "Media database record deleted. Storage cleanup was also requested." : "Media database record deleted, but the library could not refresh.",
      action: () => deleteMediaAndRefresh({
        id: record.id,
        remove: () => apiFetch(`/api/admin/media/${record.id}`, { method: "DELETE" }),
        refresh: () => load(),
        preserveDeleted: (id) => setRows((current) => current.filter((item) => item.id !== id)),
      }),
      error: "Media could not be deleted. It may still be referenced by content, a layout, or a release.",
    });
  };

  const saveMetadata = () => {
    if (!editing) return;
    void mediaActions.run({
      key: `edit-media-${editing.id}`,
      conflictKey: `media-record-${editing.id}`,
      pending: "Saving media metadata...",
      success: "Media metadata updated.",
      action: () => apiFetch(`/api/admin/media/${editing.id}`, { method: "PATCH", body: JSON.stringify({ filename: editing.filename, alt_text: editing.alt_text || "" }) }),
      onSuccess: async () => { setEditing(null); await load(); },
      error: "Media metadata could not be updated.",
    });
  };

  const retryCleanup = (job: any) => {
    void mediaActions.run({
      key: `cleanup-${job.id}`,
      conflictKey: `cleanup-${job.id}`,
      pending: "Retrying storage cleanup...",
      success: "Storage cleanup completed.",
      action: () => apiFetch(`/api/admin/media-cleanup-jobs/${job.id}/retry`, { method: "POST" }),
      onSuccess: async () => { await load(); },
      error: "Storage cleanup is still pending. The deleted database record remains safe; retry later.",
    });
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const tabMatch = tab === "all" || String(row.kind || "").toLowerCase() === tab;
    const searchMatch = !normalizedSearch || `${row.filename || ""} ${row.alt_text || ""} ${row.mime_type || ""}`.toLowerCase().includes(normalizedSearch);
    return tabMatch && searchMatch;
  });
  const uploading = mediaActions.isPending("media-upload");
  const tabs: Array<[MediaTab, string]> = [["all", "All"], ["image", "Images"], ["video", "Videos"], ["document", "Documents"]];

  return <>
    <Header title="Media" sub="Reusable CMS assets · Images, videos and documents · validated upload limit 8 MB." action={<label aria-busy={uploading} style={{ ...P, display: "inline-block", opacity: uploading ? .65 : 1, pointerEvents: uploading ? "none" : "auto" }}>{uploading ? "Uploading..." : "Upload Media"}<input hidden type="file" disabled={uploading} accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,application/pdf,text/plain,.txt" onChange={upload} /></label>} />
    {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16, padding: "4px 0 10px" }}>
      {tabs.map(([id, label]) => <button key={id} style={{ ...B, background: tab === id ? "var(--primary)" : "var(--surface)", color: tab === id ? "var(--primary-text)" : "var(--text)" }} onClick={() => setTab(id)}>{label} <small>({id === "all" ? rows.length : rows.filter((row) => row.kind === id).length})</small></button>)}
      <input aria-label="Search media" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search filename, alt text or MIME..." style={{ ...I, width: "min(360px,100%)", marginLeft: "auto" }} />
    </div>

    {loading && rows.length === 0 && <LoadingState label="Loading media library…" />}
    {!loading && filteredRows.length === 0 && <Box style={{ padding: 22, color: "var(--text-muted)", marginBottom: 14 }}>No media matches this view.</Box>}
    <div data-admin-media-grid style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12, alignItems: "start" }}>
      {filteredRows.map((r) => <Box key={r.id} style={{ overflow: "hidden" }}>
        {String(r.mime_type || "").startsWith("image/") && r.public_url ? <img loading="lazy" decoding="async" src={r.public_url} alt={r.alt_text || r.filename} style={{ width: "100%", height: 140, objectFit: "cover", display: "block", background: "var(--surface-alt)" }} /> : String(r.mime_type || "").startsWith("video/") && r.public_url ? <video preload="none" muted src={r.public_url} style={{ width: "100%", height: 140, objectFit: "cover", display: "block", background: "var(--surface-alt)" }} /> : <div style={{ height: 140, display: "grid", placeItems: "center", background: "var(--surface-alt)", fontSize: 36 }}>{r.kind === "document" ? "▤" : r.kind === "audio" ? "♪" : "▧"}</div>}
        <div style={{ padding: 12 }}><strong title={r.filename} style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.filename}</strong><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 5 }}>{r.mime_type} · {Math.round(Number(r.size || 0) / 1024)} KB</div>{r.alt_text && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.alt_text}</div>}<div style={{ display: "flex", gap: 6, marginTop: 9 }}><button style={B} disabled={mediaActions.isConflictPending(`media-record-${r.id}`)} onClick={() => setEditing({ ...r })}>Edit</button><button style={B} disabled={mediaActions.isConflictPending(`media-record-${r.id}`)} aria-busy={mediaActions.isPending(`delete-media-${r.id}`)} onClick={() => removeMedia(r)}>{mediaActions.isPending(`delete-media-${r.id}`) ? "Deleting..." : "Delete"}</button></div></div>
      </Box>)}
    </div>

    {cleanupJobs.length > 0 && <Box style={{ marginTop: 20, padding: 14 }}><strong>Pending storage cleanup</strong><p style={{ color: "var(--text-muted)", fontSize: 12 }}>These database deletes already committed safely. Only orphaned Storage bytes remain to be removed.</p><div style={{ display: "grid", gap: 7 }}>{cleanupJobs.map((job) => <div key={job.id} style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 8 }}><code style={{ flex: 1, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis" }}>{job.storage_path}</code><span style={{ fontSize: 10, color: "var(--warning)" }}>{job.attempts} attempts</span><button style={B} disabled={mediaActions.isConflictPending(`cleanup-${job.id}`)} onClick={() => retryCleanup(job)}>Retry</button></div>)}</div></Box>}

    {editing && <Modal title="Edit media metadata" onClose={() => setEditing(null)}><Field label="filename" type="text" value={editing.filename} onChange={(value) => setEditing({ ...editing, filename: value })} /><Field label="alt_text" type="textarea" value={editing.alt_text || ""} onChange={(value) => setEditing({ ...editing, alt_text: value })} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button style={B} onClick={() => setEditing(null)}>Cancel</button><button style={P} disabled={mediaActions.isConflictPending(`media-record-${editing.id}`)} onClick={saveMetadata}>Save</button></div></Modal>}
    <ActionFeedback feedback={mediaActions.feedback} onDismiss={mediaActions.dismiss} />
  </>;
}
