import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from '../components/AuthProvider';
import { 
  getActiveSessions, 
  createSession, 
  closeSession, 
  deleteSession,
  getSessionStatistics,
  getAnomalyStatistics,
  handleApiError 
} from '../api/firebase';
import './Dashboard.css';

// ✅ Data structures aligned with mobile app
const coursesData = [
  {
    id: 'bca',
    name: 'BCA',
    semesters: [
      { id: 'bca1', name: '1st Semester', classId: 'BCA-2024' },
      { id: 'bca2', name: '2nd Semester', classId: 'BCA-2024' },
      { id: 'bca3', name: '3rd Semester', classId: 'BCA-2024' },
      { id: 'bca4', name: '4th Semester', classId: 'BCA-2024' },
      { id: 'bca5', name: '5th Semester', classId: 'BCA-2024' },
      { id: 'bca6', name: '6th Semester', classId: 'BCA-2024' },
    ],
  },
  {
    id: 'mca',
    name: 'MCA',
    semesters: [
      { id: 'mca1', name: '1st Semester', classId: 'MCA-2024' },
      { id: 'mca2', name: '2nd Semester', classId: 'MCA-2024' },
    ],
  },
];

const subjectsData = {
  bca1: [
    { id: 'cs101', name: 'Programming in C', code: 'CS101' },
    { id: 'ma101', name: 'Mathematics-I', code: 'MA101' },
    { id: 'de101', name: 'Digital Electronics', code: 'DE101' },
    { id: 'en101', name: 'English Communication', code: 'EN101' },
  ],
  bca2: [
    { id: 'cs201', name: 'Data Structures', code: 'CS201' },
    { id: 'ma201', name: 'Mathematics-II', code: 'MA201' },
    { id: 'cpp201', name: 'OOP with C++', code: 'CPP201' },
    { id: 'es201', name: 'Environmental Science', code: 'ES201' },
  ],
  bca3: [
    { id: 'cs301', name: 'Database Systems', code: 'CS301' },
    { id: 'wt301', name: 'Web Technologies', code: 'WT301' },
    { id: 'os301', name: 'Operating Systems', code: 'OS301' },
    { id: 'se301', name: 'Software Engineering', code: 'SE301' },
  ],
  bca4: [
    { id: 'java401', name: 'Java Programming', code: 'JAVA401' },
    { id: 'cn401', name: 'Computer Networks', code: 'CN401' },
    { id: 'py401', name: 'Python Programming', code: 'PY401' },
    { id: 'mad401', name: 'Mobile App Development', code: 'MAD401' },
  ],
  bca5: [
    { id: 'ai501', name: 'Artificial Intelligence', code: 'AI501' },
    { id: 'ml501', name: 'Machine Learning', code: 'ML501' },
    { id: 'cc501', name: 'Cloud Computing', code: 'CC501' },
    { id: 'cs501', name: 'Cyber Security', code: 'CS501' },
  ],
  bca6: [
    { id: 'bc601', name: 'Blockchain Technology', code: 'BC601' },
    { id: 'iot601', name: 'Internet of Things', code: 'IOT601' },
    { id: 'bd601', name: 'Big Data Analytics', code: 'BD601' },
    { id: 'proj601', name: 'Project Work', code: 'PROJ601' },
  ],
  mca1: [
    { id: 'aj101', name: 'Advanced Java', code: 'AJ101' },
    { id: 'dm101', name: 'Data Mining', code: 'DM101' },
    { id: 'adb101', name: 'Advanced DBMS', code: 'ADB101' },
  ],
  mca2: [
    { id: 'ml201', name: 'Machine Learning', code: 'ML201' },
    { id: 'do201', name: 'DevOps', code: 'DO201' },
    { id: 'ca201', name: 'Cloud Architecture', code: 'CA201' },
  ],
};

function Dashboard() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const [activeSessions, setActiveSessions] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [lastSessionCount, setLastSessionCount] = useState(0);
  const [isCleared, setIsCleared] = useState(false);
  
  // Flush sessions state
  const [isFlushingSessions, setIsFlushingSessions] = useState(false);
  const [flushMessage, setFlushMessage] = useState('');
  
  // Ref for lastSessionCount to prevent polling re-renders
  const lastSessionCountRef = useRef(lastSessionCount);
  lastSessionCountRef.current = lastSessionCount;
  
  const [stats, setStats] = useState({
    totalSessionsToday: 0,
    totalStudentsPresent: 0,
    averageAttendance: 0,
  });
  const [loading, setLoading] = useState(true);
  
  // Security Status State
  const [securityStatus, setSecurityStatus] = useState({
    totalAnomalies: 0,
    highSeverity: 0,
    mediumSeverity: 0,
    lastUpdated: null
  });
  
  // Session creation state
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    courseId: 'bca',
    semesterId: 'bca1',
    subjectId: 'cs201',
    className: 'BCA-2024',
    subject: 'Data Structures',
    mode: 'QR',
    totalStudents: 60,
    teacherName: 'Admin User',
    startDate: new Date().toISOString().split('T')[0],
    location: {
      latitude: 28.6139,
      longitude: 77.2090,
      radius: 100
    },
    requireFaceVerification: true,
    requireLocationVerification: false
  });

  const fetchSessions = async () => {
    const response = await getActiveSessions();
    setActiveSessions(response.sessions || []);
    return response;
  };

  // Fetch security status
  const fetchSecurityStatus = async () => {
    try {
      const response = await getAnomalyStatistics({
        startDate: new Date().toISOString().split('T')[0], // Today's anomalies
        endDate: new Date().toISOString().split('T')[0]
      });
      
      console.log('Security status response:', response);
      
      // Handle nested response structure
      const stats = response.data?.data || response.data || response;
      setSecurityStatus({
        totalAnomalies: stats.totalAnomalies || 0,
        highSeverity: stats.highSeverity || 0,
        mediumSeverity: stats.mediumSeverity || 0,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Failed to fetch security status:', error);
      // Set default status on error to show secure state
      setSecurityStatus({
        totalAnomalies: 0,
        highSeverity: 0,
        mediumSeverity: 0,
        lastUpdated: new Date()
      });
    }
  };

  // Fetch active sessions
  useEffect(() => {
    const fetchActiveSessions = async () => {
      try {
        const response = await getActiveSessions();
        const newSessions = response.sessions || [];
        const currentCount = lastSessionCountRef.current;
        
        // If sessions were cleared, only show active sessions and don't override
        if (isCleared) {
          const activeOnlySessions = newSessions.filter(session => 
            session.status === 'active' || session.status === 'live'
          );
          setActiveSessions(prevSessions => {
            // Only add truly new sessions, don't override existing active ones
            const existingIds = prevSessions.map(s => s.id);
            const trulyNewSessions = activeOnlySessions.filter(s => !existingIds.includes(s.id));
            return [...trulyNewSessions, ...prevSessions];
          });
        } else {
          // Check if new sessions were added
          if (newSessions.length > currentCount && currentCount > 0) {
            // New sessions detected, add them to the beginning
            setActiveSessions(prevSessions => {
              const existingIds = prevSessions.map(s => s.id);
              const trulyNewSessions = newSessions.filter(s => !existingIds.includes(s.id));
              return [...trulyNewSessions, ...prevSessions];
            });
          } else {
            // First load or no new sessions, maintain order
            setActiveSessions(newSessions);
          }
        }
        
        setLastSessionCount(newSessions.length);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch active sessions:', error);
        handleApiError(error);
        setLoading(false);
      }
    };

    if (user) {
      fetchActiveSessions();
      
      // Set up polling for real-time updates
      const interval = setInterval(fetchActiveSessions, 5000); // Poll every 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [user, isCleared]);

  // Fetch recent sessions
  useEffect(() => {
    const fetchRecentSessions = async () => {
      try {
        const response = await getActiveSessions({ status: 'closed', page: 1, limit: 5 });
        setRecentSessions(response.sessions || []);
      } catch (error) {
        console.error('Failed to fetch recent sessions:', error);
      }
    };

    if (user) {
      fetchRecentSessions();
    }
  }, [user]);

  // Fetch statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await getSessionStatistics();
        const statistics = response.statistics || {
          totalSessions: 0,
          totalStudents: 0,
          totalPresent: 0,
          averageAttendance: 0
        };
        
        setStats({
          totalSessionsToday: statistics.totalSessions,
          totalStudentsPresent: statistics.totalPresent,
          averageAttendance: Math.round(statistics.averageAttendance)
        });
      } catch (error) {
        console.error('Failed to fetch statistics:', error);
      }
    };

    fetchStats();
  }, []);

  // Fetch security status with 30-second auto-refresh
  useEffect(() => {
    if (user) {
      // Initial fetch
      fetchSecurityStatus();
      
      // Set up 30-second polling for security status
      const securityInterval = setInterval(fetchSecurityStatus, 30000); // 30 seconds
      
      return () => clearInterval(securityInterval);
    }
  }, [user]);

  // Create session function
  const handleCreateSession = async () => {
    if (!sessionForm.courseId || !sessionForm.semesterId || !sessionForm.subjectId || !sessionForm.mode) {
      alert('Please fill all required fields');
      return;
    }

    setIsCreatingSession(true);

    try {
      const response = await createSession(sessionForm);

      console.log('Create response:', JSON.stringify(response));

      const sessionId =
        response?.data?._id ||
        response?.data?.id ||
        response?._id;

      console.log('Session ID:', sessionId);

      // Reset cleared state when creating new session
      setIsCleared(false);
      
      // Refresh sessions list after create
      await fetchSessions();
      
      setShowCreateModal(false);
      setIsCreatingSession(false);
      
      // Show success message
      alert(`✅ ${sessionForm.mode} session created successfully!\n\nStudents will receive notifications automatically.`);
      
      // Reset form
      setSessionForm({
        courseId: '',
        semesterId: '',
        subjectId: 'cs201',
        className: 'BCA-2024',
        subject: 'Data Structures',
        mode: 'QR',
        totalStudents: 60,
        teacherName: 'Admin User',
        startDate: new Date().toISOString().split('T')[0],
        location: {
          latitude: 28.6139,
          longitude: 77.2090,
          radius: 100
        },
        requireFaceVerification: true,
        requireLocationVerification: false
      });

    } catch (error) {
      console.error('Error creating session:', error);
      handleApiError(error);
      setIsCreatingSession(false);
    }
  };

  // Close session function
  const handleCloseSession = async (sessionId) => {
    try {
      await closeSession(sessionId);
      // Refresh sessions list after closing
      const response = await getActiveSessions();
      setActiveSessions(response.sessions || []);
      alert('Session closed successfully');
    } catch (error) {
      console.error('Close session error:', error);
      alert('Failed to close session');
    }
  };

  // Flush previous sessions function
  const handleFlushSessions = async () => {
    setIsFlushingSessions(true);
    setFlushMessage('');
    
    try {
      // Get current sessions to identify which ones to delete
      const response = await getActiveSessions();
      const allSessions = response.sessions || [];
      
      // Identify sessions to delete (not active/live)
      const sessionsToDelete = allSessions.filter(session => 
        session.status !== 'active' && session.status !== 'live'
      );
      
      // Delete sessions from database
      let deletedCount = 0;
      for (const session of sessionsToDelete) {
        try {
          await deleteSession(session.id);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete session ${session.id}:`, error);
        }
      }
      
      // Keep only active sessions in state
      const activeOnlySessions = allSessions.filter(session => 
        session.status === 'active' || session.status === 'live'
      );
      
      setActiveSessions(activeOnlySessions);
      setLastSessionCount(activeOnlySessions.length);
      setIsCleared(true); // Mark as cleared
      
      // Show success message
      if (deletedCount > 0) {
        setFlushMessage(`✅ Successfully deleted ${deletedCount} old sessions from database.`);
      } else {
        setFlushMessage('ℹ️ No old sessions found to delete. Only active sessions were present.');
      }
      
      // Auto-clear message after 3 seconds
      setTimeout(() => {
        setFlushMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('Failed to clear sessions:', error);
      setFlushMessage('❌ Failed to clear sessions. Please try again.');
      
      // Auto-clear error message after 3 seconds
      setTimeout(() => {
        setFlushMessage('');
      }, 3000);
    } finally {
      setIsFlushingSessions(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return <span className="status-badge status-active">Live</span>;
      case 'ended':
        return <span className="status-badge status-ended">Ended</span>;
      default:
        return <span className="status-badge status-pending">Pending</span>;
    }
  };

  const getModeBadge = (mode) => {
    const modeIcons = {
      QR: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect width="5" height="5" fill="currentColor"/>
          <rect x="9" width="5" height="5" fill="currentColor"/>
          <rect y="9" width="5" height="5" fill="currentColor"/>
        </svg>
      ),
      NFC: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1C3.68629 1 1 3.68629 1 7C1 10.3137 3.68629 13 7 13C10.3137 13 13 10.3137 13 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      ),
      SOUND: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 5V9H5L9 12V2L5 5H2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
          <path d="M11 4.5C11.5 5.5 11.5 8.5 11 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      P2P: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="4" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="10" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M2 12C2 10.3431 3.34315 9 5 9H9C10.6569 9 12 10.3431 12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )
    };

    return (
      <span className={`mode-badge mode-${mode?.toLowerCase() || 'qr'}`}>
        {modeIcons[mode] || modeIcons.QR}
        {mode || 'QR'}
      </span>
    );
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <div className="loading-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <p className="loading-text">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Security Status Strip */}
      <div className={`security-status-strip ${securityStatus.totalAnomalies === 0 ? 'secure' : 'alert'}`}>
        {securityStatus.totalAnomalies === 0 ? (
          <div className="security-content">
            <span className="security-icon">🟢</span>
            <span className="security-text">
              All Systems Secure — 0 anomalies detected today | All records blockchain-verified | Face data: On-device only
            </span>
          </div>
        ) : (
          <Link to="/audit-logs" className="security-content alert-link">
            <span className="security-icon">🔴</span>
            <span className="security-text">
              Security Alert — {securityStatus.totalAnomalies} anomalies detected today | Tap to review
            </span>
          </Link>
        )}
        <div className="security-timestamp">
          Last updated: {securityStatus.lastUpdated ? 
            new Date(securityStatus.lastUpdated).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }) : 'Loading...'
          }
        </div>
      </div>

      <div className="dashboard-wrapper">
        
        {/* Header Section */}
        <div className="dashboard-header">
          <div className="header-content">
            <div className="header-text">
              <h1 className="dashboard-title">Admin Dashboard</h1>
              <p className="dashboard-subtitle">
                {new Date().toLocaleDateString('en-IN', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
            <div className="header-actions">
              {/* Create Session Button */}
              <button 
                onClick={() => setShowCreateModal(true)} 
                className="create-session-btn"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4V16M4 10H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Create Session
              </button>

              {/* Audit Logs Link (Admin Only) */}
              {isAdmin() && (
                <Link to="/audit-logs" className="audit-logs-link">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M9 12h2m-6 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2zm10-10H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Audit Logs
                </Link>
              )}
              
              <div className="user-info">
                <div className="user-avatar">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                    <path d="M4 19C4 15.134 6.68629 12 10 12C13.3137 12 16 15.134 16 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="user-email">{user?.email?.split('@')[0] || 'Admin'}</span>
              </div>
              <button onClick={logout} className="logout-btn">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M7 13L3 9M3 9L7 5M3 9H11M11 3H13C14.1046 3 15 3.89543 15 5V13C15 14.1046 14.1046 15 13 15H11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Create Session Modal */}
        {showCreateModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2>Create New Session</h2>
              
              {/* Course Selection */}
              <div className="form-group">
                <label>Course</label>
                <select
                  value={sessionForm.courseId}
                  onChange={(e) => {
                    const courseId = e.target.value;
                    const selectedCourse = coursesData.find(c => c.id === courseId);
                    const firstSemester = selectedCourse?.semesters[0];
                    const firstSubject = firstSemester ? subjectsData[firstSemester.id]?.[0] : null;
                    
                    setSessionForm({
                      ...sessionForm,
                      courseId,
                      semesterId: firstSemester?.id || '',
                      subjectId: firstSubject?.id || '',
                      className: firstSemester?.classId || '',
                      subject: firstSubject?.name || ''
                    });
                  }}
                  className="form-select"
                >
                  {coursesData.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Semester Selection */}
              <div className="form-group">
                <label>Semester</label>
                <select
                  value={sessionForm.semesterId}
                  onChange={(e) => {
                    const semesterId = e.target.value;
                    const selectedSemester = coursesData
                      .find(c => c.id === sessionForm.courseId)
                      ?.semesters.find(s => s.id === semesterId);
                    const firstSubject = subjectsData[semesterId]?.[0];
                    
                    setSessionForm({
                      ...sessionForm,
                      semesterId,
                      className: selectedSemester?.classId || '',
                      subjectId: firstSubject?.id || '',
                      subject: firstSubject?.name || ''
                    });
                  }}
                  className="form-select"
                >
                  {coursesData
                    .find(c => c.id === sessionForm.courseId)
                    ?.semesters.map(semester => (
                      <option key={semester.id} value={semester.id}>
                        {semester.name}
                      </option>
                    )) || []}
                </select>
              </div>

              {/* Subject Selection */}
              <div className="form-group">
                <label>Subject</label>
                <select
                  value={sessionForm.subjectId}
                  onChange={(e) => {
                    const subjectId = e.target.value;
                    const selectedSubject = subjectsData[sessionForm.semesterId]?.find(s => s.id === subjectId);
                    
                    setSessionForm({
                      ...sessionForm,
                      subjectId,
                      subject: selectedSubject?.name || ''
                    });
                  }}
                  className="form-select"
                >
                  {subjectsData[sessionForm.semesterId]?.map(subject => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} - {subject.name}
                    </option>
                  )) || []}
                </select>
              </div>

              <div className="form-group">
                <label>Total Students</label>
                <input
                  type="number"
                  value={sessionForm.totalStudents}
                  onChange={(e) => setSessionForm({...sessionForm, totalStudents: parseInt(e.target.value) || 0})}
                  placeholder="e.g., 60"
                />
              </div>

              <div className="form-group">
                <label>Attendance Mode</label>
                <div className="mode-options">
                  {['QR', 'NFC', 'SOUND', 'P2P'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setSessionForm({...sessionForm, mode})}
                      className={`mode-option ${sessionForm.mode === mode ? 'active' : ''}`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreatingSession}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSession}
                  disabled={isCreatingSession}
                  className="create-btn"
                >
                  {isCreatingSession ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="stats-section">
          <div className="stat-card stat-sessions">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="2"/>
                <path d="M3 10H21" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 6V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16 6V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="stat-details">
              <h3>{stats.totalSessionsToday}</h3>
              <p>Sessions Today</p>
            </div>
          </div>

          <div className="stat-card stat-students">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M6 21C6 17.134 8.68629 14 12 14C15.3137 14 18 17.134 18 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="stat-details">
              <h3>{stats.totalStudentsPresent}</h3>
              <p>Students Present</p>
            </div>
          </div>

          <div className="stat-card stat-attendance">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 3L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M3 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M3 21L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="stat-details">
              <h3>{stats.averageAttendance}%</h3>
              <p>Avg Attendance</p>
            </div>
          </div>
        </div>

        {/* Active Sessions Section */}
        {activeSessions.length > 0 && (
          <div className="section-card">
            <div className="section-header">
              <h2>
                <span className="pulse-dot"></span>
                Live Sessions
              </h2>
              <div className="header-actions">
                <span>{activeSessions.length} Active</span>
                <button 
                  onClick={handleFlushSessions}
                  disabled={isFlushingSessions}
                  className="clear-sessions-btn"
                  title="Clear inactive sessions and refresh"
                >
                  {isFlushingSessions ? (
                    <>
                      <div className="loading-spinner-small"></div>
                      Clearing...
                    </>
                  ) : (
                    <>
                      🧹 Clear Old
                    </>
                  )}
                </button>
              </div>
              
              {/* Flush Message Toast */}
              {flushMessage && (
                <div className="flush-message">
                  {flushMessage}
                </div>
              )}
            </div>
            
            <div className="sessions-grid">
              {activeSessions.map((session) => {
                const attendancePercent = session.totalStudents > 0
                  ? Math.round((session.presentCount / session.totalStudents) * 100)
                  : 0;

                return (
                  <div key={session.id} className="session-card">
                    <div className="session-header">
                      <h3>{session.subject}</h3>
                      {getModeBadge(session.mode)}
                    </div>
                    <div className="session-body">
                      <p className="session-class">{session.className}</p>
                      <div className="session-stats">
                        <div className="stat">
                          <span>Present</span>
                          <span>{session.presentCount}/{session.totalStudents}</span>
                        </div>
                        <div className="stat">
                          <span>Attendance</span>
                          <span>{attendancePercent}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="session-footer">
                      <span className="session-time">{formatDateTime(session.startTime)}</span>
                      <div className="session-actions">
                        <button 
                          onClick={() => {
                            const mode = session.mode?.toLowerCase();
                            if (mode === 'nfc') {
                              navigate(`/nfc-session/${session.id}`);
                            } else if (mode === 'sound') {
                              navigate(`/sound-session/${session.id}`);
                            } else {
                              navigate(`/session/${session.id}`);
                            }
                          }}
                          className="view-btn"
                        >
                          View
                        </button>
                        <button 
                          onClick={() => handleCloseSession(session.id)}
                          className="close-btn"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Sessions Section */}
        <div className="section-card">
          <div className="section-header">
            <h2 className="section-title">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 5V10L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2"/>
              </svg>
              Recent Activity
            </h2>
            <Link to="/reports" className="view-all-link">
              View All
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>

          {recentSessions.length > 0 ? (
            <div className="recent-sessions-table">
              {recentSessions.map((session) => (
                <div key={session.id} className="recent-session-row">
                  <div className="recent-session-main">
                    <div className="recent-session-info">
                      <h4 className="recent-subject">{session.subject}</h4>
                      <p className="recent-meta">
                        {session.className || session.class} • {formatDate(session.createdAt)} at {formatTime(session.createdAt)}
                      </p>
                    </div>
                    
                    <div className="recent-session-badges">
                      {getModeBadge(session.mode || 'QR')}
                      {getStatusBadge(session.status)}
                    </div>
                  </div>

                  <div className="recent-session-stats">
                    <div className="recent-stat">
                      <span className="recent-stat-value">{session.presentCount || 0}/{session.totalStudents || 0}</span>
                      <span className="recent-stat-label">Attendance</span>
                    </div>
                    
                    <button 
                      onClick={() => {
                        const mode = session.mode?.toLowerCase();
                        if (mode === 'nfc') {
                          navigate(`/nfc-session/${session.id}`);
                        } else if (mode === 'sound') {
                          navigate(`/sound-session/${session.id}`);
                        } else {
                          navigate(`/session/${session.id}`);
                        }
                      }}
                      className="recent-view-btn"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-recent-sessions">
              <p>No recent sessions found</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-section">
          <Link to="/reports" className="quick-action-card">
            <div className="quick-action-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M9 17H15M9 13H15M9 9H10M13 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H15.8C16.9201 21 17.4802 21 17.908 20.782C18.2843 20.5903 18.5903 20.2843 18.782 19.908C19 19.4802 19 18.9201 19 17.8V9M13 3L19 9M13 3V7.4C13 7.96005 13 8.24008 13.109 8.45399C13.2049 8.64215 13.3578 8.79513 13.546 8.89101C13.7599 9 14.0399 9 14.6 9H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="quick-action-content">
              <h3 className="quick-action-title">View Reports</h3>
              <p className="quick-action-desc">Access detailed attendance analytics</p>
            </div>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="quick-action-arrow">
              <path d="M7 4L13 10L7 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

      </div>
    </div>
  );
}

export default Dashboard;