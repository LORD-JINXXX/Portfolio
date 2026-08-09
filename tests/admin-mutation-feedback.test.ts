import test from 'node:test'
import assert from 'node:assert/strict'
import {
  feedbackAutoDismissDelay,
  MutationActionGate,
  runMutationAction,
  type ActionFeedbackMessage,
} from '../packages/ui/src/mutation-feedback'
import {
  ContentPublishedRefreshError,
  publishContentAndRefresh,
} from '../apps/admin/src/content-publish'

test('two rapid Publish Content attempts allow exactly one mutation request', async () => {
  const gate = new MutationActionGate()
  let requests = 0
  let releaseRequest: (() => void) | undefined
  const request = () => new Promise<void>((resolve) => {
    requests += 1
    releaseRequest = resolve
  })
  const publish = async () => {
    if (!gate.begin('publish-content')) return
    try {
      await request()
    } finally {
      gate.end('publish-content')
    }
  }

  const first = publish()
  const second = publish()
  assert.equal(requests, 1)
  releaseRequest?.()
  await Promise.all([first, second])
})

test('failed Publish Content becomes retryable after the gate is released', async () => {
  const gate = new MutationActionGate()
  let requests = 0
  const publish = async () => {
    if (!gate.begin('publish-content')) return
    try {
      requests += 1
      if (requests === 1) throw new Error('Publish failed')
    } finally {
      gate.end('publish-content')
    }
  }

  await assert.rejects(publish(), /Publish failed/)
  await publish()
  assert.equal(requests, 2)
})

test('duplicate Create Candidate is synchronously blocked and retryable', () => {
  const gate = new MutationActionGate()
  assert.equal(gate.begin('release-mutation'), true)
  assert.equal(gate.begin('release-mutation'), false)
  gate.end('release-mutation')
  assert.equal(gate.begin('release-mutation'), true)
})

test('success feedback clears after three seconds while errors persist', () => {
  const success: ActionFeedbackMessage = { tone: 'success', title: 'Published.' }
  const error: ActionFeedbackMessage = { tone: 'error', title: 'Publish failed.' }
  assert.equal(feedbackAutoDismissDelay(success, 3000), 3000)
  assert.equal(feedbackAutoDismissDelay(error, 3000), null)
})

function createMutationRuntime(mounted = true) {
  const gate = new MutationActionGate()
  const pending = new Set<string>()
  const feedback: ActionFeedbackMessage[] = []
  return {
    gate,
    pending,
    feedback,
    runtime: {
      gate,
      isMounted: () => mounted,
      setPending: (key: string, value: boolean) => {
        if (value) pending.add(key)
        else pending.delete(key)
      },
      show: (message: ActionFeedbackMessage) => feedback.push(message),
    },
  }
}

test('successful mutation always clears pending state and releases its gate', async () => {
  const state = createMutationRuntime()
  await runMutationAction({
    key: 'publish-content',
    conflictKey: 'content-revision-action',
    pending: 'Publishing content...',
    success: 'Content published successfully.',
    action: async () => 'published',
  }, state.runtime)

  assert.equal(state.pending.has('publish-content'), false)
  assert.equal(state.gate.isPending('content-revision-action'), false)
  assert.deepEqual(state.feedback.at(-1), {
    tone: 'success',
    title: 'Content published successfully.',
  })
})

test('StrictMode lifecycle replay cannot strand mutation cleanup', async () => {
  const state = createMutationRuntime(false)
  await runMutationAction({
    key: 'publish-content',
    conflictKey: 'content-revision-action',
    pending: 'Publishing content...',
    success: 'Content published successfully.',
    action: async () => undefined,
  }, state.runtime)

  assert.equal(state.pending.has('publish-content'), false)
  assert.equal(state.gate.isPending('content-revision-action'), false)
  assert.deepEqual(state.feedback, [{ tone: 'info', title: 'Publishing content...' }])
})

test('pending cleanup failure still releases the mutation gate', async () => {
  const gate = new MutationActionGate()
  await assert.rejects(runMutationAction({
    key: 'publish-content',
    conflictKey: 'content-revision-action',
    pending: 'Publishing content...',
    success: 'Content published successfully.',
    action: async () => undefined,
  }, {
    gate,
    isMounted: () => true,
    setPending: (_key, pending) => {
      if (!pending) throw new Error('pending cleanup failed')
    },
    show: () => undefined,
  }), /pending cleanup failed/)
  assert.equal(gate.isPending('content-revision-action'), false)
})

for (const [key, conflictKey, pendingMessage] of [
  ['admin-login', 'admin-auth', 'Signing in...'],
  ['studio-login', 'studio-auth', 'Signing in...'],
  ['admin-logout', 'admin-auth', 'Signing out...'],
  ['studio-logout', 'studio-auth', 'Signing out...'],
  ['save-content-home.hero.heading', 'save-content-home.hero.heading', 'Saving draft...'],
] as const) {
  test(`${key} blocks rapid duplicate attempts and releases after success`, async () => {
    const state = createMutationRuntime()
    let requests = 0
    let releaseRequest: (() => void) | undefined
    const options = {
      key,
      conflictKey,
      pending: pendingMessage,
      success: 'Completed.',
      action: () => new Promise<void>((resolve) => {
        requests += 1
        releaseRequest = resolve
      }),
    }

    const first = runMutationAction(options, state.runtime)
    const duplicate = runMutationAction(options, state.runtime)
    assert.equal(requests, 1)
    assert.equal(state.pending.has(key), true)
    releaseRequest?.()
    await Promise.all([first, duplicate])
    assert.equal(state.pending.has(key), false)
    assert.equal(state.gate.isPending(conflictKey), false)
  })
}

for (const [resource, action, pendingMessage] of [
  ['projects', 'create', 'Creating projects...'],
  ['projects', 'save', 'Saving projects...'],
  ['projects', 'delete', 'Deleting project...'],
  ['notes', 'create', 'Creating notes...'],
  ['notes', 'save', 'Saving notes...'],
  ['notes', 'delete', 'Deleting note...'],
  ['experience', 'create', 'Creating experience...'],
  ['experience', 'save', 'Saving experience...'],
  ['experience', 'delete', 'Deleting experience...'],
  ['apps', 'create', 'Creating ai applications...'],
  ['apps', 'save', 'Saving ai applications...'],
  ['apps', 'delete', 'Deleting ai application...'],
] as const) {
  test(`${resource} ${action} exposes pending state and synchronously blocks duplicates`, async () => {
    const state = createMutationRuntime()
    const recordId = action === 'create' ? 'new' : 'record-1'
    const key = `${action}-${resource}${action === 'create' ? '' : `-${recordId}`}`
    const conflictKey = `${resource}-record-${recordId}`
    let requests = 0
    let settle: (() => void) | undefined
    const options = {
      key,
      conflictKey,
      pending: pendingMessage,
      success: `${resource} completed successfully.`,
      action: () => new Promise<void>((resolve) => { requests += 1; settle = resolve }),
    }

    const first = runMutationAction(options, state.runtime)
    const duplicateEnterSubmit = runMutationAction(options, state.runtime)
    assert.equal(requests, 1)
    assert.equal(state.pending.has(key), true)
    assert.deepEqual(state.feedback.at(-1), { tone: 'info', title: pendingMessage })
    settle?.()
    await Promise.all([first, duplicateEnterSubmit])
    assert.equal(state.pending.has(key), false)
    assert.equal(state.gate.isPending(conflictKey), false)
  })
}

for (const [key, conflictKey, pendingMessage] of [
  ['media-upload', 'media-upload', 'Uploading media...'],
  ['delete-media-record-1', 'media-record-record-1', 'Deleting media...'],
] as const) {
  test(`${key} visibly waits, blocks rapid duplicate requests, and resets`, async () => {
    const state = createMutationRuntime()
    let requests = 0
    let settle: (() => void) | undefined
    const options = {
      key,
      conflictKey,
      pending: pendingMessage,
      success: key === 'media-upload' ? 'Media uploaded successfully.' : 'Media deleted successfully.',
      action: () => new Promise<void>((resolve) => { requests += 1; settle = resolve }),
    }
    const first = runMutationAction(options, state.runtime)
    const duplicate = runMutationAction(options, state.runtime)
    assert.equal(requests, 1)
    assert.equal(state.pending.has(key), true)
    settle?.()
    await Promise.all([first, duplicate])
    assert.equal(state.pending.has(key), false)
    assert.equal(state.gate.isPending(conflictKey), false)
    assert.equal(feedbackAutoDismissDelay(state.feedback.at(-1)!, 3000), 3000)
  })
}

test('media upload error persists, hides internal detail, and permits retry', async () => {
  const state = createMutationRuntime()
  let requests = 0
  const options = {
    key: 'media-upload',
    conflictKey: 'media-upload',
    pending: 'Uploading media...',
    success: 'Media uploaded successfully.',
    error: 'Media could not be uploaded. Check the file type and size, then try again.',
    action: async () => { requests += 1; if (requests === 1) throw new Error('storage bucket internals') },
  }
  await runMutationAction(options, state.runtime)
  assert.deepEqual(state.feedback.at(-1), { tone: 'error', title: options.error })
  assert.equal(feedbackAutoDismissDelay(state.feedback.at(-1)!, 3000), null)
  assert.equal(state.pending.size, 0)
  await runMutationAction(options, state.runtime)
  assert.equal(requests, 2)
})

test('structured content failure remains visible, releases its record gate, and retries', async () => {
  const state = createMutationRuntime()
  let requests = 0
  const options = {
    key: 'save-projects-record-1',
    conflictKey: 'projects-record-record-1',
    pending: 'Saving projects...',
    success: 'Project updated successfully.',
    error: 'Project could not be saved. Check the entered values and try again.',
    action: async () => { requests += 1; if (requests === 1) throw new Error('database details') },
  }

  await runMutationAction(options, state.runtime)
  assert.equal(state.pending.size, 0)
  assert.equal(state.gate.isPending(options.conflictKey), false)
  assert.deepEqual(state.feedback.at(-1), { tone: 'error', title: options.error })
  assert.equal(feedbackAutoDismissDelay(state.feedback.at(-1)!, 3000), null)
  await runMutationAction(options, state.runtime)
  assert.equal(requests, 2)
  assert.equal(feedbackAutoDismissDelay(state.feedback.at(-1)!, 3000), 3000)
})

for (const key of ['admin-login', 'studio-login', 'save-content-home.hero.heading'] as const) {
  test(`${key} failure clears pending, persists error feedback, and permits retry`, async () => {
    const state = createMutationRuntime()
    let requests = 0
    const options = {
      key,
      conflictKey: key,
      pending: key.startsWith('save-') ? 'Saving draft...' : 'Signing in...',
      success: 'Completed.',
      error: 'Request failed.',
      action: async () => {
        requests += 1
        if (requests === 1) throw new Error('failure')
      },
    }

    await runMutationAction(options, state.runtime)
    assert.equal(state.pending.has(key), false)
    assert.deepEqual(state.feedback.at(-1), { tone: 'error', title: 'Request failed.' })
    assert.equal(feedbackAutoDismissDelay(state.feedback.at(-1)!, 3000), null)
    await runMutationAction(options, state.runtime)
    assert.equal(requests, 2)
  })
}

test('post-publish refresh failure preserves publication without republishing', async () => {
  let publishes = 0
  let markedPublished = false
  let appliedContext = false

  await assert.rejects(publishContentAndRefresh({
    publish: async () => {
      publishes += 1
      return { id: 'published-revision' }
    },
    markPublished: () => { markedPublished = true },
    createNextDraft: async () => undefined,
    loadEditorContext: async () => { throw new Error('context refresh failed') },
    applyEditorContext: () => { appliedContext = true },
  }), ContentPublishedRefreshError)

  assert.equal(publishes, 1)
  assert.equal(markedPublished, true)
  assert.equal(appliedContext, false)
})

for (const [key, pendingMessage] of [
  ['create', 'Creating release candidate...'],
  ['validate-release', 'Validating release...'],
  ['activate-release', 'Activating release...'],
  ['rollback-release', 'Rolling back release...'],
] as const) {
  test(`mocked ${key} release action leaves its pending state after settling`, async () => {
    const state = createMutationRuntime()
    await runMutationAction({
      key,
      conflictKey: 'release-mutation',
      pending: pendingMessage,
      success: 'Release action completed.',
      action: async () => undefined,
    }, state.runtime)

    assert.equal(state.pending.has(key), false)
    assert.equal(state.gate.isPending('release-mutation'), false)
  })
}
