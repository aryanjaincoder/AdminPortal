import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// --- Dummy data import ---
import { dummyPastSessions, dummyAnalyticsData, getFilterOptions } from '../data/dummyReportData';
// --- CSS import ---
import './Reports.css'; // Standard CSS import
// --- Icon imports ---
import {
  FiBarChart2,
  FiTrendingUp,
  FiUsers,
  FiUserCheck,
  FiPieChart,
  FiCalendar,
  FiAlertTriangle,
  FiEye,
  FiDownload,
  FiSend,
  FiArrowLeft
} from 'react-icons/fi';
// --- Chart.js imports ---
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement, // Added for Doughnut
} from 'chart.js';

// --- Register Chart.js components ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement // Added for Doughnut
);

// --- Helper: Get Initials ---
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length === 1) return name.substring(0, 2).toUpperCase();
  return (parts[0][0] + (parts[1][0] || '')).toUpperCase();
};

// --- KPI Box Component (Updated for standard CSS) ---
const KpiBox = ({ title, value, unit = '', icon }) => (
  <div className="kpiBox">
    <div className="kpiIcon">{icon}</div>
    <div className="kpiContent">
      <div className="kpiTitle">{title}</div>
      <div className="kpiValue">{value?.toFixed ? value.toFixed(1) : value}{unit}</div>
    </div>
  </div>
);

// --- Simple Chart Component (Updated for standard CSS) ---
const SimpleChart = ({ type = 'bar', title, data, options }) => {
  let ChartComponent;
  switch (type) {
    case 'line': ChartComponent = Line; break;
    case 'doughnut': ChartComponent = Doughnut; break;
    case 'bar':
    default: ChartComponent = Bar; break;
  }

  const chartOptionsWithTitle = {
    ...options,
    plugins: {
      ...options?.plugins,
      title: {
        ...options?.plugins?.title,
        text: title,
      },
      legend: {
        ...options?.plugins?.legend,
        // Specific legend options for doughnut
        display: type === 'doughnut' ? true : (options?.plugins?.legend?.display || false),
        position: type === 'doughnut' ? 'right' : 'top',
        labels: { ...options?.plugins?.legend?.labels, boxWidth: 12, font: { size: 12 } }
      }
    },
  };

  return (
    <div className="chartCard">
      <ChartComponent options={chartOptionsWithTitle} data={data} height={300} />
    </div>
  );
};

function Reports() {
  const navigate = useNavigate();
  // --- State Variables ---
  const [allSessions, setAllSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- Filter States ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOptions, setFilterOptions] = useState({ subjects: [], classes: [] });

  // --- Sorting State ---
  const [sortColumn, setSortColumn] = useState('Date');
  const [sortDirection, setSortDirection] = useState('desc');

  // --- Load dummy data ---
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setAllSessions(dummyPastSessions);
        setFilteredSessions(dummyPastSessions);
        setAnalytics(dummyAnalyticsData);
        setFilterOptions(getFilterOptions());
        setLoading(false);
      } catch (err) {
        console.error("Error loading dummy data:", err);
        setError('Failed to load report data.');
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // --- Filter/Sort Logic ---
  useEffect(() => {
    let result = [...allSessions];

    // Filter
    if (startDate) {
      result = result.filter(s => s.createdAt >= new Date(startDate));
    }
    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      result = result.filter(s => s.createdAt <= endOfDay);
    }
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = result.filter(s =>
        s.subject?.toLowerCase().includes(lowerSearchTerm) ||
        s.class?.toLowerCase().includes(lowerSearchTerm)
      );
    }
    if (selectedSubject) {
      result = result.filter(s => s.subject === selectedSubject);
    }
    if (selectedClass) {
      result = result.filter(s => s.class === selectedClass);
    }

    // Sort
    result.sort((a, b) => {
      let valA, valB;
      const getAttendanceRate = (s) => s.totalStudents ? (s.attendees?.length || 0) / s.totalStudents : 0;

      switch (sortColumn) {
        case 'Subject / Event': valA = a.subject || ''; valB = b.subject || ''; break;
        case 'Class': valA = a.class || ''; valB = b.class || ''; break;
        case 'Attendees': valA = a.attendees?.length || 0; valB = b.attendees?.length || 0; break;
        case 'Status': // Sort by %
        case 'Attendance %':
          valA = getAttendanceRate(a);
          valB = getAttendanceRate(b);
          break;
        case 'Late Comers': valA = countLateComers(a); valB = countLateComers(b); break;
        case 'Date':
        default: valA = a.createdAt || 0; valB = b.createdAt || 0; break;
      }
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredSessions(result);
  }, [allSessions, searchTerm, selectedSubject, selectedClass, startDate, endDate, sortColumn, sortDirection]);

  const countLateComers = (session) => {
    if (!session.startTime || !session.attendees) return 0;
    const gracePeriod = 5 * 60 * 1000; // 5 minutes
    const startTimeMs = session.startTime.getTime();
    return session.attendees.filter(att => att.markedAt.getTime() > startTimeMs + gracePeriod).length;
  };

  const handleSort = (columnName) => {
    if (sortColumn === columnName) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnName);
      setSortDirection('asc');
    }
  };

  // --- Sort Arrow Helper ---
  const getSortArrow = (columnName) => {
    if (sortColumn !== columnName) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  }

  // --- Chart Data ---
  const subjectChartData = {
    labels: analytics?.attendanceBySubject.map(item => item.subject) || [],
    datasets: [{
      label: 'Attendance %',
      data: analytics?.attendanceBySubject.map(item => item.percentage) || [],
      backgroundColor: 'rgba(79, 70, 229, 0.7)',
      borderColor: 'rgba(79, 70, 229, 1)',
      borderWidth: 1, borderRadius: 4, barThickness: 30
    }],
  };
  const absenteesChartData = {
    labels: analytics?.absenteesByDay.map(item => item.day) || [],
    datasets: [{
      label: 'Absentees',
      data: analytics?.absenteesByDay.map(item => item.count) || [],
      backgroundColor: 'rgba(245, 158, 11, 0.7)',
      borderColor: 'rgba(245, 158, 11, 1)',
      borderWidth: 1, borderRadius: 4, barThickness: 30
    }],
  };
  const trendChartData = {
    labels: analytics?.attendanceTrend.map(item => item.dateLabel) || [],
    datasets: [{
      label: 'Overall Attendance %',
      data: analytics?.attendanceTrend.map(item => item.percentage) || [],
      fill: true, borderColor: 'rgb(16, 185, 129)', backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.1, pointBackgroundColor: 'rgb(16, 185, 129)', pointRadius: 4,
    }],
  };
  const punctualityChartData = { // New Chart
    labels: ['On-Time', 'Late'],
    datasets: [{
      data: analytics?.punctuality || [0, 0],
      backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'],
      borderColor: ['#ffffff', '#ffffff'],
      borderWidth: 2,
    }],
  };

  // --- Chart Options ---
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: true, font: { size: 16, weight: '600' }, padding: { top: 10, bottom: 20 }, color: '#374151' },
      tooltip: { backgroundColor: '#333', titleFont: { size: 14 }, bodyFont: { size: 12 }, padding: 10, cornerRadius: 4, displayColors: false },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: '#e5e7eb' }, ticks: { font: { size: 12 }, color: '#6b7280' } },
      x: { grid: { display: false }, ticks: { font: { size: 12 }, color: '#6b7280' } },
    },
  };
  const lineChartOptions = {
    ...chartOptions,
    scales: {
      ...chartOptions.scales,
      y: { ...chartOptions.scales.y, max: 100, ticks: { ...chartOptions.scales.y.ticks, callback: (value) => value + '%' } }
    }
  };
  const doughnutChartOptions = { // New Options
    responsive: true, maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      ...chartOptions.plugins,
      legend: { display: true, position: 'right', labels: { boxWidth: 12, padding: 15, font: { size: 13 } } }
    }
  };

  if (loading) {
    return (
      <div className="pageContainer">
        <div className="loading">Loading Reports...</div>
      </div>
    );
  }

  return (
    <div className="reportsPageBackground">
      <div className="reportsContainer">

        {/* Header */}
        <div className="reportsHeader">
          <h2 className="reportsTitle">📊 Attendance Reports</h2>
          <Link to="/dashboard" className="backLink"><FiArrowLeft /> Back to Dashboard</Link>
        </div>

        {error && <p className="reportsError">{error}</p>}

        {/* KPI Section */}
        {analytics?.kpis && (
          <div className="kpiSection">
            <KpiBox icon={<FiTrendingUp />} title="Overall Attendance" value={analytics.kpis.overallAttendance} unit="%" />
            <KpiBox icon={<FiUsers />} title="Total Absentees" value={analytics.kpis.totalAbsentees} />
            <KpiBox icon={<FiUserCheck />} title="Most Attended" value={analytics.kpis.mostAttendedSubject} />
          </div>
        )}

        {/* Analytics Section */}
        {analytics && (
          <div className="analyticsSection">
            <div className="chartsWrapper">
              <SimpleChart type="bar" title="Attendance % by Subject" options={chartOptions} data={subjectChartData} />
              <SimpleChart type="bar" title="Absentees by Day" options={chartOptions} data={absenteesChartData} />
              <SimpleChart type="line" title="Attendance Trend (Overall %)" options={lineChartOptions} data={trendChartData} />

              {/* New Punctuality Chart */}
              <div className="splitCard">
                <SimpleChart type="doughnut" title="Punctuality" options={doughnutChartOptions} data={punctualityChartData} />
              </div>

              {/* Redesigned "Students at Risk" Card */}
              {analytics.lowAttendanceStudents.length > 0 && (
                <div className="studentsAtRiskCard">
                  <h3 className="atRiskTitle"><FiAlertTriangle /> Students at Risk</h3>
                  <p className="atRiskSubtitle">{analytics.lowAttendanceStudents.length} student(s) below 75% attendance.</p>
                  <ul className="studentList">
                    {analytics.lowAttendanceStudents.map(student => (
                      <li key={student.name} className="studentItem">
                        <div className="studentAvatar">{getInitials(student.name)}</div>
                        <div className="studentInfo">
                          <span className="studentName">{student.name}</span>
                          <span className="studentEmail">{student.email}</span>
                        </div>
                        <span className="statusPill statusLow">
                          {student.percentage.toFixed(0)}%
                        </span>
                        <button
                          onClick={() => alert(`Prototype: Sending email alert to ${student.email}`)}
                          className="actionButton alertButton"
                          title={`Send Alert to ${student.email}`}
                        >
                          <FiSend />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters Section */}
        <div className="filtersSection">
          <h3 className="sectionTitle"><FiCalendar /> Filter & Search History</h3>
          <div className="filtersWrapper">
            <input type="date" className="filterInput" value={startDate} onChange={e => setStartDate(e.target.value)} title="Start Date" />
            <input type="date" className="filterInput" value={endDate} onChange={e => setEndDate(e.target.value)} title="End Date" />
            <select className="filterInput" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
              <option value="">All Subjects</option>
              {filterOptions.subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="filterInput" value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
              <option value="">All Classes</option>
              {filterOptions.classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              type="search"
              placeholder="Search Subject/Class..."
              className="filterInput searchInput"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Past Sessions Table */}
        <div className="sessionSection">
          <h3 className="sectionTitle">🗓️ Session History ({filteredSessions.length})</h3>
          {filteredSessions.length === 0 && !error && <p className="noSessions">No past sessions match your filters.</p>}
          {filteredSessions.length > 0 && (
            <div className="tableContainer">
              <table className="table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('Date')}>Date {getSortArrow('Date')}</th>
                    <th onClick={() => handleSort('Subject / Event')}>Subject / Event {getSortArrow('Subject / Event')}</th>
                    <th onClick={() => handleSort('Class')}>Class {getSortArrow('Class')}</th>
                    <th onClick={() => handleSort('Attendees')}>Attendees {getSortArrow('Attendees')}</th>
                    <th onClick={() => handleSort('Attendance %')}>Att. % {getSortArrow('Attendance %')}</th>
                    <th onClick={() => handleSort('Status')}>Status {getSortArrow('Status')}</th>
                    <th onClick={() => handleSort('Late Comers')}>Late {getSortArrow('Late Comers')}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => {
                    const attendanceRate = session.totalStudents ? ((session.attendees?.length || 0) / session.totalStudents) * 100 : 0;
                    const lateCount = countLateComers(session);
                    const attendanceStatus = attendanceRate >= 75 ? 'Good' : 'Low';

                    return (
                      <tr key={session.id}>
                        <td>{session.createdAt?.toLocaleDateString ? session.createdAt.toLocaleDateString() : 'N/A'}</td>
                        <td>{session.subject || 'N/A'} {session.isGuestLecture && "(Event)"}</td>
                        <td>{session.class || 'N/A'}</td>
                        <td>{session.attendees?.length || 0} / {session.totalStudents || '?'}</td>
                        <td>{attendanceRate.toFixed(0)}%</td>
                        <td>
                          <span className={`statusPill ${attendanceStatus === 'Good' ? 'statusGood' : 'statusLow'}`}>
                            {attendanceStatus}
                          </span>
                        </td>
                        <td className={lateCount > 0 ? 'lateComers' : ''}>{lateCount}</td>
                        <td>
                          <div className="actionButtons">
                            <button className="actionButton" onClick={() => {
                              const mode = session.mode?.toLowerCase();
                              if (mode === 'nfc') {
                                navigate(`/nfc-session/${session.id}`);
                              } else if (mode === 'sound') {
                                navigate(`/sound-session/${session.id}`);
                              } else {
                                navigate(`/session/${session.id}`);
                              }
                            }} title="View Details">
                              <FiEye />
                            </button>
                            <button className="actionButton" onClick={() => alert(`Prototype: Export CSV for session ${session.id}`)} title="Export CSV">
                              <FiDownload />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default Reports;