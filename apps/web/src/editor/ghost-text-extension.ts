import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Ghost Text extension for Tiptap (A-062).
 *
 * Renders suggested completion text inline as a grayed-out "ghost"
 * without corrupting the editor state. The ghost text is purely
 * decorative — it lives in the decoration layer, not the document.
 *
 * Supports:
 * - Tab to accept (inserts the suggestion into the document)
 * - Escape to dismiss
 * - Any other keypress dismisses the suggestion
 */

const GHOST_TEXT_KEY = new PluginKey('ghostText');

export interface GhostTextOptions {
  /** CSS class for the ghost text span */
  className: string;
  /** Called when the user accepts ghost text via Tab */
  onAccepted?: () => void;
  /** Called when the user dismisses ghost text via Escape or typing */
  onDismissed?: () => void;
}

export interface GhostTextState {
  text: string | null;
  position: number | null;
}

export const GhostText = Extension.create<GhostTextOptions>({
  name: 'ghostText',

  addOptions() {
    return {
      className: 'ghost-text',
      onAccepted: undefined,
      onDismissed: undefined,
    };
  },

  addStorage() {
    return {
      suggestion: null as string | null,
      position: null as number | null,
    };
  },

  addProseMirrorPlugins() {
    const { className, onAccepted, onDismissed } = this.options;

    return [
      new Plugin({
        key: GHOST_TEXT_KEY,

        state: {
          init(): GhostTextState {
            return { text: null, position: null };
          },

          apply(tr, prev): GhostTextState {
            // Check for ghost text metadata in the transaction
            const meta = tr.getMeta(GHOST_TEXT_KEY) as GhostTextState | undefined;
            if (meta !== undefined) {
              return meta;
            }

            // If the document changed (user typed), dismiss ghost text
            if (tr.docChanged) {
              return { text: null, position: null };
            }

            return prev;
          },
        },

        props: {
          decorations(state) {
            const pluginState = GHOST_TEXT_KEY.getState(state) as GhostTextState | undefined;

            if (!pluginState?.text || pluginState.position === null) {
              return DecorationSet.empty;
            }

            // Create an inline decoration (widget) at the cursor position
            const widget = Decoration.widget(
              pluginState.position,
              () => {
                const span = document.createElement('span');
                span.className = className;
                span.textContent = pluginState.text;
                span.style.opacity = '0.4';
                span.style.pointerEvents = 'none';
                span.style.userSelect = 'none';
                span.setAttribute('data-ghost', 'true');
                return span;
              },
              { side: 1 }, // Render after the cursor position
            );

            return DecorationSet.create(state.doc, [widget]);
          },

          handleKeyDown(view, event) {
            const pluginState = GHOST_TEXT_KEY.getState(view.state) as GhostTextState | undefined;

            if (!pluginState?.text || pluginState.position === null) {
              return false;
            }

            // Tab → accept the suggestion (A-063)
            if (event.key === 'Tab') {
              event.preventDefault();

              const { text, position } = pluginState;

              // Insert the ghost text into the document
              const tr = view.state.tr
                .insertText(text!, position!)
                .setMeta(GHOST_TEXT_KEY, { text: null, position: null });

              view.dispatch(tr);
              onAccepted?.();
              return true;
            }

            // Escape → dismiss without accepting (A-063)
            if (event.key === 'Escape') {
              event.preventDefault();

              const tr = view.state.tr.setMeta(GHOST_TEXT_KEY, {
                text: null,
                position: null,
              });
              view.dispatch(tr);
              onDismissed?.();
              return true;
            }

            // Any other key → dismiss (user is typing)
            const tr = view.state.tr.setMeta(GHOST_TEXT_KEY, {
              text: null,
              position: null,
            });
            view.dispatch(tr);
            onDismissed?.();
            return false; // Let the keypress through
          },
        },
      }),
    ];
  },
});

/**
 * Show ghost text at the current cursor position.
 * Call this from the completion handler when a suggestion arrives.
 *
 * Accepts any object with a ProseMirror-compatible `view` property.
 * Using a generic param type to avoid coupling to specific Editor types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function showGhostText(editor: any, text: string, position: number): void {
  const { view } = editor;
  const tr = view.state.tr.setMeta(GHOST_TEXT_KEY, { text, position });
  view.dispatch(tr);
}

/**
 * Clear any visible ghost text.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function clearGhostText(editor: any): void {
  const { view } = editor;
  const tr = view.state.tr.setMeta(GHOST_TEXT_KEY, { text: null, position: null });
  view.dispatch(tr);
}

export { GHOST_TEXT_KEY };
