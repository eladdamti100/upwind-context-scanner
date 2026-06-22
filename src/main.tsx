import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// SignalLens ships dark-theme only (matches the Upwind console design).
document.documentElement.dataset.theme = 'dark';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
