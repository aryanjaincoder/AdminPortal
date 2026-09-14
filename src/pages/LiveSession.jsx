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
import { QRCodeSVG } from 'qrcode.react';
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

function LiveSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  // Core States
  const [sessionData, setSessionData] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blockchainVerifications, setBlockchainVerifications] = useState(new Map());
  const [anomalies, setAnomalies] = useState([]);
  const [currentToken, setCurrentToken] = useState('');
  const [qrValue, setQrValue] = useState('');
  
  // Use ref to maintain previous attendee IDs across polling cycles
  const previousAttendeeIdsRef = useRef(new Set());

  // Real-time notification states
  const [newAttendeeNotifications, setNewAttendeeNotifications] = useState([]);
  const pollingRef = useRef(null);

// Play notification sound function
const playNotificationSound = () => {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // 800 Hz tone
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    console.log('Audio not supported:', error);
  }
};

  // Fetch session data
  const fetchSessionData = async () => {
    try {
      const response = await getSession(sessionId);
      console.log('API response:', response); // temporary debug log
      
      // Firebase returns { session: {...} }
      const session = response?.session || response?.data || response;
      
      if (!session || !session.id) {
        throw new Error('Invalid session data received');
      }
      
      setSessionData(session);
      setIsPaused(session.status === 'paused');
      setError('');
    } catch (error) {
      console.error('Failed to fetch session:', error);
      setError('Failed to load session. Please check if the session exists and try again.');
      setSessionData(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch attendees
  const fetchAttendees = async () => {
    try {
      const response = await getSessionAttendance(sessionId);
      console.log('Attendees API response:', response); // debug log
      
      // Handle different response shapes
      const attendeeList = response?.attendance || response?.data?.attendance || response?.data || [];
      const currentAttendees = Array.isArray(attendeeList) ? attendeeList : [];
      
      // Detect new attendees using ref
      const currentAttendeeIds = new Set(currentAttendees.map(a => a.id || a._id));
      const previousIds = previousAttendeeIdsRef.current;
      
      const newAttendees = currentAttendees.filter(attendee => 
        !previousIds.has(attendee.id || attendee._id)
      );
      
      // Show notifications for new attendees
      if (newAttendees.length > 0) {
        console.log(`🔔 [fetchAttendees] ${newAttendees.length} new attendees detected`);
        newAttendees.forEach(attendee => {
          console.log('👤 [fetchAttendees] New attendee:', attendee);
          
          const notification = {
            id: Date.now() + Math.random(),
            studentName: attendee.studentName || attendee.name || 'Student',
            mode: attendee.mode || sessionData.mode || 'Unknown',
            timestamp: new Date()
          };
          
          console.log('📢 [fetchAttendees] Notification:', notification);
          
          setNewAttendeeNotifications(prev => [...prev, notification]);
          
          // Play notification sound for NFC and Sound modes
          if (attendee.mode?.toUpperCase() === 'NFC' || attendee.mode?.toUpperCase() === 'SOUND') {
            playNotificationSound();
          }
          
          // Auto-remove notification after 4 seconds
          setTimeout(() => {
            setNewAttendeeNotifications(prev => 
              prev.filter(n => n.id !== notification.id)
            );
          }, 4000);
        });
        
        // Update the ref with current IDs
        previousAttendeeIdsRef.current = currentAttendeeIds;
      }
      
      setAttendees(currentAttendees);
      
      currentAttendees.forEach(async (attendee) => {
        if (attendee.suspicious) {
          setAnomalies(prev => [...prev, {
            studentName: attendee.studentName,
            reason: attendee.suspiciousReason || 'Unusual activity detected'
          }]);
        }

        try {
          const verifyResponse = await verifyAttendance(attendee.id || attendee._id);
          if (verifyResponse.txHash) {
            setBlockchainVerifications(prev => 
              new Map(prev.set(attendee.id || attendee._id, verifyResponse.txHash))
            );
          }
        } catch (error) {
          // silent fail
        }
      });
    } catch (error) {
      console.error('Failed to fetch attendees:', error);
    }
  };

  // Polling effect
  useEffect(() => {
    if (sessionId) {
      // Reset previous attendee IDs when session changes
      previousAttendeeIdsRef.current = new Set();
      
      setLoading(true);
      Promise.all([fetchSessionData(), fetchAttendees()])
        .finally(() => setLoading(false));

      pollingRef.current = setInterval(() => {
        fetchSessionData();
        fetchAttendees();
      }, 3000);

      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [sessionId]);

  // QR Token rotation effect
  useEffect(() => {
    // Only rotate token for QR mode sessions
    if (sessionData?.mode?.toUpperCase() !== 'QR') return;
    
    const rotateToken = async () => {
      try {
        const response = await generateNewToken(sessionId);
        const newToken = response?.token;
        
        if (newToken) {
          setCurrentToken(newToken);
          const newQrValue = JSON.stringify({
            sessionId: sessionId,
            token: newToken,
            timestamp: Date.now()
          });
          setQrValue(newQrValue);
          console.log('🔄 QR Rotated:', newQrValue);
        }
      } catch (error) {
        console.error('Token rotation failed:', error);
      }
    };

    // Rotate immediately on mount
    rotateToken();
    
    // Then rotate every 5 seconds
    const interval = setInterval(rotateToken, 5000);
    return () => clearInterval(interval);
  }, [sessionId, sessionData?.mode]);

  // Handle pause session
  const handlePauseSession = async () => {
    try {
      await pauseSession(sessionId, !isPaused);
      setIsPaused(!isPaused);
    } catch (error) {
      console.error('Failed to pause session:', error);
      handleApiError(error);
    }
  };

  // Handle close session
  const handleCloseSession = async () => {
    setClosing(true);
    try {
      await closeSession(sessionId);
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to close session:', error);
      handleApiError(error);
      setClosing(false);
    }
  };

  // Format time
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

  // Open blockchain explorer
  const openBlockchainExplorer = (txHash) => {
    window.open(`https://mumbai.polygonscan.com/tx/${txHash}`, '_blank');
  };

  if (loading) {
    return (
      <div className="live-session-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="live-session-container">
        <div className="error-state">
          <p>{error}</p>
          <button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="live-session-container">
        <div className="error-state">
          <p>Session not found</p>
          <button onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="live-session-container">
      {/* Real-time Notifications */}
      <div className="notifications-container">
        {newAttendeeNotifications.map(notification => (
          <div key={notification.id} className="notification-slide-in">
            <div className="notification-content">
              <div className="notification-icon">
                {notification.mode?.toUpperCase() === 'NFC' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 12C20 7.58 16.42 4 12 4V2C17.52 2 22 6.48 22 12H20Z" fill="#4F46E5"/>
                    <circle cx="12" cy="12" r="2" fill="#4F46E5"/>
                  </svg>
                ) : notification.mode?.toUpperCase() === 'SOUND' ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" fill="#10B981"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect width="8" height="8" fill="#3B82F6"/>
                    <rect x="16" width="8" height="8" fill="#3B82F6"/>
                    <rect y="16" width="8" height="8" fill="#3B82F6"/>
                  </svg>
                )}
              </div>
              <div className="notification-text">
                <strong>{notification.studentName}</strong> marked attendance via {notification.mode}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Header Section */}
      <div className="session-header">
        <div className="header-content">
          <button onClick={() => navigate('/dashboard')} className="back-btn">
            ← Dashboard
          </button>
          <div className="session-title-section">
            <h1 className="session-title">{sessionData.subject}</h1>
            <div className="session-meta-row">
              <span className="class-name">{sessionData.className}</span>
              <span className={`mode-badge mode-${sessionData.mode?.toLowerCase() || 'qr'}`}>
                {sessionData.mode}
              </span>
              <span className={`status-badge status-${sessionData.status?.toLowerCase() || 'active'}`}>
                {sessionData.status === 'active' ? '🟢 Active' : sessionData.status === 'paused' ? '⏸️ Paused' : sessionData.status}
              </span>
            </div>
            <div className="attendance-count">
              <strong>Present:</strong> {attendees.length} / {sessionData.totalStudents}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - 2 Column Grid */}
      <div className="main-content-grid">
        
        {/* Left Column - QR Code Card */}
        <div className="left-column">
          {sessionData.mode?.toUpperCase() === 'NFC' ? (
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
          ) : sessionData.mode?.toUpperCase() === 'SOUND' ? (
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
              <p className="sound-subtitle">Broadcasting ultrasonic signal...</p>
              <div className="sound-pin-box">
                <span className="sound-pin-label">Session PIN</span>
                <span className="sound-pin-value">{sessionData.sessionPin}</span>
              </div>
              <div className="sound-status">
                <span className="sound-dot"></span>
                Transmitting at 14.5 kHz...
              </div>
            </div>
          ) : (
            <div className="qr-card">
              <h2 className="qr-title">Scan to Mark Attendance</h2>
              
              <div className="qr-code-container">
                <QRCodeSVG 
                  value={JSON.stringify({
                    sessionId: sessionData.id || sessionId,
                    token: currentToken || sessionData.sessionToken || 'default-token',
                    timestamp: Date.now()
                  })}
                  size={320}
                  level="H"
                />
              </div>
            
            <div className="qr-info">
              <div className="session-pin">
                PIN: <strong>{sessionData.sessionPin || 'N/A'}</strong>
              </div>
              <div className="countdown-container">
                Refreshes in: <TokenCountdown expiresAt={sessionData.tokenExpiresAt} />
              </div>
              <div className="refresh-note">
                🔄 Refreshes every 2 seconds
              </div>
            </div>
            </div>
          )}
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
                onClick={handleCloseSession}
                className="control-btn close-btn"
                disabled={closing}
              >
                {closing ? 'Closing...' : '✕ Close Session'}
              </button>
            </div>
          </div>

          {/* Anomaly Alerts */}
          {anomalies.length > 0 && (
            <div className="anomaly-section">
              <div className="anomaly-alerts">
                <h3>⚠️ Security Alerts</h3>
                {anomalies.map((anomaly, index) => (
                  <div key={index} className="anomaly-alert">
                    <span className="anomaly-icon">⚠️</span>
                    <span className="anomaly-text">
                      Suspicious Activity: {anomaly.studentName} - {anomaly.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attendees List */}
          <div className="attendees-section">
            <div className="attendees-card">
              <h3 className="attendees-title">Attendees ({attendees.length})</h3>
              
              {attendees.length > 0 ? (
                <div className="attendees-list">
                  {attendees.map((attendee) => (
                    <div key={attendee.id || attendee._id || Math.random()} className="attendee-row">
                      <div className="attendee-avatar">
                        {attendee.studentName?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="attendee-info">
                        <div className="attendee-name">{attendee.studentName || attendee.name || 'Unknown'}</div>
                        <div className="attendee-meta">
                          <span>{attendee.id || attendee._id || 'N/A'}</span>
                          <span>•</span>
                          <span>{formatTime(attendee.markedAt || attendee.createdAt)}</span>
                          <span>•</span>
                          <span className="attendee-mode">{attendee.mode || 'QR'}</span>
                        </div>
                      </div>
                      
                      {/* Blockchain Verification Badge */}
                      {blockchainVerifications.has(attendee.id || attendee._id) && (
                        <div className="verified-badge" title="View on Blockchain">
                          🔒
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-attendees">
                  <p>No attendees yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveSession;
