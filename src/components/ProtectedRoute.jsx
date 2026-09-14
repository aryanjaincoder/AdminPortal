import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthProvider'; // Auth state check karein
import Loading from './Loading'; // Loading component import karein

// Yeh component check karega ki user logged in hai ya nahin
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <Loading />; // Agar auth check ho raha hai to loading dikhao
  }

  if (!user) {
    // Agar user logged in nahin hai, to login page par bhej do
    return <Navigate to="/login" replace />;
  }

  // Agar logged in hai, to child component (Dashboard/LiveSession) dikhao
  return children;
};

export default ProtectedRoute;
