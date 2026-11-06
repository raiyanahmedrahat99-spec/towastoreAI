import React from 'react';
import ChatWidget from './components/ChatWidget';

/**
 * Root App Component:
 * Clean, 100% transparent container that only renders the embeddable ChatWidget.
 * No full pages, no backgrounds, no watermarks, completely ready for website integration.
 */
export default function App() {
  return (
    <div className="w-full h-full">
      <ChatWidget />
    </div>
  );
}
