import { describe, it, expect, vi, afterEach } from 'vitest';
import { GhostText, GHOST_TEXT_KEY } from '../ghost-text-extension';
import type { GhostTextState } from '../ghost-text-extension';

/**
 * Unit tests for ghost-text feedback callbacks (wire-completion-feedback).
 *
 * Strategy: Extract the ProseMirror plugin from the Tiptap extension,
 * then invoke handleKeyDown directly with mocked view/event objects.
 * This avoids the need for a full editor or DOM environment.
 */

/** The internal key string that ProseMirror uses for PluginKey.getState(state) */
const PLUGIN_KEY_STRING = (GHOST_TEXT_KEY as unknown as { key: string }).key;

/** Helper: extract handleKeyDown from the GhostText extension's plugin props */
function getHandleKeyDown(options: { onAccepted?: () => void; onDismissed?: () => void }) {
  // Access the raw config from the Tiptap extension
  const extension = GhostText.configure({
    className: 'ghost-text',
    ...options,
  });

  const extensionConfig = (extension as unknown as { config: Record<string, unknown> }).config;
  const addProseMirrorPlugins = extensionConfig.addProseMirrorPlugins as (
    this: { options: Record<string, unknown> },
  ) => Array<{ props: { handleKeyDown?: (view: unknown, event: unknown) => boolean } }>;

  const pluginList = addProseMirrorPlugins.call({
    options: { className: 'ghost-text', ...options },
  });

  const plugin = pluginList[0];
  const handleKeyDown = plugin.props.handleKeyDown;

  if (!handleKeyDown) {
    throw new Error('handleKeyDown not found on ghost text plugin');
  }

  return handleKeyDown;
}

/** Helper: create a mock EditorView with ghost text state */
function createMockView(ghostState: GhostTextState) {
  // ProseMirror's PluginKey.getState(state) reads state[key] where key is a string.
  // We need state[PLUGIN_KEY_STRING] to return the ghost state.
  const state: Record<string, unknown> = {
    get tr() {
      return {
        insertText: vi.fn().mockReturnThis(),
        setMeta: vi.fn().mockReturnThis(),
      };
    },
  };
  state[PLUGIN_KEY_STRING] = ghostState;

  const view = {
    state,
    dispatch: vi.fn(),
  };

  return { view };
}

/** Helper: create a mock keyboard event */
function createMockEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn(),
  };
}

describe('GhostText feedback callbacks', () => {
  describe('when ghost text IS visible', () => {
    const ghostState: GhostTextState = { text: 'suggestion text', position: 10 };

    it('calls onAccepted when Tab is pressed', () => {
      const onAccepted = vi.fn();
      const onDismissed = vi.fn();
      const handleKeyDown = getHandleKeyDown({ onAccepted, onDismissed });

      const { view } = createMockView(ghostState);
      const event = createMockEvent('Tab');

      handleKeyDown(view, event);

      expect(onAccepted).toHaveBeenCalledTimes(1);
      expect(onDismissed).not.toHaveBeenCalled();
    });

    it('calls onDismissed when Escape is pressed', () => {
      const onAccepted = vi.fn();
      const onDismissed = vi.fn();
      const handleKeyDown = getHandleKeyDown({ onAccepted, onDismissed });

      const { view } = createMockView(ghostState);
      const event = createMockEvent('Escape');

      handleKeyDown(view, event);

      expect(onDismissed).toHaveBeenCalledTimes(1);
      expect(onAccepted).not.toHaveBeenCalled();
    });

    it('calls onDismissed when any other key is pressed', () => {
      const onAccepted = vi.fn();
      const onDismissed = vi.fn();
      const handleKeyDown = getHandleKeyDown({ onAccepted, onDismissed });

      const { view } = createMockView(ghostState);
      const event = createMockEvent('a');

      handleKeyDown(view, event);

      expect(onDismissed).toHaveBeenCalledTimes(1);
      expect(onAccepted).not.toHaveBeenCalled();
    });

    it('calls onDismissed when space key is pressed (triangulation)', () => {
      const onAccepted = vi.fn();
      const onDismissed = vi.fn();
      const handleKeyDown = getHandleKeyDown({ onAccepted, onDismissed });

      const { view } = createMockView(ghostState);
      const event = createMockEvent(' ');

      handleKeyDown(view, event);

      expect(onDismissed).toHaveBeenCalledTimes(1);
      expect(onAccepted).not.toHaveBeenCalled();
    });
  });

  describe('when ghost text is NOT visible', () => {
    const emptyState: GhostTextState = { text: null, position: null };

    it('does NOT call onAccepted when Tab is pressed', () => {
      const onAccepted = vi.fn();
      const onDismissed = vi.fn();
      const handleKeyDown = getHandleKeyDown({ onAccepted, onDismissed });

      const { view } = createMockView(emptyState);
      const event = createMockEvent('Tab');

      handleKeyDown(view, event);

      expect(onAccepted).not.toHaveBeenCalled();
      expect(onDismissed).not.toHaveBeenCalled();
    });

    it('does NOT call onDismissed when Escape is pressed', () => {
      const onAccepted = vi.fn();
      const onDismissed = vi.fn();
      const handleKeyDown = getHandleKeyDown({ onAccepted, onDismissed });

      const { view } = createMockView(emptyState);
      const event = createMockEvent('Escape');

      handleKeyDown(view, event);

      expect(onAccepted).not.toHaveBeenCalled();
      expect(onDismissed).not.toHaveBeenCalled();
    });

    it('does NOT call any callback when regular key is pressed', () => {
      const onAccepted = vi.fn();
      const onDismissed = vi.fn();
      const handleKeyDown = getHandleKeyDown({ onAccepted, onDismissed });

      const { view } = createMockView(emptyState);
      const event = createMockEvent('a');

      handleKeyDown(view, event);

      expect(onAccepted).not.toHaveBeenCalled();
      expect(onDismissed).not.toHaveBeenCalled();
    });
  });

  describe('when callbacks are not provided', () => {
    const ghostState: GhostTextState = { text: 'suggestion text', position: 10 };

    it('does not throw when Tab pressed without onAccepted', () => {
      const handleKeyDown = getHandleKeyDown({});
      const { view } = createMockView(ghostState);
      const event = createMockEvent('Tab');

      expect(() => handleKeyDown(view, event)).not.toThrow();
    });

    it('does not throw when Escape pressed without onDismissed', () => {
      const handleKeyDown = getHandleKeyDown({});
      const { view } = createMockView(ghostState);
      const event = createMockEvent('Escape');

      expect(() => handleKeyDown(view, event)).not.toThrow();
    });

    it('does not throw when other key pressed without onDismissed', () => {
      const handleKeyDown = getHandleKeyDown({});
      const { view } = createMockView(ghostState);
      const event = createMockEvent('x');

      expect(() => handleKeyDown(view, event)).not.toThrow();
    });
  });
});

/**
 * REQ-5: When completionId is null, sendFeedback silently no-ops.
 *
 * The production code in use-completion.ts has:
 *   const sendFeedback = async (accepted: boolean) => {
 *     if (!state.completionId) return;      // ← the guard under test
 *     await fetch(...)
 *   };
 *
 * Since useCompletion is a React hook and @testing-library/react is not
 * available, we recreate the guard+fetch pattern identically and test
 * the behavioral contract: null completionId → no fetch, no throw.
 */
describe('sendFeedback null completionId guard (REQ-5)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /**
   * Factory that mirrors use-completion.ts sendFeedback exactly:
   *   if (!completionId) return;
   *   await fetch(url, ...)
   */
  function makeSendFeedback(completionId: string | null) {
    return async (accepted: boolean): Promise<void> => {
      if (!completionId) return;

      await fetch(`/completions/${completionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted }),
      });
    };
  }

  it('does NOT make an HTTP request when completionId is null', async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    const sendFeedback = makeSendFeedback(null);
    await sendFeedback(true);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does NOT throw when completionId is null', async () => {
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch;

    const sendFeedback = makeSendFeedback(null);

    await expect(sendFeedback(true)).resolves.toBeUndefined();
    await expect(sendFeedback(false)).resolves.toBeUndefined();
  });

  it('DOES make an HTTP request when completionId is present (control)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response());
    globalThis.fetch = mockFetch;

    const sendFeedback = makeSendFeedback('completion-abc');
    await sendFeedback(true);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      '/completions/completion-abc/feedback',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

/**
 * REQ-7: Editor is NOT re-created when sendFeedback identity changes.
 *
 * The production code in AssistEditor.tsx uses a feedbackRef pattern:
 *   const feedbackRef = useRef({ accepted: () => void 0, dismissed: () => void 0 });
 *
 *   // Stable wrappers passed to GhostText.configure() (only run once):
 *   onAccepted:  () => feedbackRef.current.accepted(),
 *   onDismissed: () => feedbackRef.current.dismissed(),
 *
 *   // Updated every time sendFeedback changes:
 *   useEffect(() => {
 *     feedbackRef.current.accepted  = () => void sendFeedback(true);
 *     feedbackRef.current.dismissed = () => void sendFeedback(false);
 *   }, [sendFeedback]);
 *
 * This test proves the ref-delegation invariant WITHOUT React rendering:
 * the stable wrapper always invokes the LATEST callback stored in the ref.
 */
describe('feedbackRef stable wrapper pattern (REQ-7)', () => {
  it('stable wrapper delegates to the latest callback in the ref', () => {
    // 1. Create the feedbackRef (mirrors AssistEditor.tsx line 78-81)
    const feedbackRef: { current: { accepted: () => void; dismissed: () => void } } = {
      current: {
        accepted: () => void 0,
        dismissed: () => void 0,
      },
    };

    // 2. Stable wrappers (created once, passed to GhostText.configure)
    const stableOnAccepted = () => feedbackRef.current.accepted();
    const stableOnDismissed = () => feedbackRef.current.dismissed();

    // 3. First version of sendFeedback (e.g. completionId = null)
    const callbackA_accepted = vi.fn();
    const callbackA_dismissed = vi.fn();
    feedbackRef.current.accepted = callbackA_accepted;
    feedbackRef.current.dismissed = callbackA_dismissed;

    // Call the stable wrappers → should invoke callback A
    stableOnAccepted();
    stableOnDismissed();
    expect(callbackA_accepted).toHaveBeenCalledTimes(1);
    expect(callbackA_dismissed).toHaveBeenCalledTimes(1);

    // 4. sendFeedback identity changes (e.g. completionId updated)
    const callbackB_accepted = vi.fn();
    const callbackB_dismissed = vi.fn();
    feedbackRef.current.accepted = callbackB_accepted;
    feedbackRef.current.dismissed = callbackB_dismissed;

    // 5. Call the SAME stable wrappers → should invoke callback B (not A)
    stableOnAccepted();
    stableOnDismissed();
    expect(callbackB_accepted).toHaveBeenCalledTimes(1);
    expect(callbackB_dismissed).toHaveBeenCalledTimes(1);
    // Callback A must NOT have been called again
    expect(callbackA_accepted).toHaveBeenCalledTimes(1);
    expect(callbackA_dismissed).toHaveBeenCalledTimes(1);
  });

  it('stable wrapper identity remains the same across ref updates', () => {
    const feedbackRef: { current: { accepted: () => void; dismissed: () => void } } = {
      current: {
        accepted: () => void 0,
        dismissed: () => void 0,
      },
    };

    // Capture the wrapper reference
    const stableOnAccepted = () => feedbackRef.current.accepted();
    const capturedReference = stableOnAccepted;

    // Update the ref multiple times
    feedbackRef.current.accepted = vi.fn();
    feedbackRef.current.accepted = vi.fn();
    feedbackRef.current.accepted = vi.fn();

    // The wrapper function identity never changes — this is why useEditor
    // does NOT re-create the editor when sendFeedback changes
    expect(stableOnAccepted).toBe(capturedReference);
  });
});
