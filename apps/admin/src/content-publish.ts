export const POST_PUBLISH_REFRESH_ERROR = 'Content published successfully, but the editor could not load the next draft. Use Reload Editor to continue.'

export class ContentPublishedRefreshError extends Error {
  readonly cause: unknown

  constructor(cause: unknown) {
    super(POST_PUBLISH_REFRESH_ERROR)
    this.name = 'ContentPublishedRefreshError'
    this.cause = cause
  }
}

interface PublishContentWorkflow<TPublished, TContext> {
  publish: () => Promise<TPublished>
  markPublished: (published: TPublished) => void
  createNextDraft: () => Promise<unknown>
  loadEditorContext: () => Promise<TContext>
  applyEditorContext: (context: TContext) => void
}

export async function publishContentAndRefresh<TPublished, TContext>({
  publish,
  markPublished,
  createNextDraft,
  loadEditorContext,
  applyEditorContext,
}: PublishContentWorkflow<TPublished, TContext>): Promise<TPublished> {
  const published = await publish()
  try {
    markPublished(published)
    await createNextDraft()
    applyEditorContext(await loadEditorContext())
  } catch (cause) {
    throw new ContentPublishedRefreshError(cause)
  }
  return published
}
