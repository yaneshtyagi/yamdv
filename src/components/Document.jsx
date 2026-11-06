import React, {
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { metadata } from "../markdown";
import Diagram from "./Diagram";
import { resolveRelative } from "../library";
import { resolveImage } from "../services/files";
export default function Document({ tab, theme, onLink, onScroll }) {
  const root = useRef();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.scrollTop = tab.scroll || 0;
  }, [tab.id]);
  useEffect(() => {
    if (!tab.target || !root.current) return;
    const timer = setTimeout(() => {
      const target = tab.target;
      const article = root.current.querySelector("article");
      article
        .querySelectorAll(".search-hit")
        .forEach((n) => n.classList.remove("search-hit"));
      let el;
      if (target.heading)
        el = article.querySelector("#" + CSS.escape(target.heading));
      else if (target.line) {
        const candidates = [
          ...article.querySelectorAll("[data-source-start]"),
        ].filter(
          (n) =>
            Number(n.dataset.sourceStart) <= target.line &&
            Number(n.dataset.sourceEnd) >= target.line,
        );
        el = candidates.sort(
          (a, b) =>
            Number(a.dataset.sourceEnd) -
            Number(a.dataset.sourceStart) -
            (Number(b.dataset.sourceEnd) - Number(b.dataset.sourceStart)),
        )[0];
      }
      if (el) {
        el.classList.add("search-hit");
        el.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [tab.target, tab.content]);

  return (
    <div
      ref={root}
      className="document-scroll"
      onScroll={(e) => onScroll(e.currentTarget.scrollTop)}
    >
      <ReaderContext.Provider value={{ file: tab.file, theme, onLink }}>
        <article className="markdown-body" style={{ zoom: tab.zoom }}>
          <Markdown
            skipHtml
            remarkPlugins={[remarkGfm, remarkMath, metadata]}
            rehypePlugins={[
              [
                rehypeKatex,
                {
                  throwOnError: false,
                  trust: false,
                  strict: "warn",
                  maxExpand: 1000,
                  maxSize: 20,
                },
              ],
            ]}
            urlTransform={(url) =>
              /^(?:javascript|vbscript|file):/i.test(url)
                ? ""
                : defaultUrlTransform(url)
            }
            components={components}
          >
            {tab.content}
          </Markdown>
        </article>
      </ReaderContext.Provider>
    </div>
  );
}

function LocalImage({ file, src, alt }) {
  const [url, setURL] = useState(null);
  useEffect(() => {
    let canceled = false;
    setURL(null);
    if (!src) return;
    if (/^(https?:|blob:)/i.test(src)) {
      setURL(src);
      return;
    }
    if (file) {
      resolveImage(file, resolveRelative(file.path || file.relative, src))
        .then((value) => {
          if (!canceled) setURL(value);
        })
        .catch(() => {});
    }
    return () => {
      canceled = true;
    };
  }, [file?.id, file?.rootId, file?.path, src]);
  return url ? (
    <img src={url} alt={alt} loading="lazy" />
  ) : (
    <span className="missing-image">Image unavailable: {alt || src}</span>
  );
}

const ReaderContext = createContext(null);
function MarkdownLink({ href, children }) {
  const { onLink } = useContext(ReaderContext);
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onLink(href, e.metaKey || e.ctrlKey || e.shiftKey);
      }}
    >
      {children}
    </a>
  );
}
function MarkdownImage({ src, alt }) {
  const { file } = useContext(ReaderContext);
  return <LocalImage file={file} src={src} alt={alt} />;
}
function MarkdownPre({ children, node, ...props }) {
  const { theme } = useContext(ReaderContext);
  const child = React.Children.toArray(children)[0];
  if (
    React.isValidElement(child) &&
    child.props.className === "language-mermaid"
  )
    return (
      <Diagram
        source={String(child.props.children).replace(/\n$/, "")}
        theme={theme}
      />
    );
  return <pre {...props}>{children}</pre>;
}
const components = { a: MarkdownLink, img: MarkdownImage, pre: MarkdownPre };
