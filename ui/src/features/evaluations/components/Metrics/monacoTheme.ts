// Monaco editor custom theme for OpenTracy interface
// Monaco editor requires hex color values -- CSS variables are not supported.
// These hex values correspond to semantic tokens defined in src/index.css.
import type { Monaco } from '@monaco-editor/react';

export const OPENTRACY_MONACO_THEME = {
  base: 'vs-dark' as const,
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#0a0a0a', // --color-background
    'editor.foreground': '#ededed', // --color-foreground
    'editorLineNumber.foreground': '#666666', // --color-foreground-muted
    'editorLineNumber.activeForeground': '#a1a1a1', // --color-foreground-secondary
    'editorCursor.foreground': '#ededed', // --color-accent
    'editor.selectionBackground': '#ededed40', // accent 25% opacity
    'editor.inactiveSelectionBackground': '#ededed20',
    'editor.lineHighlightBackground': '#111111', // --color-surface
    'editor.lineHighlightBorder': '#00000000', // transparent
    'editor.wordHighlightBackground': '#ededed20',
    'editor.findMatchBackground': '#ededed60',
    'editor.findMatchHighlightBackground': '#ededed30',
    'editorWidget.background': '#111111', // --color-surface
    'editorWidget.border': '#262626', // --color-border
    'editorWidget.foreground': '#ededed', // --color-foreground
    'editorSuggestWidget.background': '#111111',
    'editorSuggestWidget.border': '#262626',
    'editorSuggestWidget.selectedBackground': '#1c1c1c', // --color-surface-hover
    'scrollbarSlider.background': '#26262680',
    'scrollbarSlider.hoverBackground': '#333333', // --color-border-hover
    'editorError.foreground': '#888888', // --color-error
    'editorWarning.foreground': '#888888', // --color-warning
    'editorInfo.foreground': '#ededed', // --color-accent
  },
};

export const handleEditorWillMount = (monaco: Monaco) => {
  monaco.editor.defineTheme('opentracy-dark', OPENTRACY_MONACO_THEME);
};
