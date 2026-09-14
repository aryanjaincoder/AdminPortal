import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // <-- YEH BAHUT ZAROORI HAI
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* BrowserRouter ko App ke baahar hona chahiye */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

