import { useEffect, useState } from 'react';

export default function ElectronCommunication() {
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    // Check if running in Electron
    if (window.electron) {
      // Listen for messages from main process
      window.electron.receive('fromMain', (data: string) => {
        setMessage(data);
      });
      
      // Send message to main process
      window.electron.send('toMain', 'Hello from Next.js!');
    }
  }, []);
  
  return (
    <div>
      <h1>Electron Communication</h1>
      {message ? (
        <p>Message from main process: {message}</p>
      ) : (
        <p>No messages received yet</p>
      )}
      <button 
        onClick={() => window.electron?.send('toMain', 'Button clicked!')}
        disabled={!window.electron}
      >
        Send Message to Main Process
      </button>
    </div>
  );
} 