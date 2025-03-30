import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

function ElectronCommunication() {
  const [message, setMessage] = useState('');
  const [isElectron, setIsElectron] = useState(false);
  
  useEffect(() => {
    // Check if running in Electron
    setIsElectron(!!window.electron);
    
    if (window.electron) {
      // Listen for messages from main process
      window.electron.receive('fromMain', (data: string) => {
        setMessage(data);
      });
      
      // Send message to main process
      window.electron.send('toMain', 'Hello from Next.js!');
    }
  }, []);
  
  const sendMessage = () => {
    if (window.electron) {
      window.electron.send('toMain', 'Button clicked!');
    }
  };
  
  return (
    <div>
      <h1>Electron Communication</h1>
      {message ? (
        <p>Message from main process: {message}</p>
      ) : (
        <p>No messages received yet</p>
      )}
      <button 
        onClick={sendMessage}
        disabled={!isElectron}
      >
        Send Message to Main Process
      </button>
    </div>
  );
}

// Use dynamic import with no SSR to ensure this component only renders client-side
export default dynamic(() => Promise.resolve(ElectronCommunication), {
  ssr: false
}); 