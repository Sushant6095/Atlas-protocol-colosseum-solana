// /docs surface — Kamino-quality shell pieces.
//
// Layout consumes DocsTopNav + DocsSidebar + DocsTocRail.
// Pages consume DocPage / DocStub (which compose CopyPageButton +
// AskQuestionBar). Search is mounted inside DocsTopNav.

export { DocsTopNav } from "./DocsTopNav";
export { DocsSidebar } from "./DocsSidebar";
export { DocsTocRail } from "./DocsTocRail";
export { CopyPageButton } from "./CopyPageButton";
export { AskQuestionBar } from "./AskQuestionBar";
export { AskAiDrawer } from "./AskAiDrawer";
export { DocsSearch } from "./DocsSearch";
export { DocPage } from "./DocPage";
export { DocStub } from "./DocStub";
export { MobileSidebar } from "./MobileSidebar";

export {
  TABS, SIDEBAR, FLAT_ITEMS, tabForPath, itemForPath,
  type DocTab, type DocTabId, type DocSection, type DocItem,
} from "./nav";
