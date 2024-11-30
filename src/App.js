// client/src/App.js

import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';

import Login from './frontend/components/Login';
import SignUp from './frontend/components/SignUp';
import LandingPage from './frontend/components/LandingPage';
import DashboardContainer from './frontend/components/DashboardContainer';
import Canvas from './frontend/components/Canvas';

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<LandingPage />} />

        {/* Login and SignUp pages */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Dashboard page */}
        <Route 
          path="/dashboard" 
          element={<DashboardContainer />} 
        />

        {/* Boards page with toolbar, canvas */}
        <Route 
          path="/boards/:boardId" 
          element={<Canvas />} 
        />

        {/* Redirect all unknown routes to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
