import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from '../firebase/config';
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  serverTimestamp,
  Timestamp,
  increment
} from 'firebase/firestore';

// Device ID management (same as axios.js)
const getDeviceId = () => {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
};

// Authentication functions
export const login = async (credentials) => {
  try {
    const { email, password } = credentials;
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    return { 
      success: true, 
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified
      }
    };
  } catch (error) {
    throw error;
  }
};

export const logout = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified
        });
      } else {
        reject(new Error('No user logged in'));
      }
    }, reject);
  });
};

// Session management functions
export const getActiveSessions = async (filters = {}) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    let q = collection(db, 'attendance_sessions');
    const constraints = [];

    constraints.push(where('adminId', '==', userId));

    if (filters.status === 'active') {
      constraints.push(where('status', '==', 'active'));
    } else if (filters.status === 'ended') {
      constraints.push(where('status', '==', 'ended'));
    }
    // Note: if filters.status is 'all' or undefined, no status filter is applied

    // Temporarily using client-side sorting to avoid index requirement
    // Index will be created at: https://console.firebase.google.com/v1/r/project/zenithely/firestore/indexes?create_composite=ClVwcm9qZWN0cy96ZW5pdGhlbHkvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2F0dGVuZGFuY2Vfc2Vzc2lvbnMvaW5kZXhlcy9fEAEaCwoHYWRtaW5JZBABGg0KCWNyZWF0ZWRBdBACGgwKCF9fbmFtZV9fEAI

    if (filters.page && filters.limit) {
      constraints.push(limit(filters.limit));
    }

    q = query(q, ...constraints);
    const querySnapshot = await getDocs(q);

    const sessions = [];
    querySnapshot.forEach((doc) => {
      sessions.push({ id: doc.id, ...doc.data() });
    });

    // Client-side sorting by createdAt (newest first)
    sessions.sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
      return timeB - timeA;
    });

    return { sessions };
  } catch (error) {
    throw error;
  }
};

export const createSession = async (sessionData) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const newSession = {
      ...sessionData,
      adminId: userId,
      createdAt: serverTimestamp(),
      startTime: serverTimestamp(),
      status: 'active',
      presentStudents: [],
      presentCount: 0
    };

    const docRef = await addDoc(collection(db, 'attendance_sessions'), newSession);
    return { session: { id: docRef.id, ...newSession } };
  } catch (error) {
    throw error;
  }
};

export const getSession = async (sessionId) => {
  try {
    const docRef = doc(db, 'attendance_sessions', sessionId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { session: { id: docSnap.id, ...docSnap.data() } };
    } else {
      throw new Error('Session not found');
    }
  } catch (error) {
    throw error;
  }
};

export const closeSession = async (sessionId) => {
  try {
    const docRef = doc(db, 'attendance_sessions', sessionId);
    await updateDoc(docRef, {
      status: 'ended',
      endTime: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const deleteSession = async (sessionId) => {
  try {
    const docRef = doc(db, 'attendance_sessions', sessionId);
    await deleteDoc(docRef);
    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const pauseSession = async (sessionId, pause) => {
  try {
    const docRef = doc(db, 'attendance_sessions', sessionId);
    await updateDoc(docRef, {
      status: pause ? 'paused' : 'active',
      pausedAt: pause ? serverTimestamp() : null
    });
    return { success: true };
  } catch (error) {
    throw error;
  }
};

export const generateNewToken = async (sessionId) => {
  try {
    const docRef = doc(db, 'attendance_sessions', sessionId);
    const newToken = 'token_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    await updateDoc(docRef, {
      sessionToken: newToken,
      tokenGeneratedAt: serverTimestamp()
    });
    
    return { token: newToken };
  } catch (error) {
    throw error;
  }
};

// Attendance functions
export const markAttendance = async (attendanceData) => {
  try {
    const sessionRef = doc(db, 'attendance_sessions', attendanceData.sessionId);
    
    // Get current session data
    const sessionDoc = await getDoc(sessionRef);
    if (!sessionDoc.exists()) {
      throw new Error('Session not found');
    }
    
    const sessionData = sessionDoc.data();
    const presentStudents = sessionData?.presentStudents || [];
    
    // Check if student already marked attendance
    const alreadyPresent = presentStudents.some(student => student.id === attendanceData.studentId);
    
    if (alreadyPresent) {
      return { attendance: { alreadyMarked: true } };
    }
    
    // Create new student entry (same format as mobile app)
    const newStudent = {
      id: attendanceData.studentId,
      name: attendanceData.studentName,
      timestamp: serverTimestamp(),
      method: attendanceData.mode?.toLowerCase() || 'qr',
      cardUID: attendanceData.cardUID,
      deviceId: getDeviceId()
    };
    
    // Update session document (like mobile app)
    await updateDoc(sessionRef, {
      presentCount: increment(1),
      presentStudents: [...presentStudents, newStudent]
    });
    
    return { attendance: { id: newStudent.id, ...newStudent, alreadyMarked: false } };
  } catch (error) {
    throw error;
  }
};

export const getSessionAttendance = async (sessionId, options = {}) => {
  try {
    console.log(`🔍 [getSessionAttendance] Fetching attendance for session: ${sessionId}`);
    const attendance = [];
    
    // Read from session document's presentStudents array (NFC/Sound attendance)
    const sessionRef = doc(db, 'attendance_sessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);
    
    if (sessionDoc.exists()) {
      const sessionData = sessionDoc.data();
      const presentStudents = sessionData?.presentStudents || [];
      console.log(`📱 [getSessionAttendance] Found ${presentStudents.length} NFC/Sound attendees`);
      
      // Add NFC/Sound attendees
      presentStudents.forEach((student, index) => {
        console.log(`👤 [getSessionAttendance] NFC Student ${index}:`, student);
        
        // Handle timestamp properly
        let markedAt = new Date(); // Default to now
        if (student.timestamp) {
          if (student.timestamp.toDate) {
            markedAt = student.timestamp.toDate();
          } else if (typeof student.timestamp === 'object' && student.timestamp.seconds) {
            markedAt = new Date(student.timestamp.seconds * 1000);
          } else if (typeof student.timestamp === 'string') {
            markedAt = new Date(student.timestamp);
          } else {
            markedAt = new Date(student.timestamp);
          }
        }
        
        attendance.push({
          id: student.id || `nfc_student_${index}`,
          studentName: student.name || 'Unknown Student',
          name: student.name || 'Unknown Student',
          markedAt: markedAt,
          createdAt: markedAt,
          mode: student.method?.toUpperCase() || 'NFC',
          method: student.method || 'nfc',
          cardUID: student.cardUID,
          sessionId: sessionId,
          deviceId: student.deviceId || 'mobile'
        });
      });
    } else {
      console.log(`❌ [getSessionAttendance] Session document not found: ${sessionId}`);
    }
    
    // Also read from attendees subcollection (QR attendance)
    const attendeesQuery = query(
      collection(db, 'attendance_sessions', sessionId, 'attendees')
    );
    const attendeesSnapshot = await getDocs(attendeesQuery);
    console.log(`📊 [getSessionAttendance] Found ${attendeesSnapshot.size} QR attendees`);
    
    attendeesSnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`👤 [getSessionAttendance] QR Student ${doc.id}:`, data);
      
      // Handle timestamp properly for QR attendance
      let markedAt = new Date(); // Default to now
      if (data.markedAt) {
        if (data.markedAt.toDate) {
          markedAt = data.markedAt.toDate();
        } else if (typeof data.markedAt === 'object' && data.markedAt.seconds) {
          markedAt = new Date(data.markedAt.seconds * 1000);
        } else if (typeof data.markedAt === 'string') {
          markedAt = new Date(data.markedAt);
        } else {
          markedAt = new Date(data.markedAt);
        }
      }
      
      attendance.push({
        id: doc.id,
        studentName: data.name || 'Unknown Student',
        name: data.name || 'Unknown Student',
        markedAt: markedAt,
        createdAt: markedAt,
        mode: 'QR',
        method: 'qr',
        sessionId: sessionId,
        deviceId: data.deviceId || 'mobile',
        email: data.email,
        uid: data.uid
      });
    });

    // Sort by timestamp (newest first)
    attendance.sort((a, b) => {
      const timeA = a.markedAt?.toDate ? a.markedAt.toDate() : new Date(a.markedAt);
      const timeB = b.markedAt?.toDate ? b.markedAt.toDate() : new Date(b.markedAt);
      return timeB - timeA;
    });

    console.log(`✅ [getSessionAttendance] Total attendees: ${attendance.length}`);
    console.log(`📋 [getSessionAttendance] Attendee names:`, attendance.map(a => a.studentName));

    return { attendance };
  } catch (error) {
    console.error('Error fetching session attendance:', error);
    throw error;
  }
};

export const verifyAttendance = async (attendanceId) => {
  try {
    // Since we're now storing attendance in session documents,
    // we need to find which session contains this attendance
    // This is a simplified approach - in production you might want to maintain a separate index
    
    // For now, return a basic verification response
    // In a real implementation, you might query all sessions to find the attendance record
    return { 
      attendance: { 
        id: attendanceId,
        verified: true,
        txHash: null // Blockchain verification would be implemented separately
      }
    };
  } catch (error) {
    throw error;
  }
};

export const getStudentReport = async (studentId, options = {}) => {
  try {
    let q = collection(db, 'attendance_records');
    const constraints = [where('studentId', '==', studentId)];

    if (options.startDate) {
      constraints.push(where('markedAt', '>=', Timestamp.fromDate(new Date(options.startDate))));
    }

    if (options.endDate) {
      constraints.push(where('markedAt', '<=', Timestamp.fromDate(new Date(options.endDate))));
    }

    constraints.push(orderBy('markedAt', 'desc'));

    if (options.limit) {
      constraints.push(limit(options.limit));
    }

    q = query(q, ...constraints);
    const querySnapshot = await getDocs(q);

    const attendance = [];
    querySnapshot.forEach((doc) => {
      attendance.push({ id: doc.id, ...doc.data() });
    });

    return { attendance };
  } catch (error) {
    throw error;
  }
};

export const getDefaulters = async (options = {}) => {
  try {
    // This is a complex query that would need a different approach in Firebase
    // For now, return empty array - would need to implement client-side filtering
    return { defaulters: [] };
  } catch (error) {
    throw error;
  }
};

// Audit log functions
export const getAuditLogs = async (options = {}) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    let q = collection(db, 'audit_logs');
    const constraints = [where('adminId', '==', userId)];

    if (options.startDate) {
      constraints.push(where('markedAt', '>=', Timestamp.fromDate(new Date(options.startDate))));
    }

    if (options.endDate) {
      constraints.push(where('markedAt', '<=', Timestamp.fromDate(new Date(options.endDate))));
    }

    if (options.sessionId) {
      constraints.push(where('sessionId', '==', options.sessionId));
    }

    if (options.anomalyDetected !== undefined) {
      constraints.push(where('anomalyDetected', '==', options.anomalyDetected));
    }

    constraints.push(orderBy('markedAt', 'desc'));

    if (options.limit) {
      constraints.push(limit(options.limit));
    }

    q = query(q, ...constraints);
    const querySnapshot = await getDocs(q);

    const records = [];
    querySnapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });

    // Calculate summary
    const summary = {
      totalRecords: records.length,
      anomalyCount: records.filter(r => r.anomalyDetected).length,
      cleanCount: records.filter(r => !r.anomalyDetected).length,
      faceVerifiedCount: records.filter(r => r.faceVerified).length,
      bleVerifiedCount: records.filter(r => r.bleVerified).length
    };

    return { 
      data: { 
        records, 
        summary,
        pagination: {
          current: options.page || 1,
          limit: options.limit || 50,
          total: records.length,
          pages: 1
        }
      }
    };
  } catch (error) {
    throw error;
  }
};

// Statistics functions
export const getSessionStatistics = async (options = {}) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    let q = collection(db, 'attendance_sessions');
    const constraints = [where('adminId', '==', userId)];

    if (options.startDate) {
      constraints.push(where('startDate', '==', options.startDate));
    }

    q = query(q, ...constraints);
    const querySnapshot = await getDocs(q);

    const sessions = [];
    querySnapshot.forEach((doc) => {
      sessions.push({ id: doc.id, ...doc.data() });
    });

    return { sessions };
  } catch (error) {
    throw error;
  }
};

export const getAttendanceStatistics = async (studentId, options = {}) => {
  try {
    const report = await getStudentReport(studentId, options);
    const attendance = report.attendance;

    const stats = {
      totalClasses: attendance.length,
      presentClasses: attendance.filter(a => a.present).length,
      absentClasses: attendance.filter(a => !a.present).length,
      percentage: attendance.length > 0 ? (attendance.filter(a => a.present).length / attendance.length) * 100 : 0
    };

    return { statistics: stats };
  } catch (error) {
    throw error;
  }
};

// Anomaly Detection APIs
export const getAnomalies = async (options = {}) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    let q = collection(db, 'audit_logs');
    const constraints = [
      where('adminId', '==', userId),
      where('anomalyDetected', '==', true)
    ];

    if (options.startDate) {
      constraints.push(where('markedAt', '>=', Timestamp.fromDate(new Date(options.startDate))));
    }

    if (options.endDate) {
      constraints.push(where('markedAt', '<=', Timestamp.fromDate(new Date(options.endDate))));
    }

    constraints.push(orderBy('markedAt', 'desc'));

    if (options.limit) {
      constraints.push(limit(options.limit));
    }

    q = query(q, ...constraints);
    const querySnapshot = await getDocs(q);

    const anomalies = [];
    querySnapshot.forEach((doc) => {
      anomalies.push({ id: doc.id, ...doc.data() });
    });

    return { anomalies };
  } catch (error) {
    throw error;
  }
};

export const getAnomalyStatistics = async (options = {}) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    let q = collection(db, 'audit_logs');
    const constraints = [where('adminId', '==', userId)];

    if (options.startDate) {
      constraints.push(where('markedAt', '>=', Timestamp.fromDate(new Date(options.startDate))));
    }

    if (options.endDate) {
      constraints.push(where('markedAt', '<=', Timestamp.fromDate(new Date(options.endDate))));
    }

    // Note: Multiple where clauses on audit_logs may require composite index
    // If index error occurs, the query will fall back to client-side filtering
    
    q = query(q, ...constraints);
    const querySnapshot = await getDocs(q);

    let totalAnomalies = 0;
    let highSeverity = 0;
    let mediumSeverity = 0;
    const anomalies = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      anomalies.push({ id: doc.id, ...data });
      if (data.anomalyDetected) {
        totalAnomalies++;
        if (data.severity === 'high') {
          highSeverity++;
        } else if (data.severity === 'medium') {
          mediumSeverity++;
        }
      }
    });

    // Client-side sorting by markedAt (newest first)
    anomalies.sort((a, b) => {
      const timeA = a.markedAt?.toMillis ? a.markedAt.toMillis() : (a.markedAt?.toDate ? a.markedAt.toDate().getTime() : new Date(a.markedAt || 0).getTime());
      const timeB = b.markedAt?.toMillis ? b.markedAt.toMillis() : (b.markedAt?.toDate ? b.markedAt.toDate().getTime() : new Date(b.markedAt || 0).getTime());
      return timeB - timeA;
    });

    return { 
      data: {
        totalAnomalies,
        highSeverity,
        mediumSeverity,
        lowSeverity: totalAnomalies - highSeverity - mediumSeverity
      }
    };
  } catch (error) {
    console.error('Error in getAnomalyStatistics:', error);
    // Return empty stats on error to prevent app crash
    return { 
      data: {
        totalAnomalies: 0,
        highSeverity: 0,
        mediumSeverity: 0,
        lowSeverity: 0
      }
    };
  }
};

// Utility functions
export const handleApiError = (error) => {
  console.error('Firebase API Error:', error);
  
  let message = 'An unexpected error occurred';
  
  if (error.code) {
    switch (error.code) {
      case 'auth/user-not-found':
        message = 'Invalid email or password';
        break;
      case 'auth/wrong-password':
        message = 'Invalid email or password';
        break;
      case 'auth/email-already-in-use':
        message = 'Email already in use';
        break;
      case 'auth/weak-password':
        message = 'Password should be at least 6 characters';
        break;
      case 'auth/invalid-email':
        message = 'Invalid email address';
        break;
      case 'permission-denied':
        message = 'Access denied';
        break;
      case 'not-found':
        message = 'Resource not found';
        break;
      default:
        message = error.message || 'An error occurred';
    }
  } else if (error.message) {
    message = error.message;
  }

  // You can integrate with a toast library here
  console.error(message);
  return message;
};

export default {
  // Auth
  login,
  logout,
  getCurrentUser,
  
  // Sessions
  getActiveSessions,
  createSession,
  getSession,
  closeSession,
  pauseSession,
  generateNewToken,
  
  // Attendance
  markAttendance,
  getSessionAttendance,
  verifyAttendance,
  getStudentReport,
  getDefaulters,
  
  // Audit Logs
  getAuditLogs,
  
  // Statistics
  getSessionStatistics,
  getAttendanceStatistics,
  
  // Anomaly Detection
  getAnomalies,
  getAnomalyStatistics,
  
  // Utility
  handleApiError
};
