

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import App              from './App';


import './index.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error(
    '[main.tsx] Fatal: Could not find the #root DOM element. ' +
    'Ensure index.html contains <div id="root"></div>.'
  );
}


const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>

    <BrowserRouter>
   
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);