export type {
  DocCategory,
  DocHeading,
  DocLinkCheck,
  DocNavTree,
  DocPage,
  DocSearchHit,
} from './types';
export {
  buildDocPage,
  buildNavTree,
  categoryIdFromPath,
  categoryLabel,
  defaultDocSlug,
  extractHeadings,
  extractTitle,
  pathToSlug,
  slugifyHeading,
  toSearchText,
} from './discover';
export {
  extractRelativeMdHrefs,
  findBrokenDocLinks,
  isDocsCorpusHref,
  isExternalHref,
  resolveDocHref,
  resolveDocImageSrc,
} from './links';
export {
  highlightMatches,
  highlightSegments,
  searchDocs,
  tokenizeQuery,
} from './search';
export { highlightCode } from './highlight';
export { parseDocMarkdown, stripInlineToText } from './parseDocMarkdown';
export type { DocMdBlock, DocMdInline } from './parseDocMarkdown';
export {
  DOC_CORPUS,
  getDefaultDocSlug,
  getDocTree,
  resetDocTreeCache,
} from './catalog';
export {
  DOCS_COMMANDS,
  registerDocsCommands,
  type DocsCommand,
  type DocsCommandHandlers,
  type DocsCommandId,
} from './commands';
