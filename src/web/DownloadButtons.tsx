import { FaApple, FaWindows } from "react-icons/fa";

import { Button } from "./Button";
import { isMacOs, isWindows } from "react-device-detect";
import { useEffect, useState } from "react";

type Download = {
  id: string;
  href: string;
  children: React.ReactNode;
};

const macDownload: Download = {
  id: "download-mac",
  href: "https://gettoolbase.ai/releases/mac-download?id=website",
  children: (
    <>
      <FaApple className="mr-2 h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
      Download macOS (Apple Silicon)
    </>
  ),
};

const macIntelDownload: Download = {
  id: "download-mac-intel",
  href: "https://gettoolbase.ai/releases/mac-intel-download?id=website",
  children: (
    <>
      <FaApple className="mr-2 h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
      Download macOS (Intel)
    </>
  ),
};

const windowsDownload: Download = {
  id: "download-windows",
  href: "https://gettoolbase.ai/releases/windows-download?id=website",
  children: (
    <>
      <FaWindows className="mr-2 h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
      Download Windows (x64)
    </>
  ),
};

export function DownloadButtons() {
  const [operatingSystem, setOperatingSystem] = useState<
    "Mac" | "Windows" | undefined
  >(undefined);

  useEffect(() => {
    if (isMacOs) {
      setOperatingSystem("Mac");
    } else if (isWindows) {
      setOperatingSystem("Windows");
    } else {
      setOperatingSystem(undefined);
    }
  }, []);

  let downloadButtons = [macDownload, macIntelDownload, windowsDownload];

  if (operatingSystem === "Windows") {
    downloadButtons = [windowsDownload, macDownload, macIntelDownload];
  }

  return (
    <div className="flex flex-col items-center gap-3 mb-3">
      {downloadButtons.map((button, idx) => (
        <Button
          key={button.id}
          asChild={true}
          size="lg"
          className="group w-full sm:w-auto"
          variant={idx !== 0 ? "outline" : undefined}
        >
          <a id={button.id} href={button.href}>
            {button.children}
          </a>
        </Button>
      ))}
    </div>
  );
}
