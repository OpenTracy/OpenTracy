export interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export interface CodeBlockToolbarProps {
  code: string;
  language?: string;
}

export interface UseCopyToClipboardReturn {
  copied: boolean;
  copy: (text: string) => Promise<void>;
}
