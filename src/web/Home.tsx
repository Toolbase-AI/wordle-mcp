import { useState } from "react";
import { Logo } from "./Logo";
import { DownloadButtons } from "./DownloadButtons";
import { Link } from "./Link";
import { Button } from "./Button";
import { IoCopyOutline, IoCheckmarkDoneOutline } from "react-icons/io5";
import { FaGithub } from "react-icons/fa";

const TABS = [
  {
    label: "Toolbase",
    children: <DownloadButtons />,
    description: "Download Toolbase to add the Wordle to local clients.",
  },
  {
    label: "Local",
    command: "npx mcp-remote https://wordle.gettoolbase.ai/mcp",
    description:
      "Use this command to connect to the Wordle MCP on local clients. You will be redirected to login when you first connect.",
  },
  {
    label: "Remote",
    command: "https://wordle.gettoolbase.ai/sse",
    description:
      "Use this URL to connect to the Wordle MCP via SSE. You will be redirected to login when you first connect.",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <Button onClick={copyToClipboard} className="cursor-pointer mt-4">
      {copied ? (
        <>
          <IoCheckmarkDoneOutline className="mr-2 h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
          Copied
        </>
      ) : (
        <>
          <IoCopyOutline className="mr-2 h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
          Copy
        </>
      )}
    </Button>
  );
}

export function Home() {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#F4E6C3]">
      <div className="container flex flex-col items-center mx-auto">
        <Logo className="mb-12 logo-animation" />
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-center">
          Wordle MCP
        </h1>
        <div className="flex flex-col items-center gap-4 mb-6">
          <h2 className="text-lg text-gray-600 mb-2">
            powered by{" "}
            <Link
              href="https://gettoolbase.ai"
              external
              className="hover:underline"
            >
              Toolbase
            </Link>
          </h2>

          <Link
            href="https://github.com/Toolbase-AI/wordle-mcp"
            external
            className="view-github-link inline-flex items-center gap-2"
          >
            <FaGithub className="h-5 w-5" />
            <span>GitHub</span>
          </Link>
        </div>
        <div className="w-full max-w-lg mx-auto bg-white rounded-2xl shadow-lg p-6 min-h-[320px]">
          <div className="flex mb-4 border-b border-accent-100">
            {TABS.map((tab, idx) => (
              <button
                key={tab.label}
                className={`cursor-pointer flex-1 py-2 text-sm font-medium focus:outline-none transition-colors ${
                  activeTab === idx
                    ? "text-primary"
                    : "border-transparent text-gray-400 hover:text-primary"
                }`}
                onClick={() => setActiveTab(idx)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col items-center">
            <span className="text-gray-500 text-xs mb-6">
              {TABS[activeTab].description}
            </span>
            {TABS[activeTab].children ? (
              TABS[activeTab].children
            ) : (
              <>
                <pre className="bg-gray-100 rounded px-4 py-2 text-sm font-mono text-gray-800 select-all w-full text-center whitespace-pre-wrap break-all">
                  {TABS[activeTab].command}
                </pre>
                <CopyButton text={TABS[activeTab].command} />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
