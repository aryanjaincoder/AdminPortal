// src/data/dummyReportData.js

// Helper function to create past dates easily
const pastDate = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date;
};

// --- Dummy Student List (for reference, not directly used in Reports page) ---
const students = [
  { id: 'stud1', name: 'Rohan Sharma', email: 'rohan@example.com' },
  { id: 'stud2', name: 'Priya Singh', email: 'priya@example.com' },
  { id: 'stud3', name: 'Amit Kumar', email: 'amit@example.com' },
  { id: 'stud4', name: 'Sneha Patel', email: 'sneha@example.com' },
  { id: 'stud5', name: 'Vikram Rao', email: 'vikram@example.com' },
];

// --- Dummy Past Sessions Data (Updated with more details) ---
export const dummyPastSessions = [
  {
    id: 'session1',
    subject: 'Introduction to Programming', // Cleaner display name
    subjectCode: 'cs101', // Code for reference
    class: 'BCA 1st Sem',
    createdAt: pastDate(2), // Session date (2 days ago)
    startTime: new Date(pastDate(2).setHours(9, 0, 0)), // Session started at 9:00 AM
    totalStudents: 5, // Total students in BCA 1st Sem
    status: 'closed',
    adminId: 'admin_uid_abc', // Example Admin ID
    isGuestLecture: false,
    attendees: [
      { id: 'stud1', name: 'Rohan Sharma', markedAt: new Date(pastDate(2).setHours(9, 5, 0)) }, // On time (within 5 mins)
      { id: 'stud2', name: 'Priya Singh', markedAt: new Date(pastDate(2).setHours(9, 6, 15)) }, // Late (6 mins)
      { id: 'stud4', name: 'Sneha Patel', markedAt: new Date(pastDate(2).setHours(9, 7, 30)) }, // Late (7 mins)
    ],
  },
  {
    id: 'session2',
    subject: 'Linear Algebra',
    subjectCode: 'ma202',
    class: 'BCA 3rd Sem',
    createdAt: pastDate(5),
    startTime: new Date(pastDate(5).setHours(11, 0, 0)), // Started at 11:00 AM
    totalStudents: 5, // Assume 5 students in BCA 3rd Sem too
    status: 'closed',
    adminId: 'admin_uid_abc',
    isGuestLecture: false,
    attendees: [
      { id: 'stud1', name: 'Rohan Sharma', markedAt: new Date(pastDate(5).setHours(11, 2, 0)) }, // On time
      { id: 'stud2', name: 'Priya Singh', markedAt: new Date(pastDate(5).setHours(11, 3, 0)) }, // On time
      { id: 'stud3', name: 'Amit Kumar', markedAt: new Date(pastDate(5).setHours(11, 4, 0)) }, // On time
      { id: 'stud4', name: 'Sneha Patel', markedAt: new Date(pastDate(5).setHours(11, 5, 0)) }, // On time
      { id: 'stud5', name: 'Vikram Rao', markedAt: new Date(pastDate(5).setHours(11, 6, 0)) }, // Late (6 mins)
    ],
  },
  {
    id: 'session3',
    subject: 'Workshop on AI',
    subjectCode: 'event01',
    class: 'Guest Lecture',
    createdAt: pastDate(7),
    startTime: new Date(pastDate(7).setHours(14, 0, 0)), // Started at 2:00 PM
    totalStudents: 5, // Assume same 5 students eligible for workshop
    status: 'closed',
    adminId: 'admin_uid_abc',
    isGuestLecture: true,
    attendees: [
      { id: 'stud2', name: 'Priya Singh', markedAt: new Date(pastDate(7).setHours(14, 10, 0)) }, // Late (10 mins)
      { id: 'stud3', name: 'Amit Kumar', markedAt: new Date(pastDate(7).setHours(14, 12, 0)) }, // Late (12 mins)
      { id: 'stud5', name: 'Vikram Rao', markedAt: new Date(pastDate(7).setHours(14, 15, 0)) }, // Late (15 mins)
    ],
  },
   {
    id: 'session4',
    subject: 'Introduction to Programming',
    subjectCode: 'cs101',
    class: 'BCA 1st Sem',
    createdAt: pastDate(9),
    startTime: new Date(pastDate(9).setHours(9, 0, 0)), // Started at 9:00 AM
    totalStudents: 5,
    status: 'closed',
    adminId: 'admin_uid_abc',
    isGuestLecture: false,
    attendees: [
      { id: 'stud1', name: 'Rohan Sharma', markedAt: new Date(pastDate(9).setHours(9, 5, 0)) }, // On time
    ],
  },
  // Add more sessions if needed for better analytics
];

// --- Dummy Analytics Data (Derived from above sessions for demo) ---

// Helper to calculate overall attendance %
const calculateOverallAttendance = () => {
    let totalAttended = 0;
    let totalPossible = 0;
    dummyPastSessions.forEach(session => {
        totalAttended += session.attendees.length;
        totalPossible += session.totalStudents;
    });
    return totalPossible > 0 ? (totalAttended / totalPossible) * 100 : 0;
};

// Helper to calculate total absentees
const calculateTotalAbsentees = () => {
    let totalAbsentees = 0;
    dummyPastSessions.forEach(session => {
        totalAbsentees += (session.totalStudents - session.attendees.length);
    });
    return totalAbsentees;
};

// Simplified calculation for low attendance students
const calculateLowAttendance = () => {
    const studentAttendance = {}; // { studId: { attended: X, total: Y } }
    dummyPastSessions.forEach(session => {
        const eligibleStudents = students.slice(0, session.totalStudents); // Assuming first N students are eligible
        eligibleStudents.forEach(stud => {
            if (!studentAttendance[stud.id]) {
                studentAttendance[stud.id] = { attended: 0, total: 0, name: stud.name, email: stud.email };
            }
            studentAttendance[stud.id].total++;
            if (session.attendees.some(att => att.id === stud.id)) {
                studentAttendance[stud.id].attended++;
            }
        });
    });

    const lowAttendance = [];
    for (const studId in studentAttendance) {
        const record = studentAttendance[studId];
        const percentage = record.total > 0 ? (record.attended / record.total) * 100 : 0;
        if (percentage < 75) {
            lowAttendance.push({ name: record.name, percentage: percentage, email: record.email });
        }
    }
    return lowAttendance;
};

// Group attendance by subject
const calculateAttendanceBySubject = () => {
    const subjectData = {}; // { subject: { attended: X, total: Y } }
    dummyPastSessions.forEach(session => {
        if (!subjectData[session.subject]) {
            subjectData[session.subject] = { attended: 0, total: 0 };
        }
        subjectData[session.subject].attended += session.attendees.length;
        subjectData[session.subject].total += session.totalStudents;
    });
    return Object.entries(subjectData).map(([subject, data]) => ({
        subject: subject,
        percentage: data.total > 0 ? (data.attended / data.total) * 100 : 0
    }));
};

// Group absentees by day of week
const calculateAbsenteesByDay = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const absenteesByDay = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    dummyPastSessions.forEach(session => {
        const dayName = days[session.createdAt.getDay()];
        absenteesByDay[dayName] += (session.totalStudents - session.attendees.length);
    });
     // Format for chart
     return Object.entries(absenteesByDay).map(([day, count]) => ({ day, count }));
};

// Create Trend Data
const calculateAttendanceTrend = () => {
    // Sort sessions by date ascending
    const sortedSessions = [...dummyPastSessions].sort((a, b) => a.createdAt - b.createdAt);
    return sortedSessions.map(session => ({
        dateLabel: session.createdAt.toLocaleDateString('en-CA'), // YYYY-MM-DD format for consistency
        percentage: session.totalStudents > 0 ? (session.attendees.length / session.totalStudents) * 100 : 0
    }));
};

// --- NEW HELPER: Calculate Punctuality ---
const calculatePunctuality = () => {
    let onTime = 0;
    let late = 0;
    const gracePeriod = 5 * 60 * 1000; // 5 minutes

    dummyPastSessions.forEach(session => {
        if (!session.startTime || !session.attendees) return;
        const startTimeMs = session.startTime.getTime();
        session.attendees.forEach(att => {
            if (att.markedAt.getTime() > startTimeMs + gracePeriod) {
                late++;
            } else {
                onTime++;
            }
        });
    });
    return [onTime, late];
};


export const dummyAnalyticsData = {
  // --- KPIs ---
  kpis: {
      overallAttendance: calculateOverallAttendance(),
      totalAbsentees: calculateTotalAbsentees(),
      mostAttendedSubject: 'Linear Algebra', // Hardcoded based on data
  },
  // --- Chart Data ---
  attendanceBySubject: calculateAttendanceBySubject(),
  absenteesByDay: calculateAbsenteesByDay(),
  // --- Trend Data ---
  attendanceTrend: calculateAttendanceTrend(),
  // --- Alerts ---
  lowAttendanceStudents: calculateLowAttendance(),
  // --- NEW DATA ---
  punctuality: calculatePunctuality(),
};

// --- Helper to get unique subjects and classes for filters ---
export const getFilterOptions = () => {
    const subjects = new Set();
    const classes = new Set();
    dummyPastSessions.forEach(session => {
        // Exclude Guest Lecture from class filter if desired
        if (session.subject) subjects.add(session.subject);
        if (session.class && !session.isGuestLecture) classes.add(session.class);
    });
    return {
        subjects: Array.from(subjects).sort(), // Sort alphabetically
        classes: Array.from(classes).sort(),
    };
};