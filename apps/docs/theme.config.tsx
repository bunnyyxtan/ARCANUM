import type { DocsThemeConfig } from "nextra-theme-docs";

const config: DocsThemeConfig = {
  logo: (
    <span className="flex items-center gap-2">
      <img src="/brand/arcanum-mark.png" alt="Arcanum" width="24" height="24" />
      <span style={{ fontWeight: 800, letterSpacing: "0.18em" }}>ARCANUM</span>
    </span>
  ),
  project: {
    link: "https://github.com/bunnyyxtan/ARCANUM",
  },
  docsRepositoryBase: "https://github.com/bunnyyxtan/ARCANUM",
  footer: {
    content: "Arcanum Protocol - MIT Licensed - Built on Arc",
  },
};

export default config;
