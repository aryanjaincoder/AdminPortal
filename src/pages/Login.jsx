import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from '../components/AuthProvider';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth(); // Check karein kahin user pehle se logged in to nahin

  // Agar user pehle se logged in hai, to dashboard par bhej do
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard'); // Login ke baad dashboard par bhejo
    } catch (err) {
      console.error(err);
      setError('Failed to login. Check email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="form-container">
        <h2>Teacher/Admin Login</h2>
        <form onSubmit={handleLogin}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (admin@college.com)"
            className="form-input"
            required
          />
          <input
            type="password"
            value={password}
            // --- YAHAN PAR 'e.g.value' KO 'e.target.value' KAR DIYA HAI ---
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (password123)"
            className="form-input"
            required
          />
          <button type="submit" className="form-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          {error && <p className="error-text">{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default Login;

