import { Toaster } from 'react-hot-toast';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">
        {children}
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            style: { background: '#1f2937', color: '#fff', border: '1px solid #374151' }
          }} 
        />
      </body>
    </html>
  );
}