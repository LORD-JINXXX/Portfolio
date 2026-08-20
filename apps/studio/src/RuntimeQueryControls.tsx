import React from 'react'
import type {
  CollectionBinding,
  CollectionFilter,
  CollectionPagination,
  CollectionSearch,
  CollectionSort,
  NodeInteraction,
  RuntimeAction,
  RuntimeCondition,
  RuntimeInteractionEvent,
  RuntimeValueReference,
} from '@platform/contracts'

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--surface-alt)', color: 'var(--text)', fontSize: 11 }
const labelStyle: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const detailsStyle: React.CSSProperties = { marginTop: 9, padding: '8px 9px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface-alt)' }
const summaryStyle: React.CSSProperties = { cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--text)' }
const ruleStyle: React.CSSProperties = { margin: '8px 0', padding: 8, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }
const noticeStyle: React.CSSProperties = { fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.45, margin: '6px 0 8px' }
const checkboxStyle: React.CSSProperties = { display: 'flex', gap: 7, alignItems: 'center', fontSize: 10, color: 'var(--text-muted)', margin: '8px 0' }
const primaryMini: React.CSSProperties = { padding: '6px 9px', border: 0, borderRadius: 5, background: 'var(--primary)', color: 'var(--primary-text)', fontSize: 10, cursor: 'pointer' }
const dangerMini: React.CSSProperties = { padding: '3px 7px', border: '1px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--danger)', fontSize: 10, cursor: 'pointer' }

function TextField({ label, value, onChange, placeholder, type = 'text', disabled = false, list }: { label: string; value: unknown; onChange: (value: string | number) => void; placeholder?: string; type?: string; disabled?: boolean; list?: string }) {
  return <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>{label}</span><input disabled={disabled} list={list} type={type} value={String(value ?? '')} onChange={(event) => onChange(type === 'number' ? Number(event.target.value) : event.target.value)} placeholder={placeholder} style={inputStyle} /></label>
}

function JsonEditor({ label, value, onChange, disabled = false, rows = 3 }: { label: string; value: unknown; onChange: (value: unknown) => void; disabled?: boolean; rows?: number }) {
  const serialize = React.useCallback((item: unknown) => {
    try { return JSON.stringify(item) ?? '' } catch { return String(item ?? '') }
  }, [])
  const [draft, setDraft] = React.useState(() => serialize(value))
  const [invalid, setInvalid] = React.useState(false)
  React.useEffect(() => { setDraft(serialize(value)); setInvalid(false) }, [serialize, value])
  const commit = () => {
    try { onChange(JSON.parse(draft || 'null')); setInvalid(false) } catch { setInvalid(true) }
  }
  return <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>{label}</span><textarea disabled={disabled} value={draft} onChange={(event) => { setDraft(event.target.value); setInvalid(false) }} onBlur={commit} rows={rows} style={{ ...inputStyle, resize: 'vertical', borderColor: invalid ? 'var(--danger)' : 'var(--border)' }} />{invalid && <small style={{ color: 'var(--danger)' }}>Enter valid JSON before leaving this field.</small>}</label>
}

function JsonLiteralField({ label, value, onChange, disabled = false }: { label: string; value: unknown; onChange: (value: unknown) => void; disabled?: boolean }) {
  const serialize = React.useCallback((item: unknown) => {
    try { return JSON.stringify(item) ?? '' } catch { return String(item ?? '') }
  }, [])
  const [draft, setDraft] = React.useState(() => serialize(value))
  const [invalid, setInvalid] = React.useState(false)
  React.useEffect(() => { setDraft(serialize(value)); setInvalid(false) }, [serialize, value])
  const parse = (next: string) => {
    setDraft(next)
    try { onChange(JSON.parse(next)); setInvalid(false) } catch { setInvalid(true) }
  }
  return <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>{label}</span><input disabled={disabled} value={draft} onChange={(event) => parse(event.target.value)} style={{ ...inputStyle, borderColor: invalid ? 'var(--danger)' : 'var(--border)' }} />{invalid && <small style={{ color: 'var(--danger)' }}>Use JSON syntax, for example "all", 12, true or ["a","b"].</small>}</label>
}

function isRuntimeValueReference(value: unknown): value is RuntimeValueReference {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && typeof (value as { source?: unknown }).source === 'string')
}

function stateCondition(stateKey: string, operator: RuntimeCondition['operator'] = 'eq', value: unknown = true): RuntimeCondition | undefined {
  const key = stateKey.trim()
  if (!key) return undefined
  if (operator === 'truthy' || operator === 'falsy') return { left: { source: 'state', key }, operator }
  return { left: { source: 'state', key }, operator, right: { source: 'literal', value } }
}

function conditionParts(condition: RuntimeCondition | undefined): { stateKey: string; operator: RuntimeCondition['operator']; value: unknown } {
  if (!condition || condition.left.source !== 'state') return { stateKey: '', operator: 'eq', value: true }
  return {
    stateKey: condition.left.key,
    operator: condition.operator,
    value: condition.right?.source === 'literal' ? condition.right.value : true,
  }
}

export function CollectionQueryControls({ binding, disabled, fieldOptions, onPatch }: { binding: CollectionBinding; disabled: boolean; fieldOptions: string[]; onPatch: (patch: Record<string, unknown>) => void }) {
  const search = binding.search
  const filters = binding.filters || []
  const sorts = binding.sort || []
  const pagination = binding.pagination
  const fieldListId = 'studio-collection-query-fields'
  const setSearch = (next: CollectionSearch | undefined) => onPatch({ search: next })
  const setFilters = (next: CollectionFilter[]) => onPatch({ filters: next.length ? next : undefined })
  const setSorts = (next: CollectionSort[]) => onPatch({ sort: next.length ? next : undefined })
  const setPagination = (next: CollectionPagination | undefined) => onPatch({ pagination: next })
  const searchStateKey = search?.query.source === 'state' ? search.query.key : ''
  const queryFields = search?.fields || []
  const defaultSearchFields = fieldOptions.filter((field) => ['title', 'name', 'description', 'category', 'technologies'].includes(field)).slice(0, 3)

  return <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
    <strong style={{ fontSize: 11 }}>Collection query</strong>
    <p style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.5, margin: '4px 0 10px' }}>Configure runtime search, filters, sorting and page-based pagination. State keys are written by controls configured in the Logic tab.</p>
    <TextField disabled={disabled} label="Limit" value={binding.limit || 6} type="number" onChange={(value) => onPatch({ limit: Math.max(1, Number(value) || 1) })} />
    <TextField disabled={disabled} label="Filtered count → state key" value={binding.countStateKey || ''} onChange={(value) => onPatch({ countStateKey: String(value).trim() || undefined })} placeholder="projects.visibleCount" />

    <details open={Boolean(search)} style={detailsStyle}>
      <summary style={summaryStyle}>Search</summary>
      <label style={checkboxStyle}><input disabled={disabled} type="checkbox" checked={Boolean(search)} onChange={(event) => setSearch(event.target.checked ? {
        query: { source: 'state', key: searchStateKey || 'collection.search' },
        fields: queryFields.length ? queryFields : (defaultSearchFields.length ? defaultSearchFields : [fieldOptions[0] || 'title']),
        mode: search?.mode || 'contains',
        caseSensitive: Boolean(search?.caseSensitive),
      } : undefined)} /> Enable collection search</label>
      {search && <>
        <TextField disabled={disabled} label="Search state key" value={searchStateKey} onChange={(value) => setSearch({ ...search, query: { source: 'state', key: String(value).trim() || 'collection.search' } })} placeholder="projects.search" />
        {search.query.source !== 'state' && <div style={noticeStyle}>This query currently uses an advanced value reference. Editing the state key converts it to a runtime-state search.</div>}
        <TextField disabled={disabled} list={fieldListId} label="Search fields (comma separated)" value={queryFields.join(', ')} onChange={(value) => { const fields = String(value).split(',').map((field) => field.trim()).filter(Boolean); if (fields.length) setSearch({ ...search, fields }) }} placeholder="title, description, technologies" />
        <datalist id={fieldListId}>{fieldOptions.map((field) => <option key={field} value={field} />)}</datalist>
        <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Search mode</span><select disabled={disabled} value={search.mode || 'contains'} onChange={(event) => setSearch({ ...search, mode: event.target.value as CollectionSearch['mode'] })} style={inputStyle}><option value="contains">Contains</option><option value="starts-with">Starts with</option><option value="exact">Exact</option></select></label>
        <label style={checkboxStyle}><input disabled={disabled} type="checkbox" checked={Boolean(search.caseSensitive)} onChange={(event) => setSearch({ ...search, caseSensitive: event.target.checked || undefined })} /> Case-sensitive matching</label>
      </>}
    </details>

    <details open={filters.length > 0} style={detailsStyle}>
      <summary style={summaryStyle}>Filters · {filters.length}</summary>
      {filters.map((filter, index) => <CollectionFilterEditor key={`${filter.field}-${index}`} filter={filter} disabled={disabled} fieldOptions={fieldOptions} onChange={(next) => setFilters(filters.map((item, itemIndex) => itemIndex === index ? next : item))} onDelete={() => setFilters(filters.filter((_, itemIndex) => itemIndex !== index))} />)}
      <button disabled={disabled} type="button" onClick={() => setFilters([...filters, { field: fieldOptions[0] || 'category', operator: 'eq', value: '' }])} style={primaryMini}>+ Filter</button>
    </details>

    <details open={sorts.length > 0} style={detailsStyle}>
      <summary style={summaryStyle}>Sort · {sorts.length}</summary>
      {sorts.map((sort, index) => <CollectionSortEditor key={`${sort.field}-${index}`} sort={sort} disabled={disabled} fieldOptions={fieldOptions} onChange={(next) => setSorts(sorts.map((item, itemIndex) => itemIndex === index ? next : item))} onDelete={() => setSorts(sorts.filter((_, itemIndex) => itemIndex !== index))} />)}
      <button disabled={disabled} type="button" onClick={() => setSorts([...sorts, { field: fieldOptions[0] || 'created_at', direction: 'asc' }])} style={primaryMini}>+ Sort rule</button>
    </details>

    <details open={Boolean(pagination)} style={detailsStyle}>
      <summary style={summaryStyle}>Pagination</summary>
      <label style={checkboxStyle}><input disabled={disabled} type="checkbox" checked={Boolean(pagination)} onChange={(event) => setPagination(event.target.checked ? { pageStateKey: pagination?.pageStateKey || 'collection.page', pageSize: pagination?.pageSize || 12, totalStateKey: pagination?.totalStateKey, pageCountStateKey: pagination?.pageCountStateKey, hasNextStateKey: pagination?.hasNextStateKey, hasPreviousStateKey: pagination?.hasPreviousStateKey } : undefined)} /> Enable page-based pagination</label>
      {pagination && <>
        <TextField disabled={disabled} label="Current page state key" value={pagination.pageStateKey} onChange={(value) => setPagination({ ...pagination, pageStateKey: String(value).trim() || 'collection.page' })} placeholder="projects.page" />
        <TextField disabled={disabled} type="number" label="Items per page" value={pagination.pageSize} onChange={(value) => setPagination({ ...pagination, pageSize: Math.max(1, Math.round(Number(value) || 1)) })} />
        <TextField disabled={disabled} label="Total items → state key" value={pagination.totalStateKey || ''} onChange={(value) => setPagination({ ...pagination, totalStateKey: String(value).trim() || undefined })} placeholder="projects.total" />
        <TextField disabled={disabled} label="Page count → state key" value={pagination.pageCountStateKey || ''} onChange={(value) => setPagination({ ...pagination, pageCountStateKey: String(value).trim() || undefined })} placeholder="projects.pageCount" />
        <TextField disabled={disabled} label="Has next → state key" value={pagination.hasNextStateKey || ''} onChange={(value) => setPagination({ ...pagination, hasNextStateKey: String(value).trim() || undefined })} placeholder="projects.hasNext" />
        <TextField disabled={disabled} label="Has previous → state key" value={pagination.hasPreviousStateKey || ''} onChange={(value) => setPagination({ ...pagination, hasPreviousStateKey: String(value).trim() || undefined })} placeholder="projects.hasPrevious" />
      </>}
    </details>

    <details style={detailsStyle}>
      <summary style={summaryStyle}>Advanced query JSON</summary>
      <div style={noticeStyle}>Use this escape hatch for complex references or conditions. The visual controls above cover common search/filter/sort/pagination authoring.</div>
      <JsonEditor disabled={disabled} label="Search JSON" value={binding.search || null} onChange={(value) => onPatch({ search: value || undefined })} />
      <JsonEditor disabled={disabled} label="Filters JSON" value={binding.filters || []} onChange={(value) => onPatch({ filters: Array.isArray(value) ? value : [] })} />
      <JsonEditor disabled={disabled} label="Sort JSON" value={binding.sort || []} onChange={(value) => onPatch({ sort: Array.isArray(value) ? value : [] })} />
      <JsonEditor disabled={disabled} label="Pagination JSON" value={binding.pagination || null} onChange={(value) => onPatch({ pagination: value || undefined })} />
      <div style={noticeStyle}>Dynamic filter example: {'[{"field":"category","operator":"eq","value":{"source":"state","key":"projects.category"}}]'}</div>
    </details>
  </div>
}

function CollectionFilterEditor({ filter, disabled, fieldOptions, onChange, onDelete }: { filter: CollectionFilter; disabled: boolean; fieldOptions: string[]; onChange: (filter: CollectionFilter) => void; onDelete: () => void }) {
  const reference = isRuntimeValueReference(filter.value) ? filter.value : null
  const valueSource = reference?.source === 'state' ? 'state' : 'literal'
  const listId = `filter-fields-${filter.field.replace(/[^A-Za-z0-9_-]/g, '-')}`
  return <div style={ruleStyle}>
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 6 }}>
      <label><span style={labelStyle}>Field</span><input disabled={disabled} list={listId} value={filter.field} onChange={(event) => onChange({ ...filter, field: event.target.value })} style={inputStyle} /></label>
      <label><span style={labelStyle}>Operator</span><select disabled={disabled} value={filter.operator} onChange={(event) => onChange({ ...filter, operator: event.target.value as CollectionFilter['operator'] })} style={inputStyle}>{['eq', 'neq', 'in', 'contains', 'gt', 'gte', 'lt', 'lte'].map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select></label>
    </div>
    <datalist id={listId}>{fieldOptions.map((field) => <option key={field} value={field} />)}</datalist>
    <label style={{ display: 'block', margin: '8px 0' }}><span style={labelStyle}>Value source</span><select disabled={disabled} value={valueSource} onChange={(event) => onChange({ ...filter, value: event.target.value === 'state' ? { source: 'state', key: reference?.source === 'state' ? reference.key : 'filters.value' } : '' })} style={inputStyle}><option value="literal">Literal value</option><option value="state">Runtime state</option></select></label>
    {valueSource === 'state'
      ? <TextField disabled={disabled} label="Value state key" value={reference?.source === 'state' ? reference.key : ''} onChange={(value) => onChange({ ...filter, value: { source: 'state', key: String(value).trim() || 'filters.value' } })} placeholder="projects.category" />
      : <JsonLiteralField disabled={disabled} label="Literal value (JSON)" value={reference?.source === 'literal' ? reference.value : filter.value} onChange={(value) => onChange({ ...filter, value })} />}
    <RuntimeStateConditionEditor condition={filter.when} disabled={disabled} onChange={(when) => onChange({ ...filter, when })} />
    <button disabled={disabled} type="button" onClick={onDelete} style={dangerMini}>Delete filter</button>
  </div>
}

function CollectionSortEditor({ sort, disabled, fieldOptions, onChange, onDelete }: { sort: CollectionSort; disabled: boolean; fieldOptions: string[]; onChange: (sort: CollectionSort) => void; onDelete: () => void }) {
  const listId = `sort-fields-${sort.field.replace(/[^A-Za-z0-9_-]/g, '-')}`
  return <div style={ruleStyle}>
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 6 }}>
      <label><span style={labelStyle}>Field</span><input disabled={disabled} list={listId} value={sort.field} onChange={(event) => onChange({ ...sort, field: event.target.value })} style={inputStyle} /></label>
      <label><span style={labelStyle}>Direction</span><select disabled={disabled} value={sort.direction} onChange={(event) => onChange({ ...sort, direction: event.target.value as CollectionSort['direction'] })} style={inputStyle}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
    </div>
    <datalist id={listId}>{fieldOptions.map((field) => <option key={field} value={field} />)}</datalist>
    <RuntimeStateConditionEditor condition={sort.when} disabled={disabled} onChange={(when) => onChange({ ...sort, when })} />
    <button disabled={disabled} type="button" onClick={onDelete} style={dangerMini}>Delete sort rule</button>
  </div>
}

function RuntimeStateConditionEditor({ condition, disabled, onChange }: { condition?: RuntimeCondition; disabled: boolean; onChange: (condition: RuntimeCondition | undefined) => void }) {
  const parts = conditionParts(condition)
  const enabled = Boolean(condition)
  const operators: RuntimeCondition['operator'][] = ['eq', 'neq', 'truthy', 'falsy']
  return <details style={{ margin: '8px 0' }}>
    <summary style={{ fontSize: 9, color: 'var(--text-muted)', cursor: 'pointer' }}>Active when… {enabled ? `${parts.stateKey} ${parts.operator}` : 'always'}</summary>
    <label style={{ ...checkboxStyle, marginTop: 8 }}><input disabled={disabled} type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked ? stateCondition(parts.stateKey || 'filters.enabled', parts.operator, parts.value) : undefined)} /> Use state condition</label>
    {enabled && <>
      <TextField disabled={disabled} label="Condition state key" value={parts.stateKey} onChange={(value) => onChange(stateCondition(String(value).trim() || 'filters.enabled', parts.operator, parts.value))} placeholder="projects.sort" />
      <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Condition operator</span><select disabled={disabled} value={parts.operator} onChange={(event) => onChange(stateCondition(parts.stateKey || 'filters.enabled', event.target.value as RuntimeCondition['operator'], parts.value))} style={inputStyle}>{operators.map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select></label>
      {!['truthy', 'falsy'].includes(parts.operator) && <JsonLiteralField disabled={disabled} label="Condition value (JSON)" value={parts.value} onChange={(value) => onChange(stateCondition(parts.stateKey || 'filters.enabled', parts.operator, value))} />}
    </>}
  </details>
}

export function RuntimeInteractionsEditor({ nodeType, interactions, disabled, onChange }: { nodeType: string; interactions: NodeInteraction[]; disabled: boolean; onChange: (interactions: NodeInteraction[]) => void }) {
  const defaultEvent: RuntimeInteractionEvent = nodeType === 'input' || nodeType === 'textarea' ? 'input' : nodeType === 'select' ? 'change' : 'click'
  const defaultValue: RuntimeValueReference = defaultEvent === 'input' || defaultEvent === 'change' ? { source: 'event', key: 'value' } : { source: 'literal', value: true }
  const setInteractions = (next: NodeInteraction[]) => onChange(next)
  return <>
    {interactions.map((interaction, index) => <InteractionEditor key={`${interaction.event}-${index}`} interaction={interaction} disabled={disabled} onChange={(next) => setInteractions(interactions.map((item, itemIndex) => itemIndex === index ? next : item))} onDelete={() => setInteractions(interactions.filter((_, itemIndex) => itemIndex !== index))} />)}
    <button disabled={disabled} type="button" onClick={() => setInteractions([...interactions, { event: defaultEvent, actions: [{ type: 'set-state', key: 'ui.value', value: defaultValue }] }])} style={primaryMini}>+ Interaction</button>
    <details style={{ ...detailsStyle, marginTop: 12 }}><summary style={summaryStyle}>Advanced interactions JSON</summary><JsonEditor disabled={disabled} label="Interactions JSON" value={interactions} onChange={(value) => onChange(Array.isArray(value) ? value as NodeInteraction[] : [])} /><div style={noticeStyle}>Input example: {'[{"event":"input","actions":[{"type":"set-state","key":"projects.search","value":{"source":"event","key":"value"}}]}]'}</div></details>
  </>
}

function InteractionEditor({ interaction, disabled, onChange, onDelete }: { interaction: NodeInteraction; disabled: boolean; onChange: (interaction: NodeInteraction) => void; onDelete: () => void }) {
  const events: RuntimeInteractionEvent[] = ['click', 'double-click', 'mouseenter', 'mouseleave', 'input', 'change']
  const setActions = (actions: RuntimeAction[]) => onChange({ ...interaction, actions: actions.length ? actions : [{ type: 'set-state', key: 'ui.value', value: { source: 'literal', value: true } }] })
  return <div style={ruleStyle}>
    <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Event</span><select disabled={disabled} value={interaction.event} onChange={(event) => onChange({ ...interaction, event: event.target.value as RuntimeInteractionEvent })} style={inputStyle}>{events.map((event) => <option key={event} value={event}>{event}</option>)}</select></label>
    {interaction.actions.map((action, index) => <RuntimeActionEditor key={`${action.type}-${index}`} action={action} disabled={disabled} interactionEvent={interaction.event} onChange={(next) => setActions(interaction.actions.map((item, itemIndex) => itemIndex === index ? next : item))} onDelete={() => setActions(interaction.actions.filter((_, itemIndex) => itemIndex !== index))} />)}
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button disabled={disabled} type="button" onClick={() => setActions([...interaction.actions, { type: 'set-state', key: 'ui.value', value: interaction.event === 'input' || interaction.event === 'change' ? { source: 'event', key: 'value' } : { source: 'literal', value: true } }])} style={primaryMini}>+ Action</button><button disabled={disabled} type="button" onClick={onDelete} style={dangerMini}>Delete interaction</button></div>
  </div>
}

function RuntimeActionEditor({ action, disabled, interactionEvent, onChange, onDelete }: { action: RuntimeAction; disabled: boolean; interactionEvent: RuntimeInteractionEvent; onChange: (action: RuntimeAction) => void; onDelete: () => void }) {
  const value = action.type === 'set-state' ? action.value : null
  const supportedSource = value?.source === 'event' || value?.source === 'state' || value?.source === 'field' || value?.source === 'literal' ? value.source : 'literal'
  const setType = (type: RuntimeAction['type']) => {
    if (type === 'toggle-state') onChange({ type, key: action.key })
    else if (type === 'increment-state') onChange({ type, key: action.key, amount: 1 })
    else onChange({ type, key: action.key, value: interactionEvent === 'input' || interactionEvent === 'change' ? { source: 'event', key: 'value' } : { source: 'literal', value: true } })
  }
  return <div style={{ padding: 8, marginBottom: 8, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface-alt)' }}>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 6 }}>
      <label><span style={labelStyle}>Action</span><select disabled={disabled} value={action.type} onChange={(event) => setType(event.target.value as RuntimeAction['type'])} style={inputStyle}><option value="set-state">Set state</option><option value="toggle-state">Toggle state</option><option value="increment-state">Increment state</option></select></label>
      <TextField disabled={disabled} label="State key" value={action.key} onChange={(value) => onChange({ ...action, key: String(value).trim() || 'ui.value' } as RuntimeAction)} placeholder="projects.page" />
    </div>
    {action.type === 'increment-state' && <TextField disabled={disabled} type="number" label="Amount" value={action.amount ?? 1} onChange={(amount) => onChange({ ...action, amount: Number(amount) || 1 })} />}
    {action.type === 'set-state' && <>
      {value && !['literal', 'event', 'state', 'field'].includes(value.source) && <div style={noticeStyle}>This action uses an advanced value source ({value.source}). Choosing a source below will replace it.</div>}
      <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Value source</span><select disabled={disabled} value={supportedSource} onChange={(event) => { const source = event.target.value; const nextValue: RuntimeValueReference = source === 'event' ? { source: 'event', key: 'value' } : source === 'state' ? { source: 'state', key: 'ui.value' } : source === 'field' ? { source: 'field', key: 'pageNumber' } : { source: 'literal', value: true }; onChange({ ...action, value: nextValue }) }} style={inputStyle}><option value="literal">Literal</option><option value="event">Event value</option><option value="state">Runtime state</option><option value="field">Repeated item field</option></select></label>
      {supportedSource === 'event' && <label style={{ display: 'block', marginBottom: 8 }}><span style={labelStyle}>Event field</span><select disabled={disabled} value={value?.source === 'event' ? value.key : 'value'} onChange={(event) => onChange({ ...action, value: { source: 'event', key: event.target.value as 'value' | 'checked' } })} style={inputStyle}><option value="value">value</option><option value="checked">checked</option></select></label>}
      {supportedSource === 'state' && <TextField disabled={disabled} label="Source state key" value={value?.source === 'state' ? value.key : ''} onChange={(sourceKey) => onChange({ ...action, value: { source: 'state', key: String(sourceKey).trim() || 'ui.value' } })} />}
      {supportedSource === 'field' && <TextField disabled={disabled} label="Repeated item field" value={value?.source === 'field' ? value.key : 'pageNumber'} onChange={(fieldKey) => onChange({ ...action, value: { source: 'field', key: String(fieldKey).trim() || 'pageNumber' } })} placeholder="pageNumber" />}
      {supportedSource === 'literal' && <JsonLiteralField disabled={disabled} label="Literal value (JSON)" value={value?.source === 'literal' ? value.value : true} onChange={(literal) => onChange({ ...action, value: { source: 'literal', value: literal } })} />}
    </>}
    <button disabled={disabled} type="button" onClick={onDelete} style={dangerMini}>Delete action</button>
  </div>
}
