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

// Format time function for Sound Session
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

function SoundSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Core States
  const [sessionData, setSessionData] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [currentToken, setCurrentToken] = useState(null);
  const [isTransmitting, setIsTransmitting] = useState(true);
  const [stats, setStats] = useState({
    present: 0,
    total: 0,
    percentage: 0
  });

  // Polling refs
  const pollingRef = useRef(null);
  const tokenRefreshRef = useRef(null);
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);

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
      console.log('🔊 [SoundSession] Attendance response:', response);
      
      const attendanceData = response?.attendance || [];
      console.log('🔊 [SoundSession] Processed attendance data:', attendanceData);
      
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

  // Start ultrasonic transmission
  const startTransmission = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      const audioContext = audioContextRef.current;
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Set frequency to 14.5 kHz (ultrasonic range)
      oscillator.frequency.setValueAtTime(14500, audioContext.currentTime);
      oscillator.type = 'sine';
      
      // Set very low volume (inaudible but detectable by devices)
      gainNode.gain.setValueAtTime(0.01, audioContext.currentTime);
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Start transmission
      oscillator.start();
      oscillatorRef.current = oscillator;
      setIsTransmitting(true);
      
    } catch (error) {
      console.error('Failed to start transmission:', error);
      setIsTransmitting(false);
    }
  };

  // Stop ultrasonic transmission
  const stopTransmission = () => {
    try {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
        oscillatorRef.current = null;
      }
      setIsTransmitting(false);
    } catch (error) {
      console.error('Failed to stop transmission:', error);
    }
  };

  // Toggle transmission
  const toggleTransmission = () => {
    if (isTransmitting) {
      stopTransmission();
    } else {
      startTransmission();
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
        stopTransmission(); // Clean up audio
      };
    }
  }, [sessionId, sessionData, loading, isPaused]);

  // Handle transmission based on pause state
  useEffect(() => {
    if (!isPaused && sessionData && !loading) {
      startTransmission();
    } else {
      stopTransmission();
    }
  }, [isPaused, sessionData, loading]);

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
        stopTransmission(); // Stop transmission before navigating
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTransmission();
    };
  }, []);

  if (loading) {
    return (
      <div className="live-session-container">
        <div className="loading-state">
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <p className="loading-text">Loading Sound session...</p>
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
            <p>{sessionData.className} • Sound Mode</p>
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
        
        {/* Left Column - Sound Card */}
        <div className="left-column">
          <div className="sound-card">
            <div className="sound-icon-wrapper">
              <div className="sound-pulse-ring"></div>
              <div className="sound-pulse-ring delay-1"></div>
              <div className="sound-icon">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="#10B981"/>
                  <path d="M7 9l5-5v16l-5-5H3V9h4z" fill="#10B981" opacity="0.7"/>
                </svg>
              </div>
            </div>
            <h2 className="sound-title">Sound Attendance Active</h2>
            <p className="sound-subtitle">
              {isTransmitting ? 'Broadcasting ultrasonic signal...' : 'Transmission stopped'}
            </p>
            <div className="sound-pin-box">
              <span className="sound-pin-label">Session PIN</span>
              <span className="sound-pin-value">{sessionData.sessionPin}</span>
            </div>
            <div className="sound-status">
              <span className={`sound-dot ${isTransmitting ? 'active' : ''}`}></span>
              Transmitting at 14.5 kHz...
            </div>
            <button 
              onClick={toggleTransmission}
              className={`sound-toggle-btn ${isTransmitting ? 'stop' : 'start'}`}
              disabled={isPaused}
            >
              {isTransmitting ? '⏹ Stop Transmission' : '▶ Start Transmission'}
            </button>
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
                  <p>Students will appear here when they detect the ultrasonic signal</p>
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

export default SoundSession;
