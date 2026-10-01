import React, { useEffect, useState } from "react";
import { apiFetch } from "../api";
import AddDropModal from "../components/AddDropModal";

// Stamford Grade to Grade Points mapping
const GRADE_POINTS = {
  A: 4.0,
  "B+": 3.5,
  B: 3.0,
  "C+": 2.5,
  C: 2.0,
  "D+": 1.5,
  D: 1.0,
  F: 0.0,
};

// Helper function to return background and text color based on GPA score
const getGpaBadgeStyle = (gpaVal) => {
  const gpa = parseFloat(gpaVal) || 0;
  if (gpa >= 3.5) {
    return { backgroundColor: "#5cd67c", color: "#0f5122" }; // Emerald Green
  } else if (gpa >= 3.0) {
    return { backgroundColor: "#d4ed31", color: "#3b4d00" }; // Lime Green
  } else if (gpa >= 2.0) {
    return { backgroundColor: "#fadb36", color: "#524500" }; // Warm Yellow
  } else {
    return { backgroundColor: "#e83f33", color: "#ffffff" }; // Red Warning
  }
};

// Helper function to parse term string and convert to chronological sort key
const getTermSortKey = (termStr) => {
  if (!termStr) return 0;

  const semMatch = termStr.match(/Semester\s*(\d+)\s*\/\s*(\d{4})/i);
  if (semMatch) {
    const sem = parseInt(semMatch[1], 10);
    const year = parseInt(semMatch[2], 10);
    return year * 10 + sem;
  }

  const dashMatch = termStr.match(/(\d{4})\s*-\s*(\d+)/);
  if (dashMatch) {
    const year = parseInt(dashMatch[1], 10);
    const sem = parseInt(dashMatch[2], 10);
    return year * 10 + sem;
  }

  return 0;
};

export default function StudentDashboard({ user }) {
  const [registrations, setRegistrations] = useState([]);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);

  useEffect(() => {
    apiFetch("/students/me/registrations")
      .then(setRegistrations)
      .catch(console.error);

    apiFetch("/students/me/record")
      .then(setRecords)
      .catch((err) =>
        setRecordsError(err.message || "Unable to load grade results."),
      )
      .finally(() => setRecordsLoading(false));
  }, []);

  const processTranscript = (rawRecords) => {
    const transferCourses = [];
    const termMap = {};

    rawRecords.forEach((rec) => {
      const course = rec.courseId || {};
      const credits = course.credits || 4;
      const grade = rec.grade;

      if (grade === "TR") {
        transferCourses.push({
          code: course.code || "N/A",
          name: course.title || "Transfer Credit",
          credits,
          grade: "TR",
        });
        return;
      }

      const term = rec.term || "Previous Term";
      if (!termMap[term]) {
        termMap[term] = [];
      }

      termMap[term].push({
        code: course.code || "N/A",
        name: course.title || "Course",
        credits,
        grade,
        gp: (GRADE_POINTS[grade] ?? 0) * credits,
      });
    });

    const sortedTerms = Object.keys(termMap).sort((a, b) => {
      return getTermSortKey(a) - getTermSortKey(b);
    });

    let cumRegister = 0;
    let cumEarn = 0;
    let cumCA = 0;
    let cumGP = 0;

    const transcriptSemesters = sortedTerms.map((termKey) => {
      const courses = termMap[termKey];

      let thisRegister = 0;
      let thisEarn = 0;
      let thisCA = 0;
      let thisGP = 0;

      courses.forEach((c) => {
        thisRegister += c.credits;

        // Earned credits: Passed grades and TR
        if (c.grade in GRADE_POINTS && c.grade !== "F") {
          thisEarn += c.credits;
        }

        // Credits Attempted (CA) & GP: Count A, B+, B, C+, C, D+, D, F. EXCLUDE W, IP, TR!
        if (c.grade in GRADE_POINTS) {
          thisCA += c.credits;
          thisGP += c.gp;
        }
      });

      const thisGPA = thisCA > 0 ? (thisGP / thisCA).toFixed(2) : "0.00";

      cumRegister += thisRegister;
      cumEarn += thisEarn;
      cumCA += thisCA;
      cumGP += thisGP;

      const cumGPA = cumCA > 0 ? (cumGP / cumCA).toFixed(2) : "0.00";

      return {
        term: termKey,
        courses,
        thisSem: {
          cRegister: thisRegister,
          cEarn: thisEarn,
          ca: thisCA,
          gp: thisGP,
          gpa: thisGPA,
        },
        cumSem: {
          cRegister: cumRegister,
          cEarn: cumEarn,
          ca: cumCA,
          gp: cumGP,
          gpa: cumGPA,
        },
      };
    });

    const finalCGPA = cumCA > 0 ? (cumGP / cumCA).toFixed(2) : "0.00";

    return { transferCourses, transcriptSemesters, cumEarn, finalCGPA };
  };

  const { transferCourses, transcriptSemesters, cumEarn, finalCGPA } =
    processTranscript(records);

  const topCgpaStyle = getGpaBadgeStyle(finalCGPA);

  return (
    <div className="container-xxl student-dashboard dashboard-stack pb-5 text-body bg-body-tertiary p-3 p-md-4 rounded-4">
      {/* Top Banner & Quick Metrics */}
      <div className="card border-0 dashboard-card d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-4 bg-white p-4">
        <div>
          <span className="dashboard-caption fw-bold text-primary bg-primary-subtle px-3 py-1 rounded-pill text-uppercase">
            Student Dashboard
          </span>
          <h2 className="fs-3 fw-bold text-dark mt-2">
            Welcome back, {user.name}!
          </h2>
          <p className="dashboard-caption text-secondary mt-1">
            Student ID:{" "}
            <span className="fw-semibold text-body-secondary">
              {user.studentId || "STU1002"}
            </span>
          </p>
        </div>

        {/* Dynamic Highlight Cards with Dynamic GPA Colors */}
        <div className="metrics-group d-flex align-items-center gap-3">
          <div
            className="p-3 rounded-4 flex-fill metric-card text-center border"
            style={{
              backgroundColor: topCgpaStyle.backgroundColor,
              borderColor: topCgpaStyle.backgroundColor,
            }}
          >
            <p
              className="dashboard-caption fw-bold text-uppercase mb-0"
              style={{ color: topCgpaStyle.color, opacity: 0.85 }}
            >
              Cumulative GPA
            </p>
            <p
              className="fs-3 fw-bold mt-1 mb-0"
              style={{ color: topCgpaStyle.color }}
            >
              {finalCGPA}
            </p>
          </div>
          <div className="bg-primary-subtle border border-primary-subtle p-3 rounded-4 flex-fill metric-card text-center">
            <p className="dashboard-caption fw-bold text-primary-emphasis text-uppercase mb-0">
              Credits Earned
            </p>
            <p className="fs-3 fw-bold text-primary-emphasis mt-1 mb-0">
              {cumEarn}
            </p>
          </div>
        </div>
      </div>

      {/* --- Section 1: Active Registered Courses --- */}
      <div className="card border-0 dashboard-card p-4 dashboard-stack">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h3 className="fs-6 fw-bold text-dark">
              Active Learning Programs (Term 2026-1)
            </h3>
            <p className="dashboard-caption text-secondary">
              Currently enrolled course sections and status
            </p>
          </div>
          <span className="dashboard-caption fw-bold text-success-emphasis bg-success-subtle border border-success-subtle px-3 py-1 rounded-pill">
            Active Term
          </span>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle text-start mb-0">
            <thead>
              <tr className="dashboard-caption fw-bold text-secondary text-uppercase">
                <th className="pb-3">Course</th>
                <th className="pb-3">Schedule</th>
                <th className="pb-3">Room</th>
                <th className="pb-3">Instructor</th>
                <th className="pb-3">Add/Drop</th>
                <th className="pb-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="dashboard-caption">
              {registrations.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="py-4 text-center text-secondary fw-medium"
                  >
                    No active course registrations found for the current term.
                  </td>
                </tr>
              ) : (
                registrations.map((r) => (
                  <tr key={r._id}>
                    <td className="py-3 fw-bold text-body">
                      {r.offeringId?.courseId?.code}{" "}
                      <span className="fw-medium text-secondary">
                        — {r.offeringId?.courseId?.title}
                      </span>
                    </td>
                    <td className="py-3 text-secondary">
                      {r.offeringId?.day} {r.offeringId?.startTime}-
                      {r.offeringId?.endTime}
                    </td>
                    <td className="py-3 text-secondary">
                      {r.offeringId?.room}
                    </td>
                    <td className="py-3 text-secondary">
                      {r.offeringId?.instructor}
                    </td>
                    <td className="py-3">
                      {r.offeringId?.addDropOpen ? (
                        <span className="d-inline-flex align-items-center gap-2 bg-success-subtle text-success-emphasis dashboard-caption fw-bold px-2 py-1 rounded-pill border border-success-subtle">
                          <span className="registration-dot bg-success rounded-pill"></span>{" "}
                          Open
                        </span>
                      ) : (
                        <span className="d-inline-flex align-items-center bg-light text-secondary dashboard-caption fw-semibold px-2 py-1 rounded-pill">
                          Closed
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      {r.offeringId?.addDropOpen && (
                        <button
                          onClick={() =>
                            setSelectedCourse(r.offeringId?.courseId)
                          }
                          className="btn btn-dark btn-sm fw-bold"
                        >
                          Request Add/Drop
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Section 2: Dynamic Academic Progress & Transcript Grid --- */}
      <div className="row g-4">
        {/* Left Column (2/3): Dynamic Semester Transcript Breakdown */}
        <div className="col-lg-8 dashboard-stack">
          <div className="d-flex align-items-center justify-content-between">
            <h3 className="fs-6 fw-bold text-dark">Academic History</h3>
            <span className="dashboard-caption fw-medium text-secondary">
              Grade results
            </span>
          </div>

          {recordsError && (
            <div className="alert alert-danger mb-0" role="alert">
              {recordsError}
            </div>
          )}

          {recordsLoading ? (
            <div className="card border-0 dashboard-card p-4 text-center text-secondary">
              Loading grade results...
            </div>
          ) : !recordsError && records.length === 0 ? (
            <div className="card border-0 dashboard-card p-4 text-center text-secondary">
              No grade results are available yet.
            </div>
          ) : null}

          {/* Transfer Courses Card */}
          {!recordsLoading && transferCourses.length > 0 && (
            <div className="card border-0 dashboard-card p-3 p-md-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="dashboard-caption fw-bold text-danger-emphasis bg-danger-subtle px-2 py-1 rounded-3">
                  TRANSFER COURSE
                </span>
                <span className="dashboard-caption text-secondary">
                  Credits from Examination
                </span>
              </div>

              <div className="table-responsive">
                <table className="table table-borderless align-middle mb-0 dashboard-caption">
                  <thead>
                    <tr
                      className="border-bottom text-uppercase text-secondary fw-bold"
                      style={{ fontSize: "11px" }}
                    >
                      <th className="pb-2">Course Code</th>
                      <th className="pb-2">Course Name</th>
                      <th className="pb-2 text-center">Credits</th>
                      <th className="pb-2 text-end">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferCourses.map((c, idx) => (
                      <tr key={idx}>
                        <td className="fw-bold text-body py-2">{c.code}</td>
                        <td className="text-secondary py-2">{c.name}</td>
                        <td className="text-center text-secondary py-2">
                          {c.credits} Credits
                        </td>
                        <td className="text-end py-2">
                          <span className="fw-bold text-danger bg-danger-subtle px-2 py-1 rounded">
                            {c.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dynamic Semester Cards */}
          {!recordsLoading &&
            transcriptSemesters.map((sem, sIdx) => {
              const semGpaStyle = getGpaBadgeStyle(sem.thisSem.gpa);
              const cumGpaStyle = getGpaBadgeStyle(sem.cumSem.gpa);

              return (
                <div
                  key={sIdx}
                  className="card border-0 dashboard-card p-3 p-md-4 dashboard-stack"
                >
                  <div className="d-flex justify-content-between align-items-center border-bottom border-light pb-3">
                    <h4 className="small fw-bold text-primary-emphasis mb-0">
                      {sem.term}
                    </h4>
                    <div className="d-flex align-items-center gap-2">
                      <span className="dashboard-caption fw-semibold text-secondary">
                        GPA:
                      </span>
                      <span
                        className="dashboard-caption fw-bold px-2 py-1 rounded-pill"
                        style={{
                          backgroundColor: semGpaStyle.backgroundColor,
                          color: semGpaStyle.color,
                        }}
                      >
                        {sem.thisSem.gpa}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Course Table */}
                  <div className="table-responsive">
                    <table className="table table-borderless align-middle mb-0 dashboard-caption">
                      <thead>
                        <tr
                          className="border-bottom text-uppercase text-secondary fw-bold"
                          style={{ fontSize: "11px" }}
                        >
                          <th className="pb-2">Course Code</th>
                          <th className="pb-2">Course Name</th>
                          <th className="pb-2 text-center">Credits</th>
                          <th className="pb-2 text-end">Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sem.courses.map((c, cIdx) => (
                          <tr key={cIdx}>
                            <td className="fw-bold text-body py-2">{c.code}</td>
                            <td className="text-secondary py-2">{c.name}</td>
                            <td className="text-center text-secondary py-2">
                              {c.credits} Credits
                            </td>
                            <td className="text-end py-2">
                              <span
                                className="dashboard-caption fw-bold px-2 py-1 rounded shadow-xs"
                                style={{
                                  backgroundColor:
                                    c.grade === "A"
                                      ? "#5cd67c"
                                      : c.grade === "B+" || c.grade === "B"
                                        ? "#d4ed31"
                                        : c.grade === "C+" || c.grade === "C"
                                          ? "#fadb36"
                                          : c.grade === "D+" || c.grade === "D"
                                            ? "#f29927"
                                            : c.grade === "F"
                                              ? "#e83f33"
                                              : c.grade === "IP"
                                                ? "#0084FF"
                                                : "#e0e0e0",
                                  color:
                                    c.grade === "D+" ||
                                    c.grade === "D" ||
                                    c.grade === "F" ||
                                    c.grade === "IP"
                                      ? "#ffffff"
                                      : c.grade === "A"
                                        ? "#0f5122"
                                        : c.grade === "B+" || c.grade === "B"
                                          ? "#3b4d00"
                                          : "#333333",
                                }}
                              >
                                {c.grade}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Dual Summary Blocks (Matching Stamford Registrar Screenshot) */}
                  <div className="bg-light p-3 rounded-3 mt-2">
                    <div className="row text-center g-3">
                      {/* THIS SEMESTER */}
                      <div className="col-md-6 border-end-md">
                        <span
                          className="dashboard-caption fw-bold text-secondary uppercase tracking-wider d-block mb-2"
                          style={{ fontSize: "10px" }}
                        >
                          THIS SEMESTER
                        </span>
                        <div className="d-flex justify-content-around text-center">
                          <div>
                            <span
                              className="text-secondary d-block"
                              style={{ fontSize: "10px" }}
                            >
                              C.Register
                            </span>
                            <strong className="text-body">
                              {sem.thisSem.cRegister}
                            </strong>
                          </div>
                          <div>
                            <span
                              className="text-secondary d-block"
                              style={{ fontSize: "10px" }}
                            >
                              C.Earn
                            </span>
                            <strong className="text-body">
                              {sem.thisSem.cEarn}
                            </strong>
                          </div>
                          <div>
                            <span
                              className="text-secondary d-block"
                              style={{ fontSize: "10px" }}
                            >
                              CA
                            </span>
                            <strong className="text-body">
                              {sem.thisSem.ca}
                            </strong>
                          </div>
                          <div>
                            <span
                              className="text-secondary d-block"
                              style={{ fontSize: "10px" }}
                            >
                              GP
                            </span>
                            <strong className="text-body">
                              {sem.thisSem.gp}
                            </strong>
                          </div>
                          <div>
                            <span
                              className="text-secondary d-block"
                              style={{ fontSize: "10px" }}
                            >
                              GPA
                            </span>
                            <span
                              className="dashboard-caption fw-bold px-2 py-0.5 rounded-pill d-inline-block"
                              style={{
                                backgroundColor: semGpaStyle.backgroundColor,
                                color: semGpaStyle.color,
                              }}
                            >
                              {sem.thisSem.gpa}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CUMULATIVE TO THIS SEMESTER */}
                      <div className="col-md-6">
                        <span
                          className="dashboard-caption fw-bold text-secondary uppercase tracking-wider d-block mb-2"
                          style={{ fontSize: "10px" }}
                        >
                          CUMULATIVE TO THIS SEMESTER
                        </span>
                        <div className="d-flex justify-content-around text-center">
                          <div>
                            <span
                              className="text-secondary d-block"
                              style={{ fontSize: "10px" }}
                            >
                              C.Register
                            </span>
                            <strong className="text-body">
                              {sem.cumSem.cRegister}
                            </strong>
                          </div>
                          <div>
                            <span
                              className="text-secondary d-block"
                              style={{ fontSize: "10px" }}
                            >
                              C.Earn
                            </span>
                            <strong className="text-body">
                              {sem.cumSem.cEarn}
                            </strong>
                          </div>
                          <div>
                            <span
                              className="text-secondary d-block"
                              style={{ fontSize: "10px" }}
                            >
                              CA
                            </span>
                            <strong className="text-body">
                              {sem.cumSem.ca}
                            </strong>
                          </div>
                          <div>
                            <span
                              className="text-secondary d-block"
                              style={{ fontSize: "10px" }}
                            >
                              GP
                            </span>
                            <strong className="text-body">
                              {sem.cumSem.gp}
                            </strong>
                          </div>
                          <div>
                            <span
                              className="text-secondary d-block"
                              style={{ fontSize: "10px" }}
                            >
                              GPA
                            </span>
                            <span
                              className="dashboard-caption fw-bold px-2 py-0.5 rounded-pill d-inline-block"
                              style={{
                                backgroundColor: cumGpaStyle.backgroundColor,
                                color: cumGpaStyle.color,
                              }}
                            >
                              {sem.cumSem.gpa}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Right Column (1/3): User Profile & Advisor Info */}
        <div className="col-lg-4 dashboard-stack">
          <h3 className="fs-6 fw-bold text-dark">Student Information</h3>

          {/* User Profile Card */}
          <div className="card border-primary-subtle dashboard-card p-3 p-md-4 dashboard-stack">
            <div className="d-flex align-items-center gap-3">
              <div
                className="rounded-circle bg-primary-subtle text-primary fw-bold d-flex align-items-center justify-content-center fs-4"
                style={{ width: "52px", height: "52px", flexShrink: 0 }}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : "S"}
              </div>
              <div>
                <h4 className="fs-6 fw-bold text-dark mb-0">{user.name}</h4>
                <span className="dashboard-caption text-secondary">
                  {user.email}
                </span>
              </div>
            </div>

            <hr className="my-2 border-light" />

            <div className="dashboard-stack gap-2 dashboard-caption">
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-secondary">Student ID:</span>
                <strong className="text-dark">
                  {user.studentId || "STU1002"}
                </strong>
              </div>
              <div className="d-flex justify-content-between align-items-center">
                <span className="text-secondary">Major:</span>
                <strong className="text-dark">Computer Science & IT</strong>
              </div>

              <div className="d-flex justify-content-between align-items-center">
                <span className="text-secondary">Total GPA score:</span>
                {/* Colored Pill Badge using topCgpaStyle */}
                <span
                  className="fw-bold px-2 py-0.5 rounded-pill shadow-xs"
                  style={{
                    backgroundColor: topCgpaStyle.backgroundColor,
                    color: topCgpaStyle.color,
                  }}
                >
                  {finalCGPA}
                </span>
              </div>
            </div>
          </div>

          {/* Advisor Info Box */}
          <div className="card border-primary-subtle advisor-card rounded-4 p-3 p-md-4 dashboard-stack">
            <span className="dashboard-eyebrow fw-bold text-primary text-uppercase">
              Assigned Academic Advisor
            </span>
            <p className="small fw-bold text-dark mb-0">
              {user.advisor?.name || "Wendy Luu"}
            </p>
            <p className="dashboard-caption text-secondary">
              Department of Computer Science
            </p>
            <a
              href={`mailto:${user.advisor?.email || "wendylu@stamford.edu"}`}
              className="d-inline-block mt-2 dashboard-caption fw-bold text-primary text-decoration-underline"
            >
              Contact Advisor →
            </a>
          </div>
        </div>
      </div>

      {/* Add / Drop Modal */}
      {selectedCourse && (
        <AddDropModal
          course={selectedCourse}
          advisorEmail={user.advisor?.email || "wendylu@stamford.edu"}
          studentId={user.studentId}
          onClose={() => setSelectedCourse(null)}
        />
      )}
    </div>
  );
}
