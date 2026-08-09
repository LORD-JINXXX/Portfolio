import React from "react";
import type {
  Binding,
  ContentBinding,
  RuntimeManifest,
  RuntimeRoute,
  StudioNode,
} from "@platform/contracts";
import { RuntimeSitePreview } from "@platform/runtime-renderer";
import {
  ActionFeedback,
  AppThemeProvider,
  AppThemeSelector,
  useMutationActions,
} from "@platform/ui";
import { AdminAuthContext, AuthGate } from "./AuthGate";
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
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        background: "var(--bg)",
        color: "var(--text)",
        fontFamily: "system-ui,sans-serif",
        overflow: "hidden",
      }}
    >
      <aside
        style={{
          width: 245,
          flexShrink: 0,
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
        style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "28px 34px" }}
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
function Dashboard() {
  const [d, setD] = React.useState<any>();
  React.useEffect(() => {
    apiFetch<any>("/api/admin/dashboard").then((r) => setD(r.data));
  }, []);
  return (
    <>
      <Header title="Dashboard" sub="Platform health and publishing overview" />
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
      ["thumbnail", "text"],
      ["gallery", "array"],
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
      ["cover_image", "text"],
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
      ["start_date", "text"],
      ["end_date", "text"],
      ["summary", "textarea"],
      ["responsibilities", "array"],
      ["technologies", "array"],
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
      ["icon", "text"],
      ["cover_image", "text"],
      ["category", "text"],
      ["tags", "array"],
      ["status", "text"],
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
    [err, setErr] = React.useState("");
  const structuredActions = useMutationActions();
  const managedMutationUx = ["projects", "notes", "experience", "apps"].includes(resource);
  const load = (isCurrent: () => boolean = () => true) =>
    apiFetch<any>(`/api/admin/${resource}`)
      .then((r) => {
        if (isCurrent()) setRows(r.data || []);
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
      onSuccess: load,
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
        {rows.length === 0 && (
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
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {cfg.fields.map(([k, t]: any) => (
              <Field
                key={k}
                label={k}
                type={t}
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
            <button style={B} onClick={() => setEditing(null)}>
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
function Field({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: string;
  value: any;
  onChange: (v: any) => void;
}) {
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
  return (
    <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
      {pretty(label)}
      {type === "textarea" ? (
        <textarea
          rows={4}
          style={{ ...I, marginTop: 4 }}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          style={{ ...I, marginTop: 4 }}
          type={type === "number" ? "number" : "text"}
          value={type === "array" ? (value || []).join(", ") : (value ?? "")}
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
    </label>
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
  const [rows, setRows] = React.useState<any[]>([]),
    [key, setKey] = React.useState("site_name"),
    [value, setValue] = React.useState(""),
    [err, setErr] = React.useState("");
  const load = (isCurrent: () => boolean = () => true) =>
    apiFetch<any>("/api/admin/settings").then((r) => {
      if (isCurrent()) setRows(r.data || []);
    });
  React.useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, []);
  return (
    <>
      <Header
        title="Site Settings"
        sub="Global operational and site-level values"
      />
      <Box style={{ padding: 14, display: "flex", gap: 8, marginBottom: 15 }}>
        <input
          style={I}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="setting.key"
        />
        <input
          style={I}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Value"
        />
        <button
          style={P}
          onClick={async () => {
            try {
              await apiFetch(`/api/admin/settings/${encodeURIComponent(key)}`, {
                method: "PUT",
                body: JSON.stringify({ value, type: "text" }),
              });
              setValue("");
              load();
            } catch (e: any) {
              setErr(e.message);
            }
          }}
        >
          Save
        </button>
      </Box>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <Box
            key={r.id}
            style={{
              padding: 12,
              display: "grid",
              gridTemplateColumns: "1fr 2fr auto",
              gap: 12,
            }}
          >
            <code>{r.key}</code>
            <span>{String(r.value_json ?? "")}</span>
            <button
              style={B}
              onClick={() => {
                setKey(r.key);
                setValue(String(r.value_json ?? ""));
              }}
            >
              Edit
            </button>
          </Box>
        ))}
      </div>
    </>
  );
}

function Layouts({ onConfigure }: { onConfigure: () => void }) {
  const [cards, setCards] = React.useState<any[]>([]),
    [preview, setPreview] = React.useState<RuntimeManifest | null>(null),
    [route, setRoute] = React.useState(0),
    [busy, setBusy] = React.useState("");
  const load = (isCurrent: () => boolean = () => true) =>
    apiFetch<any>("/api/admin/layouts").then((r) => {
      if (isCurrent()) setCards(r.data || []);
    });
  React.useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, []);
  const open = async (v: string) => {
    setBusy(v);
    try {
      const r = await apiFetch<any>(`/api/admin/layouts/versions/${v}/preview`);
      setPreview(r.data);
      setRoute(0);
    } finally {
      setBusy("");
    }
  };
  const configure = async (v: string) => {
    await apiFetch(`/api/admin/layouts/${v}/configure`, { method: "POST" });
    await load();
    onConfigure();
  };
  return (
    <>
      <Header
        title="Layout Library"
        sub="Published Studio designs. Preview sample data or choose one to configure without changing production."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
          gap: 16,
        }}
      >
        {cards.map((c) => (
          <Box key={c.layout.id} style={{ overflow: "hidden" }}>
            <div
              style={{
                height: 185,
                overflow: "hidden",
                background: "var(--workspace)",
                position: "relative",
              }}
            >
              {c.homePage ? (
                <div
                  style={{
                    transform: "scale(.25)",
                    transformOrigin: "top left",
                    width: "400%",
                    height: "400%",
                    pointerEvents: "none",
                  }}
                >
                  <Mini versionId={c.latestPublishedVersion.id} />
                </div>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--text-muted)",
                  }}
                >
                  No Home page
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  display: "flex",
                  gap: 5,
                }}
              >
                {c.isLive && <Badge text="LIVE" color="var(--success)" />}
                {c.isConfiguring && (
                  <Badge text="CONFIGURING" color="var(--warning)" />
                )}
              </div>
            </div>
            <div style={{ padding: 15 }}>
              <h3 style={{ margin: "0 0 5px" }}>{c.layout.name}</h3>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                v{c.latestPublishedVersion.version_number} · {c.pageCount} pages
                · {c.compatible ? "Compatible" : "Incompatible"}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button
                  style={B}
                  disabled={busy === c.latestPublishedVersion.id}
                  onClick={() => open(c.latestPublishedVersion.id)}
                >
                  Preview
                </button>
                <button
                  style={P}
                  onClick={() => configure(c.latestPublishedVersion.id)}
                >
                  Configure Content
                </button>
              </div>
            </div>
          </Box>
        ))}
      </div>
      {preview && (
        <FullPreview
          manifest={preview}
          routeIndex={route}
          setRoute={setRoute}
          onClose={() => setPreview(null)}
        />
      )}
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
  const clean = href.split("#")[0].split("?")[0] || "/";
  for (let i = 0; i < manifest.routes.length; i++) {
    const pattern = manifest.routes[i].path.replace(/:[A-Za-z0-9_]+/g, "[^/]+");
    if (new RegExp(`^${pattern}/?$`).test(clean)) return i;
  }
  return -1;
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
  const systemPage = pageId === "__header" || pageId === "__footer";
  const saveValue = (key: string, value: unknown) => {
    if (!ctx.revision?.id) return;
    const revisionId = ctx.revision.id;
    void contentActions.run({
      key: `save-content-${key}`,
      conflictKey: `save-content-${key}`,
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
  onSave,
  onNavigate,
  onClose,
}: {
  node: StudioNode;
  keys: string[];
  manifest: RuntimeManifest;
  isSaving: (key: string) => boolean;
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
  onSave,
}: {
  binding: ContentBinding;
  property: string;
  value: any;
  manifest: RuntimeManifest;
  saving: boolean;
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
        disabled={saving}
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
  const configured =
    cards.find((c) => c.isConfiguring) || cards.find((c) => c.isLive);
  const create = async () => {
    if (!configured) return;
    try {
      await apiFetch("/api/admin/releases", {
        method: "POST",
        body: JSON.stringify({
          layout_version_id: configured.latestPublishedVersion.id,
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
          <button style={P} disabled={!configured} onClick={create}>
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
  const [rows, setRows] = React.useState<any[]>([]),
    [err, setErr] = React.useState("");
  const mediaActions = useMutationActions();
  const load = (isCurrent: () => boolean = () => true) =>
    apiFetch<any>("/api/admin/media").then((r) => {
      if (isCurrent()) setRows(r.data || []);
    });
  React.useEffect(() => {
    let current = true;
    void load(() => current);
    return () => {
      current = false;
    };
  }, []);
  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const input = e.currentTarget;
    void mediaActions.run({
      key: "media-upload",
      conflictKey: "media-upload",
      pending: "Uploading media...",
      success: "Media uploaded successfully.",
      action: async () => {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        return apiFetch("/api/admin/media/upload", {
          method: "POST",
          body: JSON.stringify({
            filename: file.name,
            mime_type: file.type || "application/octet-stream",
            dataBase64: data,
          }),
        });
      },
      onSuccess: load,
      error: "Media could not be uploaded. Check the file type and size, then try again.",
    }).finally(() => { input.value = ""; });
  };
  const removeMedia = (record: any) => {
    if (!confirm("Delete this media file and its metadata? This is blocked by the API when a non-archived release still references the asset.")) return;
    void mediaActions.run({
      key: `delete-media-${record.id}`,
      conflictKey: `media-record-${record.id}`,
      pending: "Deleting media...",
      success: "Media deleted successfully.",
      action: () => apiFetch(`/api/admin/media/${record.id}`, { method: "DELETE" }),
      onSuccess: load,
      error: "Media could not be deleted. It may still be in use, or the request may need to be retried.",
    });
  };
  const uploading = mediaActions.isPending("media-upload");
  return (
    <>
      <Header
        title="Media"
        sub="Reusable public CMS assets. Current validated upload limit: 8 MB."
        action={
          <label aria-busy={uploading} style={{ ...P, display: "inline-block", opacity: uploading ? 0.65 : 1, pointerEvents: uploading ? "none" : "auto" }}>
            {uploading ? "Uploading..." : "Upload Media"}
            <input
              hidden
              type="file"
              disabled={uploading}
              accept="image/*,video/*,audio/*,.pdf,.txt"
              onChange={upload}
            />
          </label>
        }
      />
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
          gap: 12,
        }}
      >
        {rows.map((r) => (
          <Box key={r.id} style={{ overflow: "hidden" }}>
            {String(r.mime_type || "").startsWith("image/") && r.public_url ? (
              <img
                src={r.public_url}
                alt={r.alt_text || r.filename}
                style={{
                  width: "100%",
                  height: 140,
                  objectFit: "cover",
                  display: "block",
                }}
              />
            ) : (
              <div
                style={{
                  height: 140,
                  display: "grid",
                  placeItems: "center",
                  background: "var(--surface-alt)",
                  fontSize: 36,
                }}
              >
                ▧
              </div>
            )}
            <div style={{ padding: 12 }}>
              <strong style={{ fontSize: 13 }}>{r.filename}</strong>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginTop: 5,
                }}
              >
                {r.mime_type} · {Math.round(Number(r.size || 0) / 1024)} KB
              </div>
              <button
                style={{ ...B, marginTop: 9 }}
                disabled={mediaActions.isConflictPending(`media-record-${r.id}`)}
                aria-busy={mediaActions.isPending(`delete-media-${r.id}`)}
                onClick={() => removeMedia(r)}
              >
                {mediaActions.isPending(`delete-media-${r.id}`) ? "Deleting..." : "Delete media"}
              </button>
            </div>
          </Box>
        ))}
      </div>
      <ActionFeedback feedback={mediaActions.feedback} onDismiss={mediaActions.dismiss} />
    </>
  );
}
