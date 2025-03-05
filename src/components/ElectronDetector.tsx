import { useEffect, useState } from 'react';

export default function ElectronDetector() {
  const [isElectron, setIsElectron] = useState(false);
  const [versions, setVersions] = useState<{
    node: string;
    chrome: string;
    electron: string;
  } | null>(null);

  useEffect(() => {
    // Check if running in Electron
    if (window.electron) {
      setIsElectron(true);
      setVersions({
        node: window.electron.node(),
        chrome: window.electron.chrome(),
        electron: window.electron.electron()
      });
    }
  }, []);

  if (!isElectron) return <p>Running in browser</p>;

  return (
    <div>
      <p>Running in Electron</p>
      {versions && (
        <ul>
          <li>Node: {versions.node}</li>
          <li>Chrome: {versions.chrome}</li>
          <li>Electron: {versions.electron}</li>
        </ul>
      )}
    </div>
  );
} 