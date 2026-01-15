
import React from 'https://esm.sh/react@^19.2.3';
import ReactDOM from 'https://esm.sh/react-dom@^19.2.3/client';
import { BrowserRouter } from 'https://esm.sh/react-router-dom@^6.22.3';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
