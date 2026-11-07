import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../../packages/theme/theme.css';
import './app.css';
import App from './App.jsx';
import { ToastHost } from '../../../packages/toast.jsx';

createRoot(document.getElementById('root')).render(
  <>
    <App />
    <ToastHost />
  </>
);
