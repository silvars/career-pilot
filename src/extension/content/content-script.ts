import type { ExtensionMessage, ExtensionResponse, PageContext } from "../messaging/messages.js";
import type { RawElement, RawPageMaterials } from "../job-extraction/types.js";

/**
 * FASE 3 shell only (SDD section 9): confirms the script is loaded and
 * reports basic page metadata. No job-description extraction, no form
 * access — that belongs to FASE 4+.
 */
function getPageContext(): PageContext {
  return { url: window.location.href, title: document.title };
}

const NOISE_SELECTOR = "nav, header, footer, script, style, noscript, form, iframe";
const CONTENT_SELECTOR = "h1, h2, h3, h4, h5, h6, p, li";

function metaContent(selector: string): string | undefined {
  return document.querySelector(selector)?.getAttribute("content") ?? undefined;
}

/**
 * Collects plain, JSON-serializable materials for the pure extraction
 * pipeline (SDD section 9) — never passes raw HTML across the messaging
 * boundary. This is the only DOM-touching part of FASE 4's extraction; all
 * grouping/normalization/limit logic lives in
 * `src/extension/job-extraction/extractor.ts` and is unit-tested there
 * without a real DOM (decision 1.1).
 */
export function collectRawMaterials(): RawPageMaterials {
  const bodyClone = document.body.cloneNode(true) as HTMLElement;
  bodyClone.querySelectorAll(NOISE_SELECTOR).forEach((el) => el.remove());

  const elements: RawElement[] = Array.from(bodyClone.querySelectorAll(CONTENT_SELECTOR)).map((el) => ({
    tag: el.tagName as RawElement["tag"],
    text: (el.textContent ?? "").trim(),
  }));

  const jsonLdTexts = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
    (el) => el.textContent ?? ""
  );

  return {
    url: window.location.href,
    documentTitle: document.title,
    canonicalUrl: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? undefined,
    metaDescription: metaContent('meta[name="description"]'),
    ogTitle: metaContent('meta[property="og:title"]'),
    jsonLdTexts,
    elements,
    visibleText: bodyClone.innerText ?? bodyClone.textContent ?? "",
  };
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: ExtensionResponse) => void) => {
    switch (message?.type) {
      case "PING_CONTENT_SCRIPT":
        sendResponse({ success: true, data: { alive: true } });
        return false;
      case "GET_PAGE_CONTEXT":
        sendResponse({ success: true, data: getPageContext() });
        return false;
      case "EXTRACT_JOB_PAGE":
        sendResponse({ success: true, data: collectRawMaterials() });
        return false;
      default:
        // Not a message this content script handles — ignore (fail safely).
        return false;
    }
  }
);
