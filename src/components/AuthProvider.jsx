import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { auth } from '../firebase/config';
import { login as apiLogin, logout as apiLogout, getCurrentUser, handleApiError } from '../api/firebase';
import Loading from './Loading';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Get additional user data if needed
          const userData = await getCurrentUser();
          setUser({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            emailVerified: currentUser.emailVerified,
            ...userData
          });
        } catch (error) {
          console.error('Failed to get user data:', error);
          setUser(currentUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      setLoading(true);
      const response = await apiLogin(credentials);
      setUser(response.user);
      return response;
    } catch (error) {
      const errorMessage = error.message || 'Login failed';
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  // Refresh user data
  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  };

  // Check if user has specific role
  const hasRole = (role) => {
    return user?.role === role;
  };

  // Check if user is admin
  const isAdmin = () => {
    return hasRole('admin') || user?.email?.includes('admin');
  };

  // Check if user is student
  const isStudent = () => {
    return hasRole('student') || !isAdmin();
  };

  // Get user display name
  const getDisplayName = () => {
    return user?.displayName || user?.name || user?.email?.split('@')[0] || 'User';
  };

  // Get user email
  const getEmail = () => {
    return user?.email || '';
  };

  // Get user class (for students)
  const getUserClass = () => {
    return user?.class || '';
  };

  // Get attendance stats (for students)
  const getAttendanceStats = () => {
    return user?.attendanceStats || {
      overall: 0,
      month: 0,
      week: 0,
      streak: 0
    };
  };

  // Value object provided to context consumers
  const value = {
    // State
    user,
    loading,
    isAuthenticated: !!user,
    
    // Methods
    login,
    logout,
    refreshUser,
    
    // Utility methods
    hasRole,
    isAdmin,
    isStudent,
    getDisplayName,
    getEmail,
    getUserClass,
    getAttendanceStats,
    
    // Error handling
    handleApiError
  };

  // Show loading while checking authentication
  if (loading) {
    return <Loading />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
