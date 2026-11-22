/**
 * Structured data (schema.org JSON-LD), rendered on the server as a data block — no
 * dangerouslySetInnerHTML: React writes a <script> child as raw text (and escapes "</script"), and
 * "<" is escaped here as well, so the JSON can never close the tag.
 */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json">{JSON.stringify(data).replace(/</g, '\u003c')}</script>;
}
