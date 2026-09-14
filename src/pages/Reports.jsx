import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getSessionStatistics, 
  getActiveSessions, 
  getSessionAttendance 
} from '../api/firebase';
import './Dashboard.css';

function Reports() {
  const [activeTab, setActiveTab] = useState('session');
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  
  // Filters
  const [sessionFilters, setSessionFilters] = useState({
    dateRange: 'all',
    class: 'all',
    subject: 'all',
    mode: 'all'
  });
  
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');

  // Fetch data on component mount
  useEffect(() => {
    fetchReportsData();
  }, []);

  const fetchReportsData = async () => {
    try {
      setLoading(true);
      
      // Fetch all sessions (including closed ones)
      const allSessionsResponse = await getActiveSessions({ status: 'all', limit: 100 });
      const allSessions = allSessionsResponse.sessions || [];
      
      // Process sessions data
      const processedSessions = allSessions.map(session => ({
        ...session,
        attendancePercentage: session.totalStudents > 0 
          ? Math.round((session.presentCount / session.totalStudents) * 100)
          : 0,
        date: session.createdAt ? new Date(session.createdAt).toLocaleDateString() : 'N/A',
        time: session.startTime || 'N/A'
      }));

      setSessions(processedSessions);
      
      // Extract unique classes and subjects
      const uniqueClasses = [...new Set(allSessions.map(s => s.className || s.class).filter(Boolean))];
      const uniqueSubjects = [...new Set(allSessions.map(s => s.subject).filter(Boolean))];
      
      setClasses(uniqueClasses);
      
      // For demo, create some sample student data
      // In real app, this would come from attendance_records collection
      const sampleStudents = [
        {
          id: 'student1',
          name: 'Aryan Jain',
          class: 'BCA-2024',
          totalSessions: 45,
          presentSessions: 42,
          attendancePercentage: 93,
          subjects: {
            'Data Structures': { total: 15, present: 14 },
            'Database Systems': { total: 15, present: 14 },
            'Web Technologies': { total: 15, present: 14 }
          }
        },
        {
          id: 'student2',
          name: 'Priya Sharma',
          class: 'BCA-2024',
          totalSessions: 45,
          presentSessions: 38,
          attendancePercentage: 84,
          subjects: {
            'Data Structures': { total: 15, present: 12 },
            'Database Systems': { total: 15, present: 13 },
            'Web Technologies': { total: 15, present: 13 }
          }
        }
      ];
      
      setStudents(sampleStudents);
      
    } catch (error) {
      console.error('Failed to fetch reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRowExpansion = (sessionId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId);
    } else {
      newExpanded.add(sessionId);
    }
    setExpandedRows(newExpanded);
  };

  const getModeBadge = (mode) => {
    const modeColors = {
      QR: '#3B82F6',
      NFC: '#10B981', 
      SOUND: '#F59E0B',
      P2P: '#8B5CF6'
    };
    
    return (
      <span 
        className="mode-badge" 
        style={{ 
          backgroundColor: modeColors[mode] || '#6B7280',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500'
        }}
      >
        {mode || 'QR'}
      </span>
    );
  };

  const getStatusBadge = (status) => {
    const colors = {
      present: '#10B981',
      absent: '#EF4444',
      late: '#F59E0B'
    };
    
    return (
      <span 
        style={{
          backgroundColor: colors[status] || '#6B7280',
          color: 'white',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500'
        }}
      >
        {status === 'present' ? '✓ Present' : status === 'absent' ? '✗ Absent' : status}
      </span>
    );
  };

  // Filter sessions based on filters
  const filteredSessions = sessions.filter(session => {
    if (sessionFilters.class !== 'all' && session.className !== sessionFilters.class) return false;
    if (sessionFilters.subject !== 'all' && session.subject !== sessionFilters.subject) return false;
    if (sessionFilters.mode !== 'all' && session.mode !== sessionFilters.mode) return false;
    return true;
  });

  // Filter students based on search
  const filteredStudents = students.filter(student => 
    student.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    student.id.toLowerCase().includes(studentSearch.toLowerCase())
  );

  // Get class-wise subject data
  const getClassSubjectData = () => {
    if (selectedClass === 'all') return [];
    
    const classSessions = sessions.filter(s => s.className === selectedClass);
    const subjectData = {};
    
    classSessions.forEach(session => {
      const subject = session.subject;
      if (!subjectData[subject]) {
        subjectData[subject] = {
          subject,
          totalSessions: 0,
          totalPresent: 0,
          totalStudents: 0
        };
      }
      
      subjectData[subject].totalSessions++;
      subjectData[subject].totalPresent += session.presentCount || 0;
      subjectData[subject].totalStudents += session.totalStudents || 0;
    });
    
    return Object.values(subjectData).map(data => ({
      ...data,
      avgPresent: Math.round(data.totalPresent / data.totalSessions),
      avgAttendance: data.totalStudents > 0 
        ? Math.round((data.totalPresent / (data.totalSessions * data.totalStudents / data.totalSessions)) * 100)
        : 0
    }));
  };

  const SimpleBarChart = ({ data }) => {
    const maxValue = Math.max(...data.map(d => d.avgAttendance), 100);
    
    return (
      <div style={{ marginTop: '20px' }}>
        {data.map((item, index) => (
          <div key={index} style={{ marginBottom: '15px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '5px',
              fontSize: '14px'
            }}>
              <span>{item.subject}</span>
              <span>{item.avgAttendance}%</span>
            </div>
            <div style={{ 
              width: '100%', 
              height: '24px', 
              backgroundColor: '#374151', 
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(item.avgAttendance / maxValue) * 100}%`,
                height: '100%',
                backgroundColor: '#3B82F6',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#9CA3AF', 
              marginTop: '2px' 
            }}>
              Avg: {item.avgPresent}/{Math.round(item.totalStudents / data.length)} students
            </div>
          </div>
        ))}
      </div>
    );
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
          <p className="loading-text">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        {/* Header */}
        <div className="dashboard-header">
          <div className="header-content">
            <div className="header-text">
              <h1 className="dashboard-title">Attendance Reports</h1>
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
              <Link to="/dashboard" className="back-btn" style={{ 
                textDecoration: 'none', 
                color: 'var(--gray-700)',
                padding: '10px 16px',
                border: '1px solid var(--gray-200)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="section-card">
          <div style={{ 
            display: 'flex', 
            borderBottom: '1px solid var(--gray-200)',
            marginBottom: '24px'
          }}>
            {[
              { id: 'session', label: 'By Session', icon: '📊' },
              { id: 'student', label: 'By Student', icon: '👤' },
              { id: 'class', label: 'By Class', icon: '🏫' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '16px 24px',
                  backgroundColor: activeTab === tab.id ? 'var(--primary-blue)' : 'transparent',
                  color: activeTab === tab.id ? 'white' : 'var(--gray-600)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  borderBottom: activeTab === tab.id ? '3px solid var(--primary-blue)' : '3px solid transparent',
                  marginBottom: '-1px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease'
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'session' && (
            <div>
              {/* Filters */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
                padding: '16px',
                backgroundColor: 'var(--gray-50)',
                borderRadius: '8px'
              }}>
                <select 
                  value={sessionFilters.class}
                  onChange={(e) => setSessionFilters({...sessionFilters, class: e.target.value})}
                  style={{ padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: '6px' }}
                >
                  <option value="all">All Classes</option>
                  {classes.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
                
                <select 
                  value={sessionFilters.mode}
                  onChange={(e) => setSessionFilters({...sessionFilters, mode: e.target.value})}
                  style={{ padding: '8px 12px', border: '1px solid var(--gray-200)', borderRadius: '6px' }}
                >
                  <option value="all">All Modes</option>
                  <option value="QR">QR</option>
                  <option value="NFC">NFC</option>
                  <option value="SOUND">Sound</option>
                  <option value="P2P">P2P</option>
                </select>
              </div>

              {/* Sessions List */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}>Subject</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}>Class</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}>Date</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}>Mode</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}>Attendance</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}>%</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((session, index) => (
                      <React.Fragment key={session.id}>
                        <tr 
                          style={{ 
                            borderBottom: '1px solid var(--gray-100)',
                            cursor: 'pointer',
                            backgroundColor: expandedRows.has(session.id) ? 'var(--gray-50)' : 'white'
                          }}
                          onClick={() => toggleRowExpansion(session.id)}
                        >
                          <td style={{ padding: '12px', fontSize: '14px' }}>{session.subject}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{session.className}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>{session.date}</td>
                          <td style={{ padding: '12px' }}>{getModeBadge(session.mode)}</td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>
                            {session.presentCount}/{session.totalStudents}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px' }}>
                            <span style={{
                              color: session.attendancePercentage >= 75 ? '#10B981' : 
                                     session.attendancePercentage >= 50 ? '#F59E0B' : '#EF4444',
                              fontWeight: '500'
                            }}>
                              {session.attendancePercentage}%
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                              {expandedRows.has(session.id) ? '▼' : '▶'}
                            </span>
                          </td>
                        </tr>
                        {expandedRows.has(session.id) && (
                          <tr>
                            <td colSpan="7" style={{ padding: '0', backgroundColor: 'var(--gray-50)' }}>
                              <div style={{ padding: '16px', borderLeft: '3px solid var(--primary-blue)' }}>
                                <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--gray-700)' }}>
                                  Individual Attendance Records
                                </div>
                                <div style={{ color: '#9CA3AF', fontSize: '12px' }}>
                                  Individual student records will be shown here from attendance_records collection
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
                
                {filteredSessions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                    No sessions found for the selected filters
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'student' && (
            <div>
              {/* Search */}
              <div style={{ marginBottom: '24px' }}>
                <input
                  type="text"
                  placeholder="Search by student name or ID..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  style={{
                    width: '100%',
                    maxWidth: '400px',
                    padding: '12px 16px',
                    border: '1px solid var(--gray-200)',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Students List */}
              <div style={{ display: 'grid', gap: '16px' }}>
                {filteredStudents.map(student => (
                  <div key={student.id} style={{
                    border: '1px solid var(--gray-200)',
                    borderRadius: '12px',
                    padding: '20px',
                    backgroundColor: 'white'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '16px'
                    }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{student.name}</h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--gray-600)' }}>
                          ID: {student.id} • Class: {student.class}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                          fontSize: '24px', 
                          fontWeight: 'bold',
                          color: student.attendancePercentage >= 75 ? '#10B981' : 
                                 student.attendancePercentage >= 50 ? '#F59E0B' : '#EF4444'
                        }}>
                          {student.attendancePercentage}%
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
                          {student.presentSessions}/{student.totalSessions} sessions
                        </div>
                      </div>
                    </div>

                    {/* Subject-wise breakdown */}
                    <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '16px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--gray-700)' }}>
                        Subject-wise Attendance
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                        {Object.entries(student.subjects).map(([subject, data]) => (
                          <div key={subject} style={{
                            padding: '12px',
                            backgroundColor: 'var(--gray-50)',
                            borderRadius: '8px'
                          }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                              {subject}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--gray-600)' }}>
                              {data.present}/{data.total} sessions
                            </div>
                            <div style={{ 
                              fontSize: '14px', 
                              fontWeight: '600',
                              color: Math.round((data.present / data.total) * 100) >= 75 ? '#10B981' : 
                                     Math.round((data.present / data.total) * 100) >= 50 ? '#F59E0B' : '#EF4444'
                            }}>
                              {Math.round((data.present / data.total) * 100)}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredStudents.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                    No students found matching "{studentSearch}"
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'class' && (
            <div>
              {/* Class Selector */}
              <div style={{ marginBottom: '24px' }}>
                <select 
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  style={{
                    padding: '12px 16px',
                    border: '1px solid var(--gray-200)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    minWidth: '200px'
                  }}
                >
                  <option value="all">Select a class</option>
                  {classes.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {selectedClass !== 'all' && (
                <div>
                  {/* Subject Summary Table */}
                  <div style={{ marginBottom: '32px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
                      Subject-wise Attendance Summary - {selectedClass}
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--gray-200)' }}>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}>Subject</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}>Total Sessions</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}>Avg Present</th>
                            <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', fontWeight: '600', color: 'var(--gray-700)' }}>Avg Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getClassSubjectData().map((data, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid var(--gray-100)' }}>
                              <td style={{ padding: '12px', fontSize: '14px' }}>{data.subject}</td>
                              <td style={{ padding: '12px', fontSize: '14px' }}>{data.totalSessions}</td>
                              <td style={{ padding: '12px', fontSize: '14px' }}>{data.avgPresent}</td>
                              <td style={{ padding: '12px', fontSize: '14px' }}>
                                <span style={{
                                  color: data.avgAttendance >= 75 ? '#10B981' : 
                                         data.avgAttendance >= 50 ? '#F59E0B' : '#EF4444',
                                  fontWeight: '500'
                                }}>
                                  {data.avgAttendance}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      
                      {getClassSubjectData().length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                          No attendance data found for {selectedClass}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bar Chart */}
                  {getClassSubjectData().length > 0 && (
                    <div>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600' }}>
                        Attendance Overview - {selectedClass}
                      </h3>
                      <div style={{
                        padding: '20px',
                        backgroundColor: 'var(--gray-50)',
                        borderRadius: '12px',
                        border: '1px solid var(--gray-200)'
                      }}>
                        <SimpleBarChart data={getClassSubjectData()} />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {selectedClass === 'all' && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>
                  Please select a class to view attendance summary
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Reports;
