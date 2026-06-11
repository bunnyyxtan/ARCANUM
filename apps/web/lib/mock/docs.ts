export type DocEntry = {
  id: string;
  title: string;
  description: string;
  href: string;
};

export const mockDocs: DocEntry[] = [
  {
    id: "doc-1",
    title: "Architecture",
    description: "Overview of ARCANUM's smart contracts and relayer system.",
    href: "/docs/architecture",
  },
  {
    id: "doc-2",
    title: "Self-Hosting",
    description: "Guide to running the ARCANUM indexer and API on your own infrastructure.",
    href: "/docs/self-host",
  },
  {
    id: "doc-3",
    title: "SDK Reference",
    description: "API references for the TypeScript and Python SDKs.",
    href: "/docs/sdk",
  },
];
