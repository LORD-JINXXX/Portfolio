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
  DataRefreshStatus,
  DataStatePanel,
  AppThemeProvider,
  AppThemeSelector,
  useMutationActions,
} from "@platform/ui";
import { AdminAuthContext, AuthGate } from "./AuthGate";
import { deleteMediaAndRefresh, uploadMediaBatchAndRefresh } from "./media-upload";
import { uploadBlobResumable, type PreparedMediaUpload } from "./resumable-media-upload";
import { BlogBlocksEditor } from "./BlogBlocksEditor";
import { apiFetch } from "./api";
import {
  ADMIN_LIST_PAGE_SIZES,
  ADMIN_LIST_UI_CONFIG,
  adminPaginationItems,
  buildAdminListPath,
  createAdminListQueryState,
  hasActiveAdminListFilters,
  isAdminListAbortError,
  type AdminListMeta,
  type AdminListResource,
} from "./admin-list";
import {
  ContentPublishedRefreshError,
  publishContentAndRefresh,
} from "./content-publish";
import { ReleaseManager } from "./ReleaseManager";
import { AdminModal as Modal } from "./AdminModal";
import {
  confirmDiscardAdminChanges,
  confirmDiscardDraft,
  useDraftBaseline,
  useUnsavedAdminChanges,
} from "./unsaved-changes";

type Screen =
  | "dashboard"
  | "projects"
  | "blogs"
  | "notes"
  | "experience"
  | "apps"
  | "collections"
  | "content"
  | "media"
  | "layouts"
  | "releases"
  | "settings";
const nav: [Screen, string][] = [
  ["dashboard", "Dashboard"],
  ["projects", "Projects"],
  ["blogs", "Blogs"],
  ["notes", "Notes"],
  ["experience", "Experience"],
  ["apps", "AI Apps"],
  ["collections", "Collections"],
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
  const navigate = (next: Screen) => {
    if (next === screen || confirmDiscardAdminChanges()) setScreen(next);
  };
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
              onClick={() => navigate(id)}
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
          onClick={() => { if (confirmDiscardAdminChanges()) auth?.logout?.(); }}
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
        {screen === "projects" && <Crud key="projects" resource="projects" title="Projects" />}
        {screen === "blogs" && <Crud key="blogs" resource="blogs" title="Blogs" />}
        {screen === "notes" && <Crud key="notes" resource="notes" title="Notes" />}
        {screen === "experience" && (
          <Crud key="experience" resource="experience" title="Experience" />
        )}
        {screen === "apps" && <Crud key="apps" resource="apps" title="AI Applications" />}
        {screen === "collections" && <CustomCollections />}
        {screen === "media" && <MediaManager />}
        {screen === "settings" && <Settings />}
        {screen === "layouts" && (
          <Layouts onConfigure={() => navigate("content")} />
        )}{" "}
        {screen === "content" && <VisualContent onNavigate={navigate} />}
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
  return <DataStatePanel kind="loading" title={label} compact />;
}
function Dashboard() {
  const [d, setD] = React.useState<any>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<any>("/api/admin/dashboard");
      setD(response.data);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dashboard data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  return (
    <>
      <Header title="Dashboard" sub="Platform health and publishing overview" />
      {loading && !d && <LoadingState label="Loading dashboard data…" />}
      {!loading && error && !d && <DataStatePanel kind="error" title="Dashboard could not be loaded" message={error} onAction={() => void load()} />}
      {d && <>
        {error && <DataStatePanel kind="error" title="Dashboard refresh failed" message={error} actionLabel="Retry refresh" onAction={() => void load()} compact />}
        <div style={{ marginBottom: loading ? 12 : 0 }}><DataRefreshStatus active={loading} label="Refreshing dashboard…" /></div>
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
  blogs: {
    fields: [
      ["title", "text"],
      ["slug", "text"],
      ["subtitle", "text"],
      ["excerpt", "textarea"],
      ["cover_media_id", "media"],
      ["author_name", "text"],
      ["category", "text"],
      ["tags", "array"],
      ["content_blocks", "blog-blocks"],
      ["published_at", "datetime"],
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
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function Crud({ resource, title }: { resource: AdminListResource; title: string }) {
  const cfg = configs[resource];
  const listConfig = ADMIN_LIST_UI_CONFIG[resource];
  const initialListState = createAdminListQueryState(resource);
  const [rows, setRows] = React.useState<any[]>([]);
  const [editing, setEditing] = React.useState<any | null>(null);
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [meta, setMeta] = React.useState<AdminListMeta | null>(null);
  const [search, setSearch] = React.useState(initialListState.q);
  const [page, setPage] = React.useState(initialListState.page);
  const [pageSize, setPageSize] = React.useState(initialListState.pageSize);
  const [sort, setSort] = React.useState(initialListState.sort);
  const [direction, setDirection] = React.useState(initialListState.direction);
  const [filters, setFilters] = React.useState<Record<string, string>>(initialListState.filters);
  const debouncedSearch = useDebouncedValue(search, 300);
  const requestRef = React.useRef<AbortController | null>(null);
  const structuredActions = useMutationActions();
  const editingGuard = useDraftBaseline();
  const editingDirty = Boolean(editing) && editingGuard.isDirty(editing);
  useUnsavedAdminChanges(editingDirty);
  const managedMutationUx = ["projects", "blogs", "notes", "experience", "apps"].includes(resource);
  const openEditing = (next: any) => { editingGuard.begin(next); setEditing(next); };
  const closeEditing = () => {
    if (!editing) return;
    if (managedMutationUx && structuredActions.isConflictPending(`${resource}-record-${editing.id ? String(editing.id) : "new"}`)) return;
    if (!confirmDiscardDraft(editingDirty)) return;
    editingGuard.clear();
    setEditing(null);
  };

  const listPath = React.useMemo(() => buildAdminListPath(resource, {
    q: debouncedSearch,
    page,
    pageSize,
    sort,
    direction,
    filters,
  }), [resource, debouncedSearch, page, pageSize, sort, direction, filters]);

  const load = React.useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setErr("");
    try {
      const response = await apiFetch<{ data?: any[]; meta?: AdminListMeta }>(listPath, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const nextMeta = response.meta || null;
      if (nextMeta && nextMeta.totalPages > 0 && nextMeta.page > nextMeta.totalPages) {
        setPage(nextMeta.totalPages);
        return;
      }
      if (nextMeta && nextMeta.totalPages === 0 && nextMeta.page !== 1) setPage(1);
      setRows(response.data || []);
      setMeta(nextMeta);
    } catch (cause) {
      if (controller.signal.aborted || isAdminListAbortError(cause)) return;
      setErr(cause instanceof Error ? cause.message : `${title} could not be loaded.`);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [listPath, title]);

  React.useEffect(() => {
    if (search !== debouncedSearch) return;
    void load();
    return () => requestRef.current?.abort();
  }, [search, debouncedSearch, load]);

  const fresh = () =>
    Object.fromEntries(
      cfg.fields.map(([k, t]: any) => [
        k,
        t === "boolean"
          ? false
          : t === "number"
            ? 0
            : t === "array" || t === "blog-blocks"
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
      ).then(() => { editingGuard.clear(); setEditing(null); void load(); }).catch((cause) => setErr(cause.message));
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
      onSuccess: async () => { editingGuard.clear(); setEditing(null); await load(); },
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

  const queryPending = search !== debouncedSearch;
  const activeQuery = search.trim() !== "" || hasActiveAdminListFilters(filters);
  const updateFilter = (field: string, value: string) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };
  const clearQuery = () => {
    setSearch("");
    setFilters({});
    setPage(1);
  };
  const pagination = meta ? adminPaginationItems(meta.page, meta.totalPages) : [];
  const firstVisible = meta && meta.total > 0 ? (meta.page - 1) * meta.pageSize + 1 : 0;
  const lastVisible = meta && meta.total > 0 ? Math.min(meta.total, firstVisible + rows.length - 1) : 0;

  return (
    <>
      <Header
        title={title}
        sub={`Manage structured ${title.toLowerCase()} data`}
        action={
          <button style={P} onClick={() => openEditing(fresh())}>
            + New
          </button>
        }
      />
      <Box style={{ padding: 14, marginBottom: 14 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))",
            gap: 10,
            alignItems: "end",
          }}
          aria-busy={loading || queryPending}
        >
          <label style={{ fontSize: 11, color: "var(--text-muted)", gridColumn: "span 2" }}>
            Search
            <input
              type="search"
              style={{ ...I, marginTop: 4 }}
              value={search}
              placeholder={listConfig.searchPlaceholder}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
          </label>
          {listConfig.filters.map((filter) => (
            <label key={filter.field} style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {filter.label}
              {filter.kind === "select" ? (
                <select
                  style={{ ...I, marginTop: 4 }}
                  value={filters[filter.field] || ""}
                  onChange={(event) => updateFilter(filter.field, event.target.value)}
                >
                  {(filter.options || []).map((option) => (
                    <option key={option.value || "all"} value={option.value}>{option.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  style={{ ...I, marginTop: 4 }}
                  value={filters[filter.field] || ""}
                  placeholder={filter.placeholder}
                  onChange={(event) => updateFilter(filter.field, event.target.value)}
                />
              )}
            </label>
          ))}
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Sort by
            <select
              style={{ ...I, marginTop: 4 }}
              value={sort}
              onChange={(event) => { setSort(event.target.value); setPage(1); }}
            >
              {listConfig.sorts.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Direction
            <select
              style={{ ...I, marginTop: 4 }}
              value={direction}
              onChange={(event) => { setDirection(event.target.value === "desc" ? "desc" : "asc"); setPage(1); }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </label>
          <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Per page
            <select
              style={{ ...I, marginTop: 4 }}
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
            >
              {ADMIN_LIST_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {meta && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{meta.total} total {meta.total === 1 ? "record" : "records"}</span>}
            <DataRefreshStatus active={queryPending || (loading && rows.length > 0)} label={queryPending ? "Waiting for search input…" : "Updating results…"} />
          </div>
          {activeQuery && <button type="button" style={B} onClick={clearQuery}>Clear search & filters</button>}
        </div>
      </Box>
      <div style={{ display: "grid", gap: 9 }}>
        {err && rows.length > 0 && <DataStatePanel kind="error" title={`${title} refresh failed`} message={err} actionLabel="Retry" onAction={() => void load()} compact />}
        {(loading || queryPending) && rows.length === 0 && <LoadingState label={queryPending ? "Waiting for search input…" : `Loading ${title.toLowerCase()}…`} />}
        {!loading && err && rows.length === 0 && !queryPending && <DataStatePanel kind="error" title={`${title} could not be loaded`} message={err} actionLabel="Retry" onAction={() => void load()} />}
        {!loading && !err && rows.length === 0 && !queryPending && (
          <DataStatePanel
            kind="empty"
            title={activeQuery ? "No matching records" : `No ${title.toLowerCase()} yet`}
            message={activeQuery ? "No records match the current search or filters." : "Create the first record to start populating this section."}
            actionLabel={activeQuery ? "Clear search & filters" : undefined}
            onAction={activeQuery ? clearQuery : undefined}
          />
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
                  r.excerpt ||
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
            <button style={B} onClick={() => openEditing({ ...r })}>
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
      {meta && meta.total > 0 && (
        <Box style={{ padding: 12, marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            Showing {firstVisible}–{lastVisible} of {meta.total}
          </span>
          {meta.totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }} aria-label={`${title} pagination`}>
              <button type="button" style={B} disabled={!meta.hasPrevious} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Previous
              </button>
              {pagination.map((item) => item === "start-ellipsis" || item === "end-ellipsis" ? (
                <span key={item} aria-hidden="true" style={{ color: "var(--text-muted)", padding: "0 3px" }}>…</span>
              ) : (
                <button
                  type="button"
                  key={item}
                  style={item === meta.page ? P : B}
                  aria-current={item === meta.page ? "page" : undefined}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ))}
              <button type="button" style={B} disabled={!meta.hasNext} onClick={() => setPage((current) => current + 1)}>
                Next
              </button>
            </div>
          )}
        </Box>
      )}
      {editing && (
        <Modal
          title={editing.id ? `Edit ${title}` : `New ${title}`}
          onClose={closeEditing}
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
            <button type="button" style={B} onClick={closeEditing}>
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
    subtitle: "Optional subtitle shown below the blog title",
    excerpt: "Short blog summary used on cards and SEO",
    author_name: "e.g. Your Name",
    published_at: "Leave empty to use the first publish time",
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
  if (label === "display_order") return resource === "blogs" ? "Optional manual ordering. Blog lists normally sort by Published At newest first." : "Lower numbers appear first.";
  if (resource === "blogs" && label === "published_at") return "Optional. If left empty, the API records the first time the blog is published.";
  if (resource === "blogs" && label === "seo") return "Optional JSON such as { \"title\": \"Custom SEO title\", \"description\": \"Search description\" }.";
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
  if (type === "blog-blocks")
    return <BlogBlocksEditor value={Array.isArray(value) ? value : []} onChange={onChange} />;
  if (type === "datetime") {
    const localValue = typeof value === "string" && value ? new Date(value).toISOString().slice(0, 16) : "";
    return (
      <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
        {pretty(label)}
        <input
          type="datetime-local"
          style={{ ...I, marginTop: 4 }}
          value={localValue}
          onChange={(event) => onChange(event.target.value ? new Date(event.target.value).toISOString() : "")}
        />
        <span style={{ display: "block", marginTop: 4, fontSize: 10 }}>{fieldHelp(resource, label, type)}</span>
      </label>
    );
  }
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
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [reloadToken, setReloadToken] = React.useState(0);
  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    apiFetch<any>("/api/admin/media", { signal: controller.signal })
      .then((response) => {
        setRows((response.data || []).filter((row: any) => String(row.mime_type || "").startsWith("image/")));
      })
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Managed media could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadToken]);
  return { rows, loading, error, retry: () => setReloadToken((value) => value + 1) };
}

function ManagedMediaLoadStatus({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <span role="status" aria-live="polite" style={{ display: "block", marginTop: 4, fontSize: 10, color: "var(--text-muted)" }}>Loading managed media…</span>;
  if (!error) return null;
  return <span role="alert" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4, fontSize: 10, color: "var(--danger)" }}>{error}<button type="button" style={{ ...B, padding: "3px 6px", fontSize: 10 }} onClick={retry}>Retry</button></span>;
}

function MediaIdPicker({ value, onChange }: { value: string; onChange: (value: string | null) => void }) {
  const { rows, loading, error, retry } = useImageMedia();
  return (
    <>
      <select aria-label="Managed image" disabled={loading} style={{ ...I, marginTop: 4 }} value={value} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{loading ? "Loading managed media…" : "No managed media"}</option>
        {rows.map((row) => <option key={row.id} value={row.id}>{row.filename}</option>)}
      </select>
      <ManagedMediaLoadStatus loading={loading} error={error} retry={retry} />
    </>
  );
}

function MediaIdMultiPicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const { rows, loading, error, retry } = useImageMedia();
  return (
    <>
      <select aria-label="Managed image gallery" multiple disabled={loading} style={{ ...I, marginTop: 4, minHeight: 120 }} value={value} onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
        {rows.map((row) => <option key={row.id} value={row.id}>{row.filename}</option>)}
      </select>
      <ManagedMediaLoadStatus loading={loading} error={error} retry={retry} />
    </>
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
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const settingsActions = useMutationActions();
  const settingsGuard = useDraftBaseline();
  const settingsDraft = { key, valueType, value };
  const settingsDirty = editorOpen && settingsGuard.isDirty(settingsDraft);
  useUnsavedAdminChanges(settingsDirty);
  const closeSettingEditor = () => {
    if (settingsActions.isConflictPending("settings-revision-action")) return;
    if (!confirmDiscardDraft(settingsDirty)) return;
    settingsGuard.clear();
    setEditorOpen(false);
  };

  const load = React.useCallback(async (isCurrent: () => boolean = () => true) => {
    setLoading(true);
    try {
      const draftResponse = await apiFetch<any>("/api/admin/settings-revisions/draft", { method: "POST" });
      const response = await apiFetch<any>("/api/admin/settings");
      if (!isCurrent()) return;
      setRevision(draftResponse.data);
      setRows(response.data || []);
      setErr("");
    } catch (cause) {
      if (isCurrent()) setErr(cause instanceof Error ? cause.message : "Settings draft could not be loaded.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let current = true;
    void load(() => current);
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

  const openNewSetting = (presetKey = "site.name") => {
    const next = { key: presetKey, valueType: "text" as SettingValueType, value: "" };
    settingsGuard.begin(next);
    setKey(next.key);
    setValueType(next.valueType);
    setValue(next.value);
    setErr("");
    setEditorOpen(true);
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
      onSuccess: () => { settingsGuard.clear(); setEditorOpen(false); },
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
    let nextType: SettingValueType = "text";
    let nextValue = String(current ?? "");
    if (typeof current === "number") { nextType = "number"; nextValue = String(current); }
    else if (typeof current === "boolean") { nextType = "boolean"; nextValue = String(current); }
    else if (current && typeof current === "object") { nextType = "json"; nextValue = JSON.stringify(current, null, 2); }
    const next = { key: row.key, valueType: nextType, value: nextValue };
    settingsGuard.begin(next);
    setKey(next.key);
    setValueType(next.valueType);
    setValue(next.value);
    setErr("");
    setEditorOpen(true);
  };

  const pending = settingsActions.isConflictPending("settings-revision-action");
  const valuePlaceholder = valueType === "boolean" ? "true or false" : valueType === "number" ? "e.g. 10" : valueType === "json" ? '{ "theme": "dark" }' : "e.g. Mustafa's Portfolio";
  return (
    <>
      <Header
        title="Site Settings"
        sub="Edit a typed draft revision. Publishing settings does not activate the live site; Releases control production."
        action={<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={B} disabled={pending || !revision?.id} onClick={() => openNewSetting()}>+ Add Setting</button><button style={P} disabled={pending || !revision?.id} aria-busy={settingsActions.isPending("publish-settings")} onClick={publishSettings}>{settingsActions.isPending("publish-settings") ? "Publishing..." : `Publish Settings r${revision?.revision_number ?? ""}`}</button></div>}
      />
      <Box style={{ padding: 14, marginBottom: 15 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>Editing immutable workflow draft: r{revision?.revision_number ?? "…"}. Values become release-eligible only after Publish Settings.</div>
        <div style={{ padding: 10, border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface-alt)" }}>
          <strong style={{ fontSize: 12 }}>SEO & public-site presets</strong>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "5px 0 8px" }}>Choose a common key to open its centered editor. These values are frozen into a release only after Settings Publish + Release Activation.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[
              ["seo.site_url", "Public URL"],
              ["seo.site_name", "Site name"],
              ["seo.default_description", "Default description"],
              ["seo.title_template", "Title template"],
              ["seo.language", "Language"],
              ["seo.default_og_image", "Default social image"],
              ["site.owner_name", "Owner name"],
              ["site.social.github", "GitHub URL"],
              ["site.social.linkedin", "LinkedIn URL"],
            ].map(([presetKey, label]) => <button type="button" key={presetKey} style={{ ...B, padding: "5px 8px", fontSize: 10 }} disabled={pending} onClick={() => openNewSetting(presetKey)}>{label}</button>)}
          </div>
          <small style={{ display: "block", color: "var(--text-muted)", marginTop: 7 }}>Title template supports <code>%s</code> for the page/item title and <code>%site%</code> for the site name.</small>
        </div>
      </Box>
      {loading && rows.length === 0 && <LoadingState label="Loading site settings…" />}
      {loading && rows.length > 0 && <div style={{ marginBottom: 10 }}><DataRefreshStatus active label="Refreshing site settings…" /></div>}
      {!loading && err && !editorOpen && rows.length === 0 && <DataStatePanel kind="error" title="Site settings could not be loaded" message={err} onAction={() => void load()} />}
      {err && !editorOpen && rows.length > 0 && <DataStatePanel kind="error" title="Settings refresh failed" message={err} actionLabel="Retry" onAction={() => void load()} compact />}
      {!loading && !err && rows.length === 0 && <DataStatePanel kind="empty" title="No site settings yet" message="Add the first typed setting to this draft revision." />}
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map((r) => (
          <Box key={r.id} style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 12, alignItems: "center" }}>
            <code>{r.key}</code>
            <span style={{ overflowWrap: "anywhere" }}>{typeof r.value_json === "string" ? r.value_json : JSON.stringify(r.value_json)}</span>
            <button style={{ ...B, justifySelf: "start" }} disabled={pending} onClick={() => editExisting(r)}>Edit Draft</button>
          </Box>
        ))}
      </div>
      {editorOpen && <Modal title={rows.some((row) => row.key === key) ? `Edit setting · ${key}` : "Add setting"} onClose={closeSettingEditor}>
        <form onSubmit={saveSetting}>
          {err && <p role="alert" style={{ color: "var(--danger)", marginTop: 0 }}>{err}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: 12, alignItems: "start" }}>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Setting Key<input autoFocus aria-label="Setting key" style={{ ...I, marginTop: 4 }} value={key} onChange={(e) => setKey(e.target.value)} placeholder="site.name" /><span style={{ display: "block", fontSize: 10, marginTop: 4 }}>Letters, numbers, dots, underscores and hyphens only.</span></label>
            <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Value Type<select style={{ ...I, marginTop: 4 }} aria-label="Setting value type" value={valueType} onChange={(event) => setValueType(event.target.value as SettingValueType)}><option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="json">JSON</option></select><span style={{ display: "block", fontSize: 10, marginTop: 4 }}>Choose the type that matches the stored value.</span></label>
            <label style={{ fontSize: 11, color: "var(--text-muted)", gridColumn: "1 / -1" }}>Value{valueType === "json" ? <textarea aria-label="Setting value" rows={6} style={{ ...I, marginTop: 4 }} value={value} onChange={(e) => setValue(e.target.value)} placeholder={valuePlaceholder} /> : <input aria-label="Setting value" style={{ ...I, marginTop: 4 }} value={value} onChange={(e) => setValue(e.target.value)} placeholder={valuePlaceholder} />}<span style={{ display: "block", fontSize: 10, marginTop: 4 }}>{valueType === "boolean" ? "Accepted values: true or false." : valueType === "json" ? "Enter valid JSON." : "This is the value used by content/layout bindings."}</span></label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><button type="button" style={B} disabled={pending} onClick={closeSettingEditor}>Cancel</button><button type="submit" style={P} disabled={pending || !key.trim() || !revision?.id} aria-busy={settingsActions.isPending(`save-setting-${key.trim()}`)}>{settingsActions.isPending(`save-setting-${key.trim()}`) ? "Saving..." : "Save Draft"}</button></div>
        </form>
      </Modal>}
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
      {loading && cards.length > 0 && <div style={{ marginBottom: 10 }}><DataRefreshStatus active label="Refreshing published layouts…" /></div>}
      {!loading && loadError && cards.length === 0 && <DataStatePanel kind="error" title="Published layouts could not be loaded" message={loadError} onAction={() => void load()} />}
      {loadError && cards.length > 0 && <DataStatePanel kind="error" title="Layout refresh failed" message={loadError} actionLabel="Retry" onAction={() => void load()} compact />}
      {!loading && !loadError && cards.length === 0 && <DataStatePanel kind="empty" title="No published layouts yet" message="Publish a Studio layout before configuring it from Admin." />}
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
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    const controller = new AbortController();
    setError("");
    apiFetch<any>(`/api/admin/layouts/versions/${versionId}/preview`, { signal: controller.signal })
      .then((r) => setM(r.data))
      .catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setM(null);
        setError(cause instanceof Error ? cause.message : "Layout preview could not be loaded.");
      });
    return () => controller.abort();
  }, [versionId]);
  if (error) return <div role="status" style={{ padding: 10, fontSize: 10, color: "var(--danger)" }}>Preview unavailable: {error}</div>;
  if (!m || !m.routes[0]) return <div role="status" style={{ padding: 10, fontSize: 10, color: "var(--text-muted)" }}>Loading preview…</div>;
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
    [quickEditDraft, setQuickEditDraft] = React.useState<QuickContentEditDraft | null>(null),
    [err, setErr] = React.useState("");
  const contentActions = useMutationActions();
  const quickEditGuard = useDraftBaseline();
  const quickEditDirty = Boolean(quickEditDraft) && quickEditGuard.isDirty(quickEditDraft);
  useUnsavedAdminChanges(quickEditDirty);
  const openQuickEdit = React.useCallback((draft: QuickContentEditDraft) => {
    quickEditGuard.begin(draft);
    setQuickEditDraft(draft);
  }, [quickEditGuard]);
  const closeQuickEdit = () => {
    if (!quickEditDraft || contentActions.isPending(`save-content-${quickEditDraft.key}`)) return;
    if (!confirmDiscardDraft(quickEditDirty)) return;
    quickEditGuard.clear();
    setQuickEditDraft(null);
  };
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
                quickEdit(node, keys, manifest, openQuickEdit)
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
                quickEdit(node, keys, manifest, openQuickEdit)
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
      {quickEditDraft && (
        <Modal
          title={`Quick edit · ${quickEditDraft.label}`}
          width="min(640px,94vw)"
          onClose={closeQuickEdit}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const nextValue = quickEditDraft.contentType === "number" ? Number(quickEditDraft.value) : quickEditDraft.value;
              saveValue(quickEditDraft.key, nextValue);
              quickEditGuard.clear();
              setQuickEditDraft(null);
            }}
          >
            <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>
              {quickEditDraft.label}
              {quickEditDraft.multiline ? (
                <textarea autoFocus rows={7} style={{ ...I, marginTop: 6, resize: "vertical" }} value={quickEditDraft.value} onChange={(event) => setQuickEditDraft((current) => current ? { ...current, value: event.target.value } : current)} />
              ) : (
                <input autoFocus type={quickEditDraft.contentType === "number" ? "number" : "text"} style={{ ...I, marginTop: 6 }} value={quickEditDraft.value} onChange={(event) => setQuickEditDraft((current) => current ? { ...current, value: event.target.value } : current)} />
              )}
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button type="button" style={B} onClick={closeQuickEdit}>Cancel</button>
              <button type="submit" style={P}>Save Draft</button>
            </div>
          </form>
        </Modal>
      )}
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
type QuickContentEditDraft = {
  key: string;
  label: string;
  contentType: string;
  value: string;
  multiline: boolean;
};
function quickEdit(
  node: StudioNode,
  keys: string[],
  manifest: RuntimeManifest,
  open: (draft: QuickContentEditDraft) => void,
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
  open({
    key: b.key,
    label: b.label || b.key,
    contentType: b.contentType || "text",
    value: String(old ?? ""),
    multiline: b.contentType === "textarea" || String(old ?? "").includes("\n"),
  });
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
        <button type="button" aria-label="Close content inspector" title="Close inspector" style={{ ...B, padding: "2px 7px" }} onClick={onClose}>
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
            const repeatSource = b.source || "collection";
            const collectionName = b.collection || "";
            const target = repeatSource === "collection" && collectionName ? collectionScreen(collectionName) : null;
            return (
              <div
                key={prop}
                style={{
                  padding: "10px 0",
                  borderTop: "1px solid var(--border)",
                  fontSize: 12,
                }}
              >
                <strong>{repeatSource === "current-item-array" ? `Current Item Array: ${b.field || "unset"}` : `Collection: ${pretty(collectionName || "unset")}`}</strong>
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
                    Manage {pretty(collectionName)}
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
type CustomCollectionField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "date" | "array" | "json" | "media" | "url" | "select";
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  /** Optional nested schema. When present, an array is edited as repeatable structured items. */
  itemFields?: CustomCollectionField[];
  /** Field used as the collapsed item label in the structured-array editor. */
  itemLabelField?: string;
  /** Optional top-level data-integrity constraints. */
  unique?: boolean;
  relation?: { collection: string; field: string; requirePublished?: boolean; targetCoverage?: "none" | "warning" | "error" };
};
type CustomCollectionDefinition = {
  id?: string;
  key: string;
  label: string;
  description?: string | null;
  fields_json: CustomCollectionField[];
  display_order: number;
};

function CustomCollections() {
  const [definitions,setDefinitions]=React.useState<CustomCollectionDefinition[]>([]);
  const [selectedKey,setSelectedKey]=React.useState("");
  const [items,setItems]=React.useState<any[]>([]);
  const [editing,setEditing]=React.useState<any|null>(null);
  const [definitionDraft,setDefinitionDraft]=React.useState<CustomCollectionDefinition|null>(null);
  const [fieldsDraft,setFieldsDraft]=React.useState("[]");
  const [err,setErr]=React.useState("");
  const [loading,setLoading]=React.useState(true);
  const actions=useMutationActions();
  const itemGuard=useDraftBaseline();
  const definitionGuard=useDraftBaseline();
  const itemDirty=Boolean(editing)&&itemGuard.isDirty(editing);
  const definitionSnapshot=definitionDraft?{...definitionDraft,fieldsDraft}:null;
  const definitionDirty=Boolean(definitionSnapshot)&&definitionGuard.isDirty(definitionSnapshot);
  useUnsavedAdminChanges(itemDirty||definitionDirty);
  const selected=definitions.find((definition)=>definition.key===selectedKey)||null;
  const closeItem=()=>{
    if(!selected||actions.isConflictPending(`custom-collection-${selected.key}`))return;
    if(!confirmDiscardDraft(itemDirty))return;
    itemGuard.clear();setEditing(null);
  };
  const closeDefinition=()=>{
    if(actions.isConflictPending("custom-collection-definition"))return;
    if(!confirmDiscardDraft(definitionDirty))return;
    definitionGuard.clear();setDefinitionDraft(null);
  };
  const loadDefinitions=React.useCallback(async()=>{
    setLoading(true);
    try{
      const response=await apiFetch<any>("/api/admin/custom-collections");
      const next=(response.data||[]) as CustomCollectionDefinition[];
      setDefinitions(next);
      setSelectedKey((current)=>next.some((entry)=>entry.key===current)?current:(next.find((entry)=>entry.key==="technologies")?.key||next[0]?.key||""));
      setErr("");
    }catch(cause:any){setErr(cause.message||"Collections could not be loaded.")}
    finally{setLoading(false)}
  },[]);
  const loadItems=React.useCallback(async(key:string)=>{
    if(!key){setItems([]);return}
    try{const response=await apiFetch<any>(`/api/admin/custom-collections/${encodeURIComponent(key)}/items`);setItems(response.data||[]);setErr("")}
    catch(cause:any){setErr(cause.message||"Collection items could not be loaded.")}
  },[]);
  React.useEffect(()=>{void loadDefinitions()},[loadDefinitions]);
  React.useEffect(()=>{void loadItems(selectedKey);setEditing(null)},[selectedKey,loadItems]);
  const freshItem=()=>{
    const next:Record<string,unknown>={display_order:items.length,published:false};
    for(const field of selected?.fields_json||[]) next[field.key]=defaultCustomCollectionFieldValue(field);
    return next;
  };
  const openItem=(item?:any)=>{const next=item?{...item}:freshItem();itemGuard.begin(next);setErr("");setEditing(next)};
  const openDefinition=(definition?:CustomCollectionDefinition)=>{
    const draft:CustomCollectionDefinition=definition?{...definition,fields_json:[...(definition.fields_json||[])]}:{key:"",label:"",description:"",fields_json:[{key:"name",label:"Name",type:"text",required:true}],display_order:definitions.length};
    const nextFieldsDraft=JSON.stringify(draft.fields_json,null,2);
    definitionGuard.begin({...draft,fieldsDraft:nextFieldsDraft});
    setDefinitionDraft(draft);setFieldsDraft(nextFieldsDraft);setErr("");
  };
  const saveDefinition=()=>{
    if(!definitionDraft)return;
    let fields:CustomCollectionField[];
    try{const parsed=JSON.parse(fieldsDraft);if(!Array.isArray(parsed))throw new Error();fields=parsed}catch{setErr("Fields must be a valid JSON array.");return}
    const existing=Boolean(definitionDraft.id);
    void actions.run({key:`collection-definition-${definitionDraft.key||"new"}`,conflictKey:"custom-collection-definition",pending:"Saving collection definition...",success:"Collection definition saved.",action:()=>apiFetch(existing?`/api/admin/custom-collections/${encodeURIComponent(definitionDraft.key)}`:"/api/admin/custom-collections",{method:existing?"PATCH":"POST",body:JSON.stringify({...definitionDraft,fields_json:fields})}),onSuccess:async()=>{definitionGuard.clear();setDefinitionDraft(null);await loadDefinitions()},error:(cause:any)=>cause?.message||"Collection definition could not be saved."});
  };
  const saveItem=()=>{
    if(!selected||!editing)return;
    const isEdit=Boolean(editing.id),id=editing.id;
    void actions.run({key:`collection-item-${id||"new"}`,conflictKey:`custom-collection-${selected.key}`,pending:isEdit?"Saving item...":"Creating item...",success:isEdit?"Collection item updated.":"Collection item created.",action:()=>apiFetch(isEdit?`/api/admin/custom-collections/${encodeURIComponent(selected.key)}/items/${id}`:`/api/admin/custom-collections/${encodeURIComponent(selected.key)}/items`,{method:isEdit?"PATCH":"POST",body:JSON.stringify(editing)}),onSuccess:async()=>{itemGuard.clear();setEditing(null);await loadItems(selected.key)},error:(cause:any)=>cause?.message||"Collection item could not be saved."});
  };
  const removeItem=(item:any)=>{if(!selected||!confirm("Delete this collection item?"))return;void actions.run({key:`collection-item-delete-${item.id}`,conflictKey:`custom-collection-${selected.key}`,pending:"Deleting item...",success:"Collection item deleted.",action:()=>apiFetch(`/api/admin/custom-collections/${encodeURIComponent(selected.key)}/items/${item.id}`,{method:"DELETE"}),onSuccess:async()=>loadItems(selected.key),error:"Collection item could not be deleted."})};
  const removeDefinition=()=>{if(!selected||!confirm(`Delete the ${selected.label} collection and all of its items? Existing published releases remain immutable, but future release validation can fail until layouts stop referencing it.`))return;void actions.run({key:`collection-delete-${selected.key}`,conflictKey:"custom-collection-definition",pending:"Deleting collection...",success:"Collection deleted.",action:()=>apiFetch(`/api/admin/custom-collections/${encodeURIComponent(selected.key)}`,{method:"DELETE"}),onSuccess:async()=>{setSelectedKey("");await loadDefinitions()},error:"Collection could not be deleted."})};
  return <>
    <Header title="Collections" sub="Admin-managed structured data that Studio can bind, filter, animate, and repeat without hardcoding new database tables." action={<button style={P} onClick={()=>openDefinition()}>+ New Collection</button>}/>
    <ActionFeedback feedback={actions.feedback} onDismiss={actions.dismiss}/>
    {err&&<div style={{padding:12,border:"1px solid var(--danger)",borderRadius:8,color:"var(--danger)",marginBottom:16}}>{err}</div>}
    <div style={{display:"grid",gridTemplateColumns:"minmax(210px,280px) minmax(0,1fr)",gap:18,alignItems:"start"}}>
      <section style={{border:"1px solid var(--border)",borderRadius:10,background:"var(--surface)",padding:12,position:"sticky",top:16}}>
        <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:8}}>COLLECTIONS</div>
        {loading&&<div style={{color:"var(--text-muted)"}}>Loading…</div>}
        {!loading&&!definitions.length&&<div style={{color:"var(--text-muted)",fontSize:12}}>Apply the included database migration, then create your first collection.</div>}
        {definitions.map((definition)=><button key={definition.key} style={{...B,width:"100%",textAlign:"left",marginBottom:6,background:selectedKey===definition.key?"color-mix(in srgb,var(--primary) 16%,var(--surface))":"var(--surface)"}} onClick={()=>setSelectedKey(definition.key)}><strong>{definition.label}</strong><div style={{fontSize:10,color:"var(--text-muted)",marginTop:3}}>{definition.key}</div></button>)}
      </section>
      <section style={{minWidth:0}}>
        {selected?<>
          <div style={{display:"flex",gap:8,alignItems:"start",marginBottom:14,flexWrap:"wrap"}}><div style={{flex:1,minWidth:220}}><h2 style={{margin:"0 0 5px"}}>{selected.label}</h2><div style={{fontSize:12,color:"var(--text-muted)"}}>{selected.description||`Studio collection key: ${selected.key}`}</div></div><button style={B} onClick={()=>openDefinition(selected)}>Edit Schema</button><button style={{...B,color:"var(--danger)"}} onClick={removeDefinition}>Delete Collection</button><button style={P} onClick={()=>openItem()}>+ Add Item</button></div>
          <div style={{display:"grid",gap:8}}>{items.map((item)=><div key={item.id} style={{display:"flex",gap:10,alignItems:"center",border:"1px solid var(--border)",borderRadius:8,padding:12,background:"var(--surface)"}}><div style={{flex:1,minWidth:0}}><strong>{String(item.name||item.title||item.label||item.id)}</strong><div style={{fontSize:10,color:"var(--text-muted)",marginTop:4}}>{item.published?"Published":"Draft"} · order {item.display_order??0}{item.category?` · ${item.category}`:""}</div></div><button type="button" style={B} onClick={()=>openItem(item)}>Edit</button><button type="button" style={{...B,color:"var(--danger)"}} onClick={()=>removeItem(item)}>Delete</button></div>)}{!items.length&&<div style={{padding:28,textAlign:"center",border:"1px dashed var(--border)",borderRadius:10,color:"var(--text-muted)"}}>No items yet. Add published Admin content here; Studio Live Admin preview can refresh it immediately.</div>}</div>
        </>:<div style={{padding:30,border:"1px dashed var(--border)",borderRadius:10,color:"var(--text-muted)"}}>Select or create a collection.</div>}
      </section>
    </div>
    {selected&&editing&&<Modal title={editing.id?`Edit ${selected.label} item`:`Add ${selected.label} item`} width="min(980px,96vw)" onClose={closeItem}><form onSubmit={(event)=>{event.preventDefault();saveItem()}}>{err&&<p role="alert" style={{color:"var(--danger)",marginTop:0}}>{err}</p>}<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12}}>{selected.fields_json.map((field)=><CustomCollectionFormField key={field.key} field={field} value={editing[field.key]} onChange={(value)=>setEditing((current:any)=>({...current,[field.key]:value}))}/>)}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12,marginTop:12}}><label><span style={{fontSize:11,color:"var(--text-muted)"}}>Display order</span><input type="number" style={{...I,marginTop:5}} value={Number(editing.display_order||0)} onChange={(event)=>setEditing((current:any)=>({...current,display_order:Number(event.target.value)}))}/></label><label style={{display:"flex",alignItems:"center",gap:8,paddingTop:20}}><input type="checkbox" checked={Boolean(editing.published)} onChange={(event)=>setEditing((current:any)=>({...current,published:event.target.checked}))}/> Published</label></div><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}><button type="button" style={B} disabled={actions.isConflictPending(`custom-collection-${selected.key}`)} onClick={closeItem}>Cancel</button><button type="submit" style={P} disabled={actions.isConflictPending(`custom-collection-${selected.key}`)} aria-busy={actions.isConflictPending(`custom-collection-${selected.key}`)}>{editing.id?"Save Changes":"Add Item"}</button></div></form></Modal>}
    {definitionDraft&&<Modal title={definitionDraft.id?"Edit Collection":"New Collection"} width="min(760px,96vw)" onClose={closeDefinition}><form onSubmit={(event)=>{event.preventDefault();saveDefinition()}}>{err&&<p role="alert" style={{color:"var(--danger)",marginTop:0}}>{err}</p>}<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12}}><label><span style={{fontSize:11,color:"var(--text-muted)"}}>Key</span><input autoFocus style={{...I,marginTop:5}} disabled={Boolean(definitionDraft.id)} value={definitionDraft.key} placeholder="technologies" onChange={(event)=>setDefinitionDraft((current)=>current?{...current,key:event.target.value}:current)}/></label><label><span style={{fontSize:11,color:"var(--text-muted)"}}>Label</span><input style={{...I,marginTop:5}} value={definitionDraft.label} placeholder="Technologies" onChange={(event)=>setDefinitionDraft((current)=>current?{...current,label:event.target.value}:current)}/></label></div><label style={{display:"block",marginTop:12}}><span style={{fontSize:11,color:"var(--text-muted)"}}>Description</span><textarea style={{...I,marginTop:5,minHeight:70}} value={definitionDraft.description||""} onChange={(event)=>setDefinitionDraft((current)=>current?{...current,description:event.target.value}:current)}/></label><label style={{display:"block",marginTop:12}}><span style={{fontSize:11,color:"var(--text-muted)"}}>Fields JSON</span><textarea spellCheck={false} style={{...I,marginTop:5,minHeight:260,fontFamily:"ui-monospace,monospace"}} value={fieldsDraft} onChange={(event)=>setFieldsDraft(event.target.value)}/><div style={{fontSize:10,color:"var(--text-muted)",marginTop:4}}>Supported types: text, textarea, number, boolean, date, array, json, media, url, select. Arrays can optionally define <code>itemFields</code> and <code>itemLabelField</code> for repeatable structured items.</div></label><div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}><button type="button" style={B} disabled={actions.isConflictPending("custom-collection-definition")} onClick={closeDefinition}>Cancel</button><button type="submit" style={P} disabled={actions.isConflictPending("custom-collection-definition")} aria-busy={actions.isConflictPending("custom-collection-definition")}>Save Collection</button></div></form></Modal>}
  </>;
}

function defaultCustomCollectionFieldValue(field:CustomCollectionField):unknown{
  if(field.type==="boolean")return false;
  if(field.type==="number")return 0;
  if(field.type==="array")return [];
  if(field.type==="json")return {};
  return "";
}

let structuredArrayUiKey = 0;
function nextStructuredArrayUiKey() {
  structuredArrayUiKey += 1;
  return `structured-item-${structuredArrayUiKey}`;
}

function StructuredCollectionArrayField({field,value,onChange}:{field:CustomCollectionField;value:any;onChange:(value:any)=>void}){
  const items=Array.isArray(value)?value:[];
  const itemFields=field.itemFields||[];
  const [itemKeys,setItemKeys]=React.useState<string[]>(()=>items.map(()=>nextStructuredArrayUiKey()));
  const [expanded,setExpanded]=React.useState<Record<string,boolean>>({});
  const [pendingFocusKey,setPendingFocusKey]=React.useState<string|null>(null);
  const itemRefs=React.useRef(new Map<string,HTMLDivElement>());
  const labelKey=field.itemLabelField||itemFields.find((entry)=>entry.key==="name")?.key||itemFields[0]?.key||"";
  const secondaryField=itemFields.find((entry)=>entry.key!==labelKey&&entry.type==="select");

  React.useEffect(()=>{
    setItemKeys((current)=>{
      if(current.length===items.length)return current;
      if(current.length>items.length)return current.slice(0,items.length);
      return [...current,...Array.from({length:items.length-current.length},()=>nextStructuredArrayUiKey())];
    });
  },[items.length]);

  React.useEffect(()=>{
    if(!pendingFocusKey)return;
    const frame=requestAnimationFrame(()=>{
      const root=itemRefs.current.get(pendingFocusKey);
      const target=root?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])');
      (target||root)?.focus({preventScroll:true});
      setPendingFocusKey(null);
    });
    return()=>cancelAnimationFrame(frame);
  },[pendingFocusKey,expanded]);

  const addItem=()=>{
    const nextItem:Record<string,unknown>={};
    for(const itemField of itemFields)nextItem[itemField.key]=defaultCustomCollectionFieldValue(itemField);
    const key=nextStructuredArrayUiKey();
    onChange([...items,nextItem]);
    setItemKeys((current)=>[...current,key]);
    setExpanded((current)=>({...current,[key]:true}));
    setPendingFocusKey(key);
  };
  const updateItem=(index:number,key:string,nextValue:any)=>onChange(items.map((item:any,itemIndex:number)=>itemIndex===index?{...(item&&typeof item==="object"&&!Array.isArray(item)?item:{}),[key]:nextValue}:item));
  const removeItem=(index:number)=>{
    const key=itemKeys[index];
    onChange(items.filter((_:unknown,itemIndex:number)=>itemIndex!==index));
    setItemKeys((current)=>current.filter((_,itemIndex)=>itemIndex!==index));
    if(key)setExpanded((current)=>{const next={...current};delete next[key];return next});
  };
  const moveItem=(index:number,direction:-1|1)=>{
    const target=index+direction;
    if(target<0||target>=items.length)return;
    const next=[...items];
    [next[index],next[target]]=[next[target],next[index]];
    onChange(next);
    setItemKeys((current)=>{
      const nextKeys=[...current];
      [nextKeys[index],nextKeys[target]]=[nextKeys[target],nextKeys[index]];
      return nextKeys;
    });
  };
  return <div style={{gridColumn:"1 / -1",border:"1px solid var(--border)",borderRadius:10,padding:12,background:"color-mix(in srgb,var(--surface) 94%,var(--primary) 6%)"}}>
    <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"space-between",marginBottom:items.length?10:0}}>
      <div><div style={{fontSize:11,color:"var(--text-muted)"}}>{field.label}{field.required?" *":""}</div><div style={{fontSize:10,color:"var(--text-muted)",marginTop:3}}>{items.length} item{items.length===1?"":"s"} · array order is display order</div></div>
      <button type="button" style={P} aria-label={`Add ${field.label} item`} onClick={addItem}>+ Add Item</button>
    </div>
    {!items.length&&<div style={{padding:"14px 10px",border:"1px dashed var(--border)",borderRadius:8,color:"var(--text-muted)",fontSize:11}}>No items yet. Use “+ Add Item” to create the first entry.</div>}
    <div style={{display:"grid",gap:8}}>{items.map((item:any,index:number)=>{
      const uiKey=itemKeys[index]||`pending-${index}`;
      const open=Boolean(expanded[uiKey]);
      const rawLabel=labelKey&&item&&typeof item==="object"&&!Array.isArray(item)?item[labelKey]:"";
      const itemLabel=String(rawLabel||`${field.label} ${index+1}`);
      const secondaryValue=secondaryField&&item&&typeof item==="object"&&!Array.isArray(item)?item[secondaryField.key]:"";
      const secondaryLabel=secondaryField?.options?.find((option)=>option.value===secondaryValue)?.label||String(secondaryValue||"");
      const panelId=`${uiKey}-fields`;
      return <div key={uiKey} ref={(element)=>{if(element)itemRefs.current.set(uiKey,element);else itemRefs.current.delete(uiKey)}} data-structured-item-key={uiKey} style={{border:"1px solid var(--border)",borderRadius:8,background:"var(--surface)",overflow:"hidden"}}>
        <div style={{display:"flex",gap:8,alignItems:"center",padding:10,flexWrap:"wrap"}}>
          <button type="button" aria-expanded={open} aria-controls={panelId} aria-label={`${open?"Collapse":"Expand"} ${itemLabel}`} style={{...B,minWidth:34,padding:"6px 9px"}} onClick={()=>setExpanded((current)=>({...current,[uiKey]:!open}))}>{open?"−":"+"}</button>
          <div style={{flex:1,minWidth:150}}><strong style={{fontSize:12}}>{itemLabel}</strong>{secondaryLabel&&<div style={{fontSize:10,color:"var(--text-muted)",marginTop:2}}>{secondaryLabel}</div>}</div>
          <button type="button" title="Move up" aria-label={`Move ${itemLabel} up`} style={B} disabled={index===0} onClick={()=>moveItem(index,-1)}>↑</button>
          <button type="button" title="Move down" aria-label={`Move ${itemLabel} down`} style={B} disabled={index===items.length-1} onClick={()=>moveItem(index,1)}>↓</button>
          <button type="button" aria-label={`Delete ${itemLabel}`} style={{...B,color:"var(--danger)"}} onClick={()=>removeItem(index)}>Delete</button>
        </div>
        {open&&<div id={panelId} style={{borderTop:"1px solid var(--border)",padding:12,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>{itemFields.map((itemField)=><CustomCollectionFormField key={itemField.key} field={itemField} value={item&&typeof item==="object"&&!Array.isArray(item)?item[itemField.key]:undefined} onChange={(nextValue)=>updateItem(index,itemField.key,nextValue)}/>)}</div>}
      </div>;
    })}</div>
  </div>;
}

function CustomCollectionFormField({field,value,onChange}:{field:CustomCollectionField;value:any;onChange:(value:any)=>void}){
  const label=<span style={{fontSize:11,color:"var(--text-muted)"}}>{field.label}{field.required?" *":""}</span>;
  if(field.type==="array"&&field.itemFields?.length)return <StructuredCollectionArrayField field={field} value={value} onChange={onChange}/>;
  if(field.type==="boolean")return <label style={{display:"flex",gap:8,alignItems:"center",paddingTop:22}}><input type="checkbox" checked={Boolean(value)} onChange={(event)=>onChange(event.target.checked)}/>{field.label}</label>;
  if(field.type==="media")return <label>{label}<MediaPicker value={String(value||"")} media={{}} onChange={onChange} managedOnly/></label>;
  if(field.type==="select")return <label>{label}<select style={{...I,marginTop:5}} value={String(value||"")} onChange={(event)=>onChange(event.target.value)}><option value="">Choose…</option>{(field.options||[]).map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
  if(field.type==="textarea")return <label>{label}<textarea style={{...I,marginTop:5,minHeight:90}} value={String(value||"")} placeholder={field.placeholder} onChange={(event)=>onChange(event.target.value)}/></label>;
  if(field.type==="array"||field.type==="json"){const text=typeof value==="string"?value:JSON.stringify(value??(field.type==="array"?[]:{}),null,2);return <label>{label}<textarea spellCheck={false} style={{...I,marginTop:5,minHeight:90,fontFamily:"ui-monospace,monospace"}} value={text} onChange={(event)=>{const raw=event.target.value;try{onChange(JSON.parse(raw))}catch{onChange(raw)}}}/></label>}
  return <label>{label}<input type={field.type==="number"?"number":field.type==="date"?"date":field.type==="url"?"url":"text"} style={{...I,marginTop:5}} value={value??""} placeholder={field.placeholder} onChange={(event)=>onChange(field.type==="number"?Number(event.target.value):event.target.value)}/></label>;
}

function MediaPicker({
  value,
  media,
  onChange,
  managedOnly = false,
}: {
  value: string;
  media: RuntimeManifest["media"];
  onChange: (v: string) => void;
  managedOnly?: boolean;
}) {
  const { rows, loading, error, retry } = useImageMedia();
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
        aria-label="Managed image"
        style={I}
        disabled={loading}
        value={rows.some((r) => r.id === value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{loading ? "Loading managed media…" : "Choose image…"}</option>
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.filename}
          </option>
        ))}
      </select>
      <ManagedMediaLoadStatus loading={loading} error={error} retry={retry} />
      {!managedOnly && (
        <input
          style={{ ...I, marginTop: 6 }}
          value={rows.some((r) => r.id === value) ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or paste an external media URL"
        />
      )}
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
        {managedOnly
          ? "Choose an image from the managed Media library. The collection stores its stable media ID."
          : "Library selections are stored by stable media ID; external URLs remain URLs."}
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
function pretty(x: string) {
  return x.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatUploadBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
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
  const [cleanupLoadError, setCleanupLoadError] = React.useState("");
  const mediaActions = useMutationActions();
  const mediaEditGuard = useDraftBaseline();
  const mediaEditDirty = Boolean(editing) && mediaEditGuard.isDirty(editing);
  useUnsavedAdminChanges(mediaEditDirty);
  const openMediaEditing = (next: any) => { mediaEditGuard.begin(next); setEditing(next); };
  const closeMediaEditing = () => {
    if (!editing || mediaActions.isConflictPending(`media-record-${editing.id}`)) return;
    if (!confirmDiscardDraft(mediaEditDirty)) return;
    mediaEditGuard.clear();
    setEditing(null);
  };

  const load = React.useCallback(async (isCurrent: () => boolean = () => true) => {
    setLoading(true);
    try {
      const [mediaResponse, cleanupResponse] = await Promise.all([
        apiFetch<any>("/api/admin/media"),
        apiFetch<any>("/api/admin/media-cleanup-jobs").catch((cause) => ({ data: [], __loadError: cause instanceof Error ? cause.message : "Cleanup jobs could not be loaded." })),
      ]);
      if (!isCurrent()) return;
      setRows(mediaResponse.data || []);
      setCleanupJobs((cleanupResponse.data || []).filter((job: any) => job.status !== "complete"));
      setCleanupLoadError(String((cleanupResponse as any).__loadError || ""));
      setErr("");
    } catch (cause) {
      if (isCurrent()) setErr(cause instanceof Error ? cause.message : "Media library could not be loaded.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let current = true;
    void load(() => current);
    return () => { current = false; };
  }, [load]);

  const [uploadProgress, setUploadProgress] = React.useState<{ current: number; total: number; filename: string; bytesUploaded: number; bytesTotal: number; percentage: number } | null>(null);
  const [uploadReport, setUploadReport] = React.useState<{ uploaded: number; failed: Array<{ filename: string; message: string }>; refreshed: boolean; cancelled: boolean } | null>(null);
  const [retryFiles, setRetryFiles] = React.useState<File[]>([]);
  const uploadAbortRef = React.useRef<AbortController | null>(null);

  const uploadPreparedFile = React.useCallback(async (file: File, index: number, total: number, signal: AbortSignal) => {
    const preparedResponse = await apiFetch<{ data: PreparedMediaUpload & { mimeType: string } }>("/api/admin/media/uploads/prepare", {
      method: "POST",
      body: JSON.stringify({ filename: file.name, mime_type: file.type || "application/octet-stream", size_bytes: file.size, alt_text: "" }),
    });
    const prepared = preparedResponse.data;
    setUploadProgress({ current: index + 1, total, filename: file.name, bytesUploaded: 0, bytesTotal: file.size, percentage: 0 });
    await uploadBlobResumable({
      file,
      filename: file.name,
      mimeType: prepared.mimeType,
      prepared,
      signal,
      onProgress: (progress) => setUploadProgress({ current: index + 1, total, filename: file.name, ...progress }),
    });

    let lastError: unknown;
    for (const delay of [0, 800, 2000]) {
      if (signal.aborted) throw new DOMException("Upload cancelled", "AbortError");
      if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
      try {
        return await apiFetch("/api/admin/media/uploads/finalize", { method: "POST", body: JSON.stringify({ finalize_token: prepared.finalizeToken }) });
      } catch (cause) {
        lastError = cause;
        const status = Number((cause as { status?: unknown })?.status || 0);
        if (status > 0 && status < 500 && status !== 408 && status !== 429) throw cause;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Upload reached Storage but media finalization failed");
  }, []);

  const runUploadBatch = React.useCallback((files: File[]) => {
    if (files.length === 0) return;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploadReport(null);
    setRetryFiles([]);
    void mediaActions.run({
      key: "media-upload",
      conflictKey: "media-upload",
      pending: "Uploading media...",
      success: (result: any) => {
        const uploaded = Number(result.media?.length || 0);
        const failed = Number(result.failures?.length || 0);
        if (result.cancelled) return `Upload cancelled. ${uploaded} file${uploaded === 1 ? "" : "s"} completed before cancellation.`;
        if (failed > 0) return `Bulk upload finished: ${uploaded} uploaded, ${failed} failed.`;
        return result.refreshed ? `${uploaded} media file${uploaded === 1 ? "" : "s"} uploaded successfully.` : `${uploaded} media file${uploaded === 1 ? "" : "s"} uploaded, but the library could not refresh.`;
      },
      action: () => uploadMediaBatchAndRefresh({
        items: files,
        filename: (file) => file.name,
        upload: (file, index, total) => uploadPreparedFile(file, index, total, controller.signal),
        refresh: () => load(),
        preserveCreated: (created) => setRows((current) => [created, ...current.filter((record) => record.id !== created.id)]),
      }),
      onSuccess: (result: any) => {
        const failedNames = new Set((result.failures || []).map((failure: any) => String(failure.filename)));
        setRetryFiles(files.filter((file) => failedNames.has(file.name)));
        setUploadReport({ uploaded: Number(result.media?.length || 0), failed: result.failures || [], refreshed: Boolean(result.refreshed), cancelled: Boolean(result.cancelled) });
      },
      error: (cause) => cause instanceof DOMException && cause.name === "AbortError" ? "Media upload cancelled." : "Media could not be uploaded. Check the file type, Storage limit, or connection, then try again.",
    }).finally(() => {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      setUploadProgress(null);
    });
  }, [load, mediaActions, uploadPreparedFile]);

  const upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.currentTarget.value = "";
    runUploadBatch(files);
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
      onSuccess: async () => { mediaEditGuard.clear(); setEditing(null); await load(); },
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
    <Header title="Media" sub="Reusable CMS assets · direct resumable uploads to Supabase Storage · images, videos and documents." action={<div style={{ display: "flex", gap: 8, alignItems: "center" }}><label aria-busy={uploading} style={{ ...P, display: "inline-block", opacity: uploading ? .65 : 1, pointerEvents: uploading ? "none" : "auto" }}>{uploading ? (uploadProgress ? `Uploading ${uploadProgress.current}/${uploadProgress.total} · ${Math.round(uploadProgress.percentage)}%` : "Preparing upload...") : "Upload Media"}<input hidden type="file" multiple disabled={uploading} accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/wav,application/pdf,text/plain,.txt" onChange={upload} /></label>{uploading && <button type="button" style={B} onClick={() => uploadAbortRef.current?.abort()}>Cancel upload</button>}</div>} />
    {err && rows.length > 0 && <DataStatePanel kind="error" title="Media refresh failed" message={err} actionLabel="Retry" onAction={() => void load()} compact />}
    {cleanupLoadError && <p role="status" style={{ color: "var(--warning)", fontSize: 12 }}>Media library loaded, but cleanup-job status could not be refreshed: {cleanupLoadError}</p>}
    {uploading && uploadProgress && <Box style={{ padding: 12, marginBottom: 14, color: "var(--text-muted)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong style={{ color: "var(--text)" }}>Bulk upload {uploadProgress.current} / {uploadProgress.total}</strong><span>{formatUploadBytes(uploadProgress.bytesUploaded)} / {formatUploadBytes(uploadProgress.bytesTotal)} · {Math.round(uploadProgress.percentage)}%</span></div><div style={{ marginTop: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{uploadProgress.filename}</div><div aria-hidden="true" style={{ height: 5, background: "var(--surface-alt)", borderRadius: 999, overflow: "hidden", marginTop: 8 }}><div style={{ width: `${uploadProgress.percentage}%`, height: "100%", background: "var(--primary)", transition: "width 160ms ease" }} /></div><div style={{ marginTop: 7, fontSize: 11 }}>Files are sent directly from this browser to Storage in resumable chunks; the API only authorizes and registers the finished object.</div></Box>}
    {uploadReport && <Box style={{ padding: 12, marginBottom: 14, borderColor: uploadReport.failed.length ? "var(--warning)" : "var(--border)" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><strong>{uploadReport.uploaded} uploaded{uploadReport.failed.length ? ` · ${uploadReport.failed.length} failed` : ""}{uploadReport.cancelled ? " · cancelled" : ""}</strong>{retryFiles.length > 0 && !uploading && <button type="button" style={B} onClick={() => runUploadBatch(retryFiles)}>Retry failed files</button>}</div>{!uploadReport.refreshed && uploadReport.uploaded > 0 && <div style={{ marginTop: 5, color: "var(--warning)", fontSize: 12 }}>Uploads succeeded, but the library refresh failed. The uploaded cards were preserved locally.</div>}{uploadReport.failed.length > 0 && <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text-muted)", fontSize: 12, maxHeight: 130, overflow: "auto" }}>{uploadReport.failed.map((failure, index) => <li key={`${failure.filename}-${index}`} style={{ marginTop: 3 }}><strong style={{ color: "var(--text)" }}>{failure.filename}</strong>: {failure.message}</li>)}</ul>}</Box>}

    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16, padding: "4px 0 10px" }}>
      {tabs.map(([id, label]) => <button key={id} style={{ ...B, background: tab === id ? "var(--primary)" : "var(--surface)", color: tab === id ? "var(--primary-text)" : "var(--text)" }} onClick={() => setTab(id)}>{label} <small>({id === "all" ? rows.length : rows.filter((row) => row.kind === id).length})</small></button>)}
      <input aria-label="Search media" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search filename, alt text or MIME..." style={{ ...I, width: "min(360px,100%)", marginLeft: "auto" }} />
    </div>

    {loading && rows.length === 0 && <LoadingState label="Loading media library…" />}
    {loading && rows.length > 0 && <div style={{ marginBottom: 10 }}><DataRefreshStatus active label="Refreshing media library…" /></div>}
    {!loading && err && rows.length === 0 && <DataStatePanel kind="error" title="Media library could not be loaded" message={err} onAction={() => void load()} />}
    {!loading && filteredRows.length === 0 && !err && <DataStatePanel kind="empty" title={rows.length === 0 ? "No media yet" : "No media matches this view"} message={rows.length === 0 ? "Upload the first reusable CMS asset to populate the media library." : "Change the media type or search term to see other assets."} />}
    <div data-admin-media-grid style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 12, alignItems: "start" }}>
      {filteredRows.map((r) => <Box key={r.id} style={{ overflow: "hidden" }}>
        {String(r.mime_type || "").startsWith("image/") && r.public_url ? <img loading="lazy" decoding="async" src={r.public_url} alt={r.alt_text || r.filename} style={{ width: "100%", height: 140, objectFit: "cover", display: "block", background: "var(--surface-alt)" }} /> : String(r.mime_type || "").startsWith("video/") && r.public_url ? <video preload="none" muted src={r.public_url} style={{ width: "100%", height: 140, objectFit: "cover", display: "block", background: "var(--surface-alt)" }} /> : <div style={{ height: 140, display: "grid", placeItems: "center", background: "var(--surface-alt)", fontSize: 36 }}>{r.kind === "document" ? "▤" : r.kind === "audio" ? "♪" : "▧"}</div>}
        <div style={{ padding: 12 }}><strong title={r.filename} style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.filename}</strong><div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 5 }}>{r.mime_type} · {Math.round(Number(r.size || 0) / 1024)} KB</div>{r.alt_text && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.alt_text}</div>}<div style={{ display: "flex", gap: 6, marginTop: 9 }}><button style={B} disabled={mediaActions.isConflictPending(`media-record-${r.id}`)} onClick={() => openMediaEditing({ ...r })}>Edit</button><button style={B} disabled={mediaActions.isConflictPending(`media-record-${r.id}`)} aria-busy={mediaActions.isPending(`delete-media-${r.id}`)} onClick={() => removeMedia(r)}>{mediaActions.isPending(`delete-media-${r.id}`) ? "Deleting..." : "Delete"}</button></div></div>
      </Box>)}
    </div>

    {cleanupJobs.length > 0 && <Box style={{ marginTop: 20, padding: 14 }}><strong>Pending storage cleanup</strong><p style={{ color: "var(--text-muted)", fontSize: 12 }}>These database deletes already committed safely. Only orphaned Storage bytes remain to be removed.</p><div style={{ display: "grid", gap: 7 }}>{cleanupJobs.map((job) => <div key={job.id} style={{ display: "flex", gap: 8, alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 8 }}><code style={{ flex: 1, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis" }}>{job.storage_path}</code><span style={{ fontSize: 10, color: "var(--warning)" }}>{job.attempts} attempts</span><button style={B} disabled={mediaActions.isConflictPending(`cleanup-${job.id}`)} onClick={() => retryCleanup(job)}>Retry</button></div>)}</div></Box>}

    {editing && <Modal title="Edit media metadata" onClose={closeMediaEditing}><Field label="filename" type="text" value={editing.filename} onChange={(value) => setEditing({ ...editing, filename: value })} /><Field label="alt_text" type="textarea" value={editing.alt_text || ""} onChange={(value) => setEditing({ ...editing, alt_text: value })} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}><button type="button" style={B} onClick={closeMediaEditing}>Cancel</button><button style={P} disabled={mediaActions.isConflictPending(`media-record-${editing.id}`)} onClick={saveMetadata}>Save</button></div></Modal>}
    <ActionFeedback feedback={mediaActions.feedback} onDismiss={mediaActions.dismiss} />
  </>;
}
