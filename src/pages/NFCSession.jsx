import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  getSession, 
  getSessionAttendance, 
  verifyAttendance, 
  closeSession, 
  pauseSession,
  generateNewToken,
  handleApiError 
} from '../api/firebase';
import './LiveSession.css';

// Token Countdown Component
const TokenCountdown = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calculateTimeLeft = () => {
      if (!expiresAt) return 'N/A';
      
      const now = new Date();
      const expires = new Date(expiresAt);
      const difference = expires - now;

      if (difference > 0) {
        const seconds = Math.floor(difference / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      }
      return 'Expired';
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  return <span className="countdown">{timeLeft}</span>;
};

// Format time function for NFC Session
const formatTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  try {
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'N/A';
  }
};

function NFCSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Core States
  const [sessionData, setSessionData] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [currentToken, setCurrentToken] = useState(null);
  const [stats, setStats] = useState({
    present: 0,
    total: 0,
    percentage: 0
  });

  // Polling refs
  const pollingRef = useRef(null);
  const tokenRefreshRef = useRef(null);

  // Fetch session data
  const fetchSessionData = async () => {
    try {
      const response = await getSession(sessionId);
      setSessionData(response.session);
      
      // Update token
      if (response.session?.sessionToken) {
        setCurrentToken(response.session.sessionToken);
      }
      
      // Check pause status
      setIsPaused(response.session?.status === 'paused');
      
    } catch (error) {
      console.error('Failed to fetch session:', error);
      handleApiError(error);
    }
  };

  // Fetch attendance data
  const fetchAttendanceData = async () => {
    try {
      const response = await getSessionAttendance(sessionId);
      console.log('📱 [NFCSession] Attendance response:', response);
      
      const attendanceData = response?.attendance || [];
      console.log('📱 [NFCSession] Processed attendance data:', attendanceData);
      
      setAttendees(attendanceData);
      
      // Update stats
      const presentCount = attendanceData.length; // All fetched attendees are present
      const totalCount = sessionData?.totalStudents || attendanceData.length;
      
      setStats({
        present: presentCount,
        total: totalCount,
        percentage: totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0
      });
      
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const initializeSession = async () => {
      setLoading(true);
      await fetchSessionData();
      setLoading(false);
    };

    if (sessionId) {
      initializeSession();
    }
  }, [sessionId]);

  // Set up polling for attendance updates
  useEffect(() => {
    if (sessionData && !loading) {
      // Initial attendance fetch
      fetchAttendanceData();
      
      // Set up polling for real-time updates
      pollingRef.current = setInterval(fetchAttendanceData, 3000); // Poll every 3 seconds
      
      // Set up token refresh (every 30 seconds)
      tokenRefreshRef.current = setInterval(async () => {
        if (!isPaused) {
          try {
            const response = await generateNewToken(sessionId);
            if (response.token) {
              setCurrentToken(response.token);
              await fetchSessionData(); // Refresh session data for new expiry
            }
          } catch (error) {
            console.error('Failed to refresh token:', error);
          }
        }
      }, 30000);
      
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (tokenRefreshRef.current) clearInterval(tokenRefreshRef.current);
      };
    }
  }, [sessionId, sessionData, loading, isPaused]);

  // Handle manual verification
  const handleManualVerify = async (studentId) => {
    try {
      await verifyAttendance(sessionId, {
        studentId,
        verificationMethod: 'manual',
        timestamp: new Date().toISOString()
      });
      
      // Refresh attendance data
      await fetchAttendanceData();
      
    } catch (error) {
      console.error('Manual verification failed:', error);
      alert('Failed to verify attendance manually');
    }
  };

  // Handle session pause/resume
  const handlePauseSession = async () => {
    try {
      await pauseSession(sessionId, !isPaused);
      setIsPaused(!isPaused);
      await fetchSessionData();
    } catch (error) {
      console.error('Failed to pause/resume session:', error);
      alert('Failed to pause/resume session');
    }
  };

  // Handle session close
  const handleCloseSession = async () => {
    if (window.confirm('Are you sure you want to close this session? This action cannot be undone.')) {
      try {
        await closeSession(sessionId);
        navigate('/dashboard');
      } catch (error) {
        console.error('Failed to close session:', error);
        alert('Failed to close session');
      }
    }
  };

  // Handle manual token refresh
  const handleRefreshToken = async () => {
    try {
      const response = await generateNewToken(sessionId);
      if (response.token) {
        setCurrentToken(response.token);
        await fetchSessionData();
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
      alert('Failed to refresh token');
    }
  };

  if (loading) {
    return (
      <div className="live-session-container">
        <div className="loading-state">
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <p className="loading-text">Loading NFC session...</p>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="live-session-container">
        <div className="error-state">
          <h2>Session Not Found</h2>
          <p>The requested session could not be found or may have been closed.</p>
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="live-session-container">
      {/* Header */}
      <div className="session-header">
        <div className="header-left">
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            ← Back
          </button>
          <div className="session-info">
            <h1>{sessionData.subject}</h1>
            <p>{sessionData.className} • NFC Mode</p>
          </div>
        </div>
        <div className="header-right">
          <span className={`status-badge ${isPaused ? 'paused' : 'active'}`}>
            {isPaused ? '⏸ Paused' : '🔴 Live'}
          </span>
        </div>
      </div>

      {/* Main Content - 2 Column Grid */}
      <div className="main-content-grid">
        
        {/* Left Column - NFC Card */}
        <div className="left-column">
          <div className="nfc-card">
            <div className="nfc-icon-wrapper">
              <div className="nfc-pulse-ring"></div>
              <div className="nfc-pulse-ring delay-1"></div>
              <div className="nfc-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                  <path d="M20 12C20 7.58 16.42 4 12 4V2C17.52 2 22 6.48 22 12H20Z" fill="#4F46E5"/>
                  <path d="M17 12C17 9.24 14.76 7 12 7V5C15.87 5 19 8.13 19 12H17Z" fill="#4F46E5" opacity="0.7"/>
                  <path d="M14 12C14 10.9 13.1 10 12 10V8C14.21 8 16 9.79 16 12H14Z" fill="#4F46E5" opacity="0.4"/>
                  <circle cx="12" cy="12" r="2" fill="#4F46E5"/>
                </svg>
              </div>
            </div>
            <h2 className="nfc-title">NFC Attendance Active</h2>
            <p className="nfc-subtitle">Students can tap their NFC device to mark attendance</p>
            <div className="nfc-pin-box">
              <span className="nfc-pin-label">Session PIN</span>
              <span className="nfc-pin-value">{sessionData.sessionPin}</span>
            </div>
            <div className="nfc-status">
              <span className="nfc-dot"></span>
              Listening for NFC taps...
            </div>
          </div>
        </div>

        {/* Right Column - Controls + Attendees */}
        <div className="right-column">
          
          {/* Control Buttons */}
          <div className="control-section">
            <div className="control-buttons">
              <button
                onClick={handlePauseSession}
                className={`control-btn pause-btn ${isPaused ? 'resume' : 'pause'}`}
              >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
              </button>
              <button
                onClick={handleRefreshToken}
                className="control-btn refresh-btn"
                disabled={isPaused}
              >
                🔄 Refresh Token
              </button>
              <button
                onClick={handleCloseSession}
                className="control-btn close-btn"
              >
                ✕ Close Session
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="stats-section">
            <div className="stat-card">
              <div className="stat-value">{stats.present}</div>
              <div className="stat-label">Present</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Students</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.percentage}%</div>
              <div className="stat-label">Attendance</div>
            </div>
          </div>

          {/* Attendees List */}
          <div className="attendees-section">
            <h3>Attendance Records ({attendees.length})</h3>
            <div className="attendees-list">
              {attendees.length === 0 ? (
                <div className="no-attendees">
                  <p>No attendance records yet</p>
                  <p>Students will appear here when they mark attendance via NFC</p>
                </div>
              ) : (
                attendees.map((attendee, index) => (
                  <div key={index} className="attendee-card">
                    <div className="attendee-info">
                      <div className="attendee-name">
                        {attendee.studentName || `Student ${attendee.studentId || index + 1}`}
                      </div>
                      <div className="attendee-details">
                        <span>{attendee.id || attendee.studentId || 'N/A'}</span>
                        <span>•</span>
                        <span>{formatTime(attendee.timestamp || attendee.markedAt || attendee.createdAt)}</span>
                      </div>
                    </div>
                    <div className="attendee-status">
                      <span className={`status-badge ${attendee.status || 'present'}`}>
                        {attendee.status === 'present' ? '✓ Present' : 'Absent'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NFCSession;
