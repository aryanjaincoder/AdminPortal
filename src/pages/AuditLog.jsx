import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, limit, startAfter, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import './AuditLog.css';
import {
  FiShield,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiFilter,
  FiCalendar,
  FiSearch,
  FiCpu,
  FiActivity,
  FiTrendingUp
} from 'react-icons/fi';

function AuditLog() {
  const [auditRecords, setAuditRecords] = useState([]);
  const [summary, setSummary] = useState({
    totalRecords: 0,
    anomalyCount: 0,
    cleanCount: 0,
    faceVerifiedCount: 0,
    bleVerifiedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0,
    limit: 50,
    lastDoc: null
  });

  // Filter States
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    sessionId: '',
    anomalyDetected: ''
  });

  // Sessions for dropdown
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Fetch sessions for dropdown
  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const q = query(
        collection(db, 'attendance_sessions'),
        where('adminId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      const querySnapshot = await getDocs(q);
      const allSessions = [];
      querySnapshot.forEach((doc) => {
        allSessions.push({ id: doc.id, ...doc.data() });
      });
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Fetch sessions on component mount
  useEffect(() => {
    fetchSessions();
  }, []);

  // Calculate summary from records
  const calculateSummary = (records) => {
    const summary = {
      totalRecords: records.length,
      anomalyCount: records.filter(r => r.anomalyDetected).length,
      cleanCount: records.filter(r => !r.anomalyDetected).length,
      faceVerifiedCount: records.filter(r => r.faceVerified).length,
      bleVerifiedCount: records.filter(r => r.bleVerified).length
    };
    setSummary(summary);
  };

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoading(true);
      
      let q = collection(db, 'audit_logs');
      const constraints = [];

      // Apply filters
      if (filters.startDate) {
        constraints.push(where('markedAt', '>=', new Date(filters.startDate)));
      }
      if (filters.endDate) {
        constraints.push(where('markedAt', '<=', new Date(filters.endDate + 'T23:59:59')));
      }
      if (filters.sessionId) {
        constraints.push(where('sessionId', '==', filters.sessionId));
      }
      if (filters.anomalyDetected !== '') {
        constraints.push(where('anomalyDetected', '==', filters.anomalyDetected === 'true'));
      }

      // Add ordering and pagination
      constraints.push(orderBy('markedAt', 'desc'));
      constraints.push(limit(pagination.limit));

      if (pagination.lastDoc && pagination.current > 1) {
        constraints.push(startAfter(pagination.lastDoc));
      }

      q = query(q, ...constraints);

      const querySnapshot = await getDocs(q);
      const records = [];
      let lastDoc = null;

      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
        lastDoc = doc;
      });

      setAuditRecords(records);
      calculateSummary(records);
      
      // Update pagination
      setPagination(prev => ({
        ...prev,
        lastDoc: lastDoc,
        total: records.length < prev.limit ? prev.total : prev.total + records.length
      }));

      setError('');
      
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError('Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, pagination.current, pagination.lastDoc]);

  // Fetch audit logs
  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  // Helper functions
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1, lastDoc: null })); // Reset pagination
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, current: newPage }));
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.toDate ? timestamp.toDate() : timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.toDate ? timestamp.toDate() : timestamp).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getModeIcon = (mode) => {
    const modeIcons = {
      QR: <FiCpu title="QR Code" />,
      NFC: <FiActivity title="NFC" />,
      SOUND: <FiActivity title="Ultrasonic" />,
      BLE: <FiActivity title="BLE" />,
      P2P: <FiActivity title="P2P" />
    };
    return modeIcons[mode] || <FiCpu />;
  };

  const getRowClass = (record) => {
    return record.anomalyDetected ? 'anomaly-row' : 'clean-row';
  };

  const getAnomalyBadge = (anomalyDetected) => {
    if (anomalyDetected) {
      return (
        <span className="anomaly-badge anomaly-detected">
          <FiAlertTriangle /> Flagged
        </span>
      );
    }
    return (
      <span className="anomaly-badge clean">
        <FiCheckCircle /> Clean
      </span>
    );
  };

  const getVerificationIcon = (verified) => {
    return verified ? 
      <FiCheckCircle className="verified-icon" /> : 
      <FiXCircle className="unverified-icon" />;
  };

  if (loading) {
    return (
      <div className="audit-log-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="audit-log-container">
      {/* Header */}
      <div className="audit-header">
        <div className="header-content">
          <div className="header-text">
            <h1>
              <FiShield /> Cybersecurity Audit Log
            </h1>
            <p>Attendance verification and anomaly detection records</p>
          </div>
          <Link to="/dashboard" className="back-link">
            ← Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-grid">
        <div className="summary-card total">
          <div className="summary-icon">
            <FiTrendingUp />
          </div>
          <div className="summary-details">
            <h3>{summary.totalRecords}</h3>
            <p>Total Records</p>
          </div>
        </div>

        <div className="summary-card clean">
          <div className="summary-icon">
            <FiCheckCircle />
          </div>
          <div className="summary-details">
            <h3>{summary.cleanCount}</h3>
            <p>Clean Records</p>
          </div>
        </div>

        <div className="summary-card anomaly">
          <div className="summary-icon">
            <FiAlertTriangle />
          </div>
          <div className="summary-details">
            <h3>{summary.anomalyCount}</h3>
            <p>Anomalies Detected</p>
          </div>
        </div>

        <div className="summary-card verification">
          <div className="summary-icon">
            <FiShield />
          </div>
          <div className="summary-details">
            <h3>{summary.faceVerifiedCount}</h3>
            <p>Face Verified</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-header">
          <h3><FiFilter /> Filters</h3>
        </div>
        <div className="filters-grid">
          <div className="filter-group">
            <label><FiCalendar /> Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label><FiCalendar /> End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label><FiSearch /> Select Session</label>
            <select
              value={filters.sessionId}
              onChange={(e) => handleFilterChange('sessionId', e.target.value)}
              disabled={loadingSessions}
            >
              <option value="">All Sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.subject} - {session.className} ({new Date(session.createdAt?.toDate ? session.createdAt.toDate() : session.createdAt).toLocaleDateString()})
                </option>
              ))}
            </select>
            {loadingSessions && (
              <small style={{ color: '#666', fontSize: '12px' }}>Loading sessions...</small>
            )}
          </div>

          <div className="filter-group">
            <label><FiAlertTriangle /> Anomaly Status</label>
            <select
              value={filters.anomalyDetected}
              onChange={(e) => handleFilterChange('anomalyDetected', e.target.value)}
            >
              <option value="">All Records</option>
              <option value="true">Anomalies Only</option>
              <option value="false">Clean Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="audit-table-section">
        <div className="table-header">
          <h3>Attendance Records</h3>
          <span className="record-count">{auditRecords.length} records</span>
        </div>

        <div className="table-container">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Time</th>
                <th>Mode</th>
                <th>Face ✅</th>
                <th>BLE ✅</th>
                <th>Blockchain</th>
                <th>Anomaly</th>
              </tr>
            </thead>
            <tbody>
              {auditRecords.map((record) => (
                <tr key={record.id} className={getRowClass(record)}>
                  <td>
                    <div className="student-info">
                      <div className="student-name">{record.studentName}</div>
                      <div className="student-email">{record.studentEmail}</div>
                    </div>
                  </td>
                  <td>
                    <div className="time-info">
                      <div className="time">{formatTime(record.markedAt)}</div>
                      <div className="date">{formatDate(record.markedAt)}</div>
                    </div>
                  </td>
                  <td>
                    <div className="mode-info">
                      {getModeIcon(record.mode)}
                      <span>{record.mode}</span>
                    </div>
                  </td>
                  <td>
                    {getVerificationIcon(record.faceVerified)}
                  </td>
                  <td>
                    {getVerificationIcon(record.bleVerified)}
                  </td>
                  <td>
                    <div className="blockchain-hash">
                      <code>{record.blockchainHash}</code>
                    </div>
                  </td>
                  <td>
                    {getAnomalyBadge(record.anomalyDetected)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {auditRecords.length === 0 && (
            <div className="no-records">
              <FiAlertTriangle />
              <p>No audit records found matching the current filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Simple Pagination */}
      {auditRecords.length === pagination.limit && (
        <div className="pagination-section">
          <div className="pagination-controls">
            <button
              onClick={() => handlePageChange(pagination.current - 1)}
              disabled={pagination.current === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            
            <button
              onClick={() => handlePageChange(pagination.current + 1)}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLog;
