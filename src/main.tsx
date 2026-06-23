import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './theme/index.css';

// SignalLens uses the light security-console theme (tokens defined on :root).
document.documentElement.dataset.theme = 'light';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
