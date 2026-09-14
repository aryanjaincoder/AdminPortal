import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Import necessary components
import { AuthProvider } from './components/AuthProvider';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveSession from './pages/LiveSession';
import NFCSession from './pages/NFCSession';
import SoundSession from './pages/SoundSession';
// --- Import the Reports page ---
import Reports from './pages/Reports';
import AuditLog from './pages/AuditLog';

// Import CSS (assuming it exists now)
import './App.css';
import FaceRegistrationPage from './pages/faceRegistration';

function App() {
  return (
    // // AuthProvider wraps the app to provide authentication context
    <AuthProvider>
      <Routes>
        {/* Public Route: Only accessible when logged out */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes: Only accessible when logged in */}
        {/* Default route redirects to Dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Dashboard route */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Live session route with dynamic sessionId */}
        <Route
          path="/session/:sessionId"
          element={
            <ProtectedRoute>
              <LiveSession />
            </ProtectedRoute>
          }
        />
        {/* NFC session route with dynamic sessionId */}
        <Route
          path="/nfc-session/:sessionId"
          element={
            <ProtectedRoute>
              <NFCSession />
            </ProtectedRoute>
          }
        />
        {/* Sound session route with dynamic sessionId */}
        <Route
          path="/sound-session/:sessionId"
          element={
            <ProtectedRoute>
              <SoundSession />
            </ProtectedRoute>
          }
        />
        {/* --- Added Route for Reports Page --- */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        {/* --- Added Route for AuditLog Page --- */}
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute>
              <AuditLog />
            </ProtectedRoute>
          }
        />
         {/* --- Add a catch-all or 404 route if needed --- */}
         {/* <Route path="*" element={<NotFound />} /> */}
      </Routes>
    </AuthProvider>
    //<FaceRegistrationPage/>
  );
}

export default App;