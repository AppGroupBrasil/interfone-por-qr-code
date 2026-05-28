import DOMPurify from "dompurify";

export function safeHtml(html: string | null | undefined): { __html: string } {
  return { __html: DOMPurify.sanitize(html ?? "") };
}
