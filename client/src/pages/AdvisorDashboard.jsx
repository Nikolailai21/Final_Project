import React, { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function AdvisorDashboard({ user }) {
  const [activeTab, setActiveTab] = useState("offerings"); // "offerings" | "register"

  // Section 1 State: Course Offerings
  const [offerings, setOfferings] = useState([]);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");
  const [offeringLoading, setOfferingLoading] = useState(true);
  const [showOfferingModal, setShowOfferingModal] = useState(false);
  const [editingOffering, setEditingOffering] = useState(null);

  // Form State for Creating/Editing Offering
  const [offeringForm, setOfferingForm] = useState({
    courseId: "",
    term: "2026-1",
    section: 1,
    day: "Monday",
    startTime: "09:00",
    endTime: "12:00",
    room: "Lab 1",
    instructor: "Ajarn Amin",
    seats: 30,
    addDropOpen: true,
  });

  // Section 2 State: Registering a Student
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentRecord, setStudentRecord] = useState(null);
  const [studentRegistrations, setStudentRegistrations] = useState([]);
  const [studentCourseRequests, setStudentCourseRequests] = useState([]);
  const [eligibleCourses, setEligibleCourses] = useState([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");

  // Load initial data
  useEffect(() => {
    loadOfferings();
    loadCourses();
    loadStudents();
  }, []);

  const loadOfferings = () => {
    setOfferingLoading(true);
    apiFetch("/offerings?term=2026-1")
      .then(setOfferings)
      .catch(console.error)
      .finally(() => setOfferingLoading(false));
  };

  const loadCourses = () => {
    setCoursesLoading(true);
    setCoursesError("");
    apiFetch("/courses")
      .then(setCourses)
      .catch((err) => {
        setCoursesError(err.message || "Unable to load courses.");
      })
      .finally(() => setCoursesLoading(false));
  };

  const loadStudents = () => {
    apiFetch("/students").then(setStudents).catch(console.error);
  };

  // --- Handlers for Course Offerings ---
  const handleSaveOffering = async (e) => {
    e.preventDefault();
    try {
      if (editingOffering) {
        await apiFetch(`/offerings/${editingOffering._id}`, {
          method: "PUT",
          body: JSON.stringify(offeringForm),
        });
      } else {
        await apiFetch("/offerings", {
          method: "POST",
          body: JSON.stringify(offeringForm),
        });
      }
      setShowOfferingModal(false);
      setEditingOffering(null);
      loadOfferings();
    } catch (err) {
      alert(err.message || "Failed to save course offering");
    }
  };

  const handleDeleteOffering = async (id) => {
    if (
      !window.confirm("Are you sure you want to delete this course offering?")
    )
      return;
    try {
      await apiFetch(`/offerings/${id}`, { method: "DELETE" });
      loadOfferings();
    } catch (err) {
      alert(err.message || "Failed to delete offering");
    }
  };

  const handleToggleAddDrop = async (offering) => {
    try {
      await apiFetch(`/offerings/${offering._id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...offering,
          addDropOpen: !offering.addDropOpen,
        }),
      });
      loadOfferings();
    } catch (err) {
      alert(err.message || "Failed to toggle Add/Drop status");
    }
  };

  // --- Handlers for Registering a Student ---
  const handleSelectStudent = async (studentId) => {
    setSelectedStudentId(studentId);
    setRegisterError("");
    setRegisterSuccess("");
    if (!studentId) {
      setStudentRecord(null);
      setStudentRegistrations([]);
      setStudentCourseRequests([]);
      setEligibleCourses([]);
      return;
    }

    setRegisterLoading(true);
    try {
      // 1. Fetch student academic history & active registrations
      const [records, regs, courseRequests, eligible] = await Promise.all([
        apiFetch(`/students/${studentId}/record`),
        apiFetch(`/students/${studentId}/registrations`),
        apiFetch(`/course-requests/student/${studentId}`),
        apiFetch(`/students/${studentId}/eligible-courses?term=2026-1`),
      ]);

      setStudentRecord(records);
      setStudentRegistrations(regs);
      setStudentCourseRequests(courseRequests);
      setEligibleCourses(eligible);
    } catch (err) {
      setRegisterError(
        err.message || "Failed to load student registration details.",
      );
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleRegisterStudentToCourse = async (offeringId) => {
    setRegisterError("");
    setRegisterSuccess("");
    try {
      await apiFetch(`/registrations`, {
        method: "POST",
        body: JSON.stringify({
          studentId: selectedStudentId,
          offeringId,
          term: "2026-1",
        }),
      });
      setRegisterSuccess("Course registered successfully!");
      handleSelectStudent(selectedStudentId); // Refresh data
      loadOfferings(); // Refresh live seat counts
    } catch (err) {
      setRegisterError(err.message || "Failed to register student to course.");
    }
  };

  const handleRemoveStudentCourse = async (registrationId) => {
    if (!window.confirm("Remove this course from student's registration?"))
      return;
    setRegisterError("");
    setRegisterSuccess("");
    try {
      await apiFetch(`/registrations/${registrationId}`, {
        method: "DELETE",
      });
      setRegisterSuccess("Course removed from student registration.");
      handleSelectStudent(selectedStudentId);
      loadOfferings();
    } catch (err) {
      setRegisterError(err.message || "Failed to remove course.");
    }
  };

  const handleApproveCourseRequest = async (registrationId) => {
    setRegisterError("");
    setRegisterSuccess("");
    try {
      await apiFetch(`/registrations/${registrationId}/approve`, {
        method: "PATCH",
      });
      setRegisterSuccess("Course request approved and student registered.");
      await handleSelectStudent(selectedStudentId);
      loadOfferings();
    } catch (err) {
      setRegisterError(err.message || "Failed to approve course request.");
    }
  };

  const handleReviewUnfinishedCourseRequest = async (requestId, decision) => {
    setRegisterError("");
    setRegisterSuccess("");
    try {
      await apiFetch(`/course-requests/${requestId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: decision }),
      });
      await handleSelectStudent(selectedStudentId);
      setRegisterSuccess(
        decision === "approved"
          ? "Unfinished course request approved."
          : "Unfinished course request rejected.",
      );
    } catch (err) {
      setRegisterError(err.message || "Failed to review course request.");
    }
  };

  return (
    <div className="container-xxl advisor-dashboard pb-5 p-3 p-md-4 rounded-4 bg-body-tertiary">
      {/* Top Banner */}
      <div className="card border-0 dashboard-card p-4 bg-white mb-4 d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
        <div>
          <span className="dashboard-caption fw-bold text-primary bg-primary-subtle px-3 py-1 rounded-pill text-uppercase">
            Academic Advisor Portal
          </span>
          <h2 className="fs-3 fw-bold text-dark mt-2 mb-0">
            Welcome, Advisor {user.name}! 🎓
          </h2>
          <p className="dashboard-caption text-secondary mt-1 mb-0">
            Department of Computer Science & IT • Managing Term 2026-1
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="btn-group" role="group">
          <button
            onClick={() => setActiveTab("offerings")}
            className={`btn fw-bold px-3 py-2 ${
              activeTab === "offerings" ? "btn-primary" : "btn-outline-primary"
            }`}
          >
            Course Offerings & Add/Drop
          </button>
          <button
            onClick={() => setActiveTab("register")}
            className={`btn fw-bold px-3 py-2 ${
              activeTab === "register" ? "btn-primary" : "btn-outline-primary"
            }`}
          >
            Register Student
          </button>
        </div>
      </div>

      {/* ================= TAB 1: COURSE OFFERINGS & ADD/DROP CONTROL ================= */}
      {activeTab === "offerings" && (
        <div className="card border-0 dashboard-card p-4 dashboard-stack">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h3 className="fs-6 fw-bold text-dark mb-0">
                Course Offerings (Term 2026-1)
              </h3>
              <p className="dashboard-caption text-secondary mb-0">
                Open sections, edit schedules, track live seat counts, and
                control Add/Drop windows
              </p>
            </div>
            <button
              onClick={() => {
                setEditingOffering(null);
                setOfferingForm({
                  courseId: courses[0]?._id || "",
                  term: "2026-1",
                  section: 1,
                  day: "Monday",
                  startTime: "09:00",
                  endTime: "12:00",
                  room: "Lab 1",
                  instructor: "Ajarn Amin",
                  seats: 30,
                  addDropOpen: true,
                });
                setShowOfferingModal(true);
              }}
              className="btn btn-primary fw-bold btn-sm"
            >
              + Open New Section
            </button>
          </div>

          {offeringLoading ? (
            <p className="text-secondary text-center py-4">
              Loading offerings...
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 dashboard-caption text-start">
                <thead>
                  <tr
                    className="border-bottom text-uppercase text-secondary fw-bold"
                    style={{ fontSize: "11px" }}
                  >
                    <th className="pb-3">Course</th>
                    <th className="pb-3">Sec</th>
                    <th className="pb-3">Schedule</th>
                    <th className="pb-3">Room</th>
                    <th className="pb-3">Instructor</th>
                    <th className="pb-3 text-center">
                      Live Seats (Taken / Total)
                    </th>
                    <th className="pb-3 text-center">Add/Drop Window</th>
                    <th className="pb-3 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offerings.map((off) => {
                    const seatsTaken = off.seatsTaken || 0;
                    const seatsTotal = off.seats || 30;
                    const remaining = seatsTotal - seatsTaken;

                    return (
                      <tr key={off._id}>
                        <td className="py-3 fw-bold text-body">
                          {off.courseId?.code}{" "}
                          <span className="fw-normal text-secondary">
                            — {off.courseId?.title}
                          </span>
                        </td>
                        <td className="py-3 fw-semibold">Sec {off.section}</td>
                        <td className="py-3 text-secondary">
                          {off.day} {off.startTime}-{off.endTime}
                        </td>
                        <td className="py-3 text-secondary">{off.room}</td>
                        <td className="py-3 text-secondary">
                          {off.instructor}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`fw-bold px-2.5 py-1 rounded-pill ${
                              remaining <= 0
                                ? "bg-danger-subtle text-danger-emphasis"
                                : remaining <= 5
                                  ? "bg-warning-subtle text-warning-emphasis"
                                  : "bg-success-subtle text-success-emphasis"
                            }`}
                          >
                            {seatsTaken} / {seatsTotal} ({remaining} Left)
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => handleToggleAddDrop(off)}
                            className={`btn btn-sm fw-bold rounded-pill px-3 ${
                              off.addDropOpen
                                ? "btn-success"
                                : "btn-outline-secondary"
                            }`}
                          >
                            {off.addDropOpen ? "● Window Open" : "Closed"}
                          </button>
                        </td>
                        <td className="py-3 text-end">
                          <button
                            onClick={() => {
                              setEditingOffering(off);
                              setOfferingForm({
                                courseId: off.courseId?._id || "",
                                term: off.term,
                                section: off.section,
                                day: off.day,
                                startTime: off.startTime,
                                endTime: off.endTime,
                                room: off.room,
                                instructor: off.instructor,
                                seats: off.seats,
                                addDropOpen: off.addDropOpen,
                              });
                              setShowOfferingModal(true);
                            }}
                            className="btn btn-light btn-sm fw-bold me-2"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteOffering(off._id)}
                            className="btn btn-outline-danger btn-sm fw-bold"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 2: REGISTERING A STUDENT ================= */}
      {activeTab === "register" && (
        <div className="row g-4">
          {/* Left Side: Select Student & View Record */}
          <div className="col-lg-5 dashboard-stack">
            <div className="card border-0 dashboard-card p-4">
              <h3 className="fs-6 fw-bold text-dark mb-2">Select Student</h3>
              <p className="dashboard-caption text-secondary mb-3">
                Choose a student to view academic records and register term
                courses
              </p>

              <select
                className="form-select mb-3 fw-semibold"
                value={selectedStudentId}
                onChange={(e) => handleSelectStudent(e.target.value)}
              >
                <option value="">-- Choose Student --</option>
                {students.map((st) => (
                  <option key={st._id} value={st._id}>
                    {st.name} ({st.studentId || "STU"}) — {st.email}
                  </option>
                ))}
              </select>

              {registerError && (
                <div
                  className="alert alert-danger mb-3 p-2 dashboard-caption"
                  role="alert"
                >
                  {registerError}
                </div>
              )}

              {registerSuccess && (
                <div
                  className="alert alert-success mb-3 p-2 dashboard-caption"
                  role="alert"
                >
                  {registerSuccess}
                </div>
              )}
            </div>

            {/* Student Academic Record Summary */}
            {selectedStudentId && studentRecord && (
              <div className="card border-0 dashboard-card p-4 dashboard-stack">
                <h4 className="fs-6 fw-bold text-dark mb-0">Academic Record</h4>
                <p className="dashboard-caption text-secondary mb-2">
                  Completed, passed, and failed courses
                </p>

                <div className="table-responsive">
                  <table className="table table-borderless align-middle mb-0 dashboard-caption">
                    <thead>
                      <tr
                        className="border-bottom text-uppercase text-secondary fw-bold"
                        style={{ fontSize: "10px" }}
                      >
                        <th className="pb-2">Course</th>
                        <th className="pb-2">Term</th>
                        <th className="pb-2 text-end">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentRecord.length === 0 ? (
                        <tr>
                          <td
                            colSpan="3"
                            className="text-secondary text-center py-3"
                          >
                            No prior records found.
                          </td>
                        </tr>
                      ) : (
                        studentRecord.map((rec, idx) => (
                          <tr key={idx}>
                            <td className="fw-bold py-1">
                              {rec.courseId?.code}{" "}
                              <span className="fw-normal text-secondary">
                                {rec.courseId?.title}
                              </span>
                            </td>
                            <td className="text-secondary py-1">{rec.term}</td>
                            <td className="text-end py-1">
                              <span
                                className={`fw-bold px-2 py-0.5 rounded ${
                                  rec.grade === "A"
                                    ? "bg-success-subtle text-success-emphasis"
                                    : rec.grade === "F"
                                      ? "bg-danger-subtle text-danger-emphasis"
                                      : "bg-light text-secondary"
                                }`}
                              >
                                {rec.grade}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Side: Active Registrations & Rule-Engine Eligible Courses */}
          <div className="col-lg-7 dashboard-stack">
            {/* Active Term Registrations */}
            {selectedStudentId && (
              <div className="card border-0 dashboard-card p-4 dashboard-stack mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h3 className="fs-6 fw-bold text-dark mb-0">
                    Registered Courses (Term 2026-1)
                  </h3>
                  <span className="dashboard-caption fw-bold text-primary bg-primary-subtle px-2.5 py-1 rounded-pill">
                    {studentRegistrations.length} Enrolled
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 dashboard-caption text-start">
                    <thead>
                      <tr
                        className="border-bottom text-uppercase text-secondary fw-bold"
                        style={{ fontSize: "10px" }}
                      >
                        <th className="pb-2">Course</th>
                        <th className="pb-2">Schedule</th>
                        <th className="pb-2">Room</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentRegistrations.length === 0 ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="text-secondary text-center py-3"
                          >
                            No active course registrations for Term 2026-1.
                          </td>
                        </tr>
                      ) : (
                        studentRegistrations.map((reg) => (
                          <tr key={reg._id}>
                            <td className="fw-bold py-2">
                              {reg.offeringId?.courseId?.code}{" "}
                              <span className="fw-normal text-secondary">
                                — {reg.offeringId?.courseId?.title}
                              </span>
                            </td>
                            <td className="text-secondary py-2">
                              {reg.offeringId?.day} {reg.offeringId?.startTime}-
                              {reg.offeringId?.endTime}
                            </td>
                            <td className="text-secondary py-2">
                              {reg.offeringId?.room}
                            </td>
                            <td className="py-2 text-capitalize">
                              {reg.status === "pending" ? (
                                <span className="badge bg-warning-subtle text-warning-emphasis">
                                  Pending approval
                                </span>
                              ) : (
                                <span className="badge bg-success-subtle text-success-emphasis">
                                  Registered
                                </span>
                              )}
                            </td>
                            <td className="text-end py-2">
                              {reg.status === "pending" ? (
                                <button
                                  onClick={() =>
                                    handleApproveCourseRequest(reg._id)
                                  }
                                  className="btn btn-success btn-sm fw-bold py-0.5 px-2"
                                  style={{ fontSize: "11px" }}
                                >
                                  Approve
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleRemoveStudentCourse(reg._id)
                                  }
                                  className="btn btn-outline-danger btn-sm fw-bold py-0.5 px-2"
                                  style={{ fontSize: "11px" }}
                                >
                                  Remove
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
            )}

            {selectedStudentId && (
              <div className="card border-0 dashboard-card p-4 dashboard-stack mb-4">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h3 className="fs-6 fw-bold text-dark mb-0">
                    Unfinished Course Requests
                  </h3>
                  <span className="dashboard-caption text-secondary">
                    Advisor review
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 dashboard-caption text-start">
                    <thead>
                      <tr
                        className="border-bottom text-uppercase text-secondary fw-bold"
                        style={{ fontSize: "10px" }}
                      >
                        <th className="pb-2">Course</th>
                        <th className="pb-2">Term</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-end">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentCourseRequests.length === 0 ? (
                        <tr>
                          <td
                            colSpan="4"
                            className="text-secondary text-center py-3"
                          >
                            No unfinished course requests from this student.
                          </td>
                        </tr>
                      ) : (
                        studentCourseRequests.map((request) => (
                          <tr key={request._id}>
                            <td className="fw-bold py-2">
                              {request.courseId?.code}{" "}
                              <span className="fw-normal text-secondary">
                                — {request.courseId?.title}
                              </span>
                            </td>
                            <td className="text-secondary py-2">
                              {request.term}
                            </td>
                            <td className="py-2">
                              <span
                                className={`badge ${
                                  request.status === "pending"
                                    ? "bg-warning-subtle text-warning-emphasis"
                                    : request.status === "approved"
                                      ? "bg-success-subtle text-success-emphasis"
                                      : "bg-danger-subtle text-danger-emphasis"
                                }`}
                              >
                                {request.status}
                              </span>
                            </td>
                            <td className="text-end py-2">
                              {request.status === "pending" && (
                                <div className="d-inline-flex gap-2">
                                  <button
                                    onClick={() =>
                                      handleReviewUnfinishedCourseRequest(
                                        request._id,
                                        "approved",
                                      )
                                    }
                                    className="btn btn-success btn-sm fw-bold"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleReviewUnfinishedCourseRequest(
                                        request._id,
                                        "rejected",
                                      )
                                    }
                                    className="btn btn-outline-danger btn-sm fw-bold"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Eligible Course Offerings (Section 6 Auto Rule Check) */}
            {selectedStudentId && (
              <div className="card border-0 dashboard-card p-4 dashboard-stack">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h3 className="fs-6 fw-bold text-dark mb-0">
                    Eligible Course Offerings
                  </h3>
                  <span className="dashboard-caption text-secondary">
                    Automatic Section 6 Rules Filter Applied
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 dashboard-caption text-start">
                    <thead>
                      <tr
                        className="border-bottom text-uppercase text-secondary fw-bold"
                        style={{ fontSize: "10px" }}
                      >
                        <th className="pb-2">Course</th>
                        <th className="pb-2">Schedule</th>
                        <th className="pb-2">Seats</th>
                        <th className="pb-2 text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleCourses.length === 0 ? (
                        <tr>
                          <td
                            colSpan="4"
                            className="text-secondary text-center py-3"
                          >
                            No eligible course offerings available for this
                            student.
                          </td>
                        </tr>
                      ) : (
                        eligibleCourses.map(({ offering, eligible, reason }) => {
                          const remaining =
                            (offering.seats || 30) -
                            (offering.seatsTaken || 0);
                          return (
                            <tr key={offering._id}>
                              <td className="fw-bold py-2">
                                {offering.courseId?.code}{" "}
                                <span className="fw-normal text-secondary">
                                  — {offering.courseId?.title}
                                </span>
                                {!eligible && (
                                  <span className="d-block fw-normal text-secondary">
                                    {reason}
                                  </span>
                                )}
                              </td>
                              <td className="text-secondary py-2">
                                {offering.day} {offering.startTime}-
                                {offering.endTime}
                              </td>
                              <td className="py-2">
                                <span className="badge bg-light text-dark border">
                                  {remaining} Left
                                </span>
                              </td>
                              <td className="text-end py-2">
                                <button
                                  onClick={() =>
                                    handleRegisterStudentToCourse(offering._id)
                                  }
                                  className="btn btn-primary btn-sm fw-bold py-0.5 px-2"
                                  style={{ fontSize: "11px" }}
                                  disabled={!eligible || remaining <= 0}
                                >
                                  {remaining <= 0
                                    ? "Full"
                                    : eligible
                                      ? "+ Confirm Register"
                                      : "Unavailable"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Offering */}
      {showOfferingModal && (
        <div className="modal show d-block bg-dark bg-opacity-50" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  {editingOffering
                    ? "Edit Course Offering"
                    : "Open Course Offering (Term 2026-1)"}
                </h5>
                <button
                  onClick={() => setShowOfferingModal(false)}
                  className="btn-close"
                ></button>
              </div>
              <form onSubmit={handleSaveOffering}>
                <div className="modal-body dashboard-caption dashboard-stack">
                  <div>
                    <label className="fw-bold mb-1">Select Course</label>
                    <select
                      className="form-select"
                      value={offeringForm.courseId}
                      onChange={(e) =>
                        setOfferingForm({
                          ...offeringForm,
                          courseId: e.target.value,
                        })
                      }
                      required
                    >
                      <option value="">
                        {coursesLoading
                          ? "Loading courses..."
                          : coursesError
                            ? "Unable to load courses"
                            : courses.length === 0
                              ? "No courses available"
                              : "-- Select Course --"}
                      </option>
                      {courses.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.code} — {c.title} ({c.credits} Credits)
                        </option>
                      ))}
                    </select>
                    {coursesError && (
                      <div className="text-danger mt-1" role="alert">
                        {coursesError}
                      </div>
                    )}
                  </div>

                  <div className="row g-2">
                    <div className="col-6">
                      <label className="fw-bold mb-1">Section No.</label>
                      <input
                        type="number"
                        className="form-control"
                        value={offeringForm.section}
                        onChange={(e) =>
                          setOfferingForm({
                            ...offeringForm,
                            section: parseInt(e.target.value) || 1,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="fw-bold mb-1">Total Seats</label>
                      <input
                        type="number"
                        className="form-control"
                        value={offeringForm.seats}
                        onChange={(e) =>
                          setOfferingForm({
                            ...offeringForm,
                            seats: parseInt(e.target.value) || 30,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-4">
                      <label className="fw-bold mb-1">Day</label>
                      <select
                        className="form-select"
                        value={offeringForm.day}
                        onChange={(e) =>
                          setOfferingForm({
                            ...offeringForm,
                            day: e.target.value,
                          })
                        }
                      >
                        <option value="Monday">Monday</option>
                        <option value="Tuesday">Tuesday</option>
                        <option value="Wednesday">Wednesday</option>
                        <option value="Thursday">Thursday</option>
                        <option value="Friday">Friday</option>
                      </select>
                    </div>
                    <div className="col-4">
                      <label className="fw-bold mb-1">Start Time</label>
                      <input
                        type="text"
                        className="form-control"
                        value={offeringForm.startTime}
                        onChange={(e) =>
                          setOfferingForm({
                            ...offeringForm,
                            startTime: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="col-4">
                      <label className="fw-bold mb-1">End Time</label>
                      <input
                        type="text"
                        className="form-control"
                        value={offeringForm.endTime}
                        onChange={(e) =>
                          setOfferingForm({
                            ...offeringForm,
                            endTime: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-6">
                      <label className="fw-bold mb-1">Room</label>
                      <input
                        type="text"
                        className="form-control"
                        value={offeringForm.room}
                        onChange={(e) =>
                          setOfferingForm({
                            ...offeringForm,
                            room: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="fw-bold mb-1">Instructor</label>
                      <input
                        type="text"
                        className="form-control"
                        value={offeringForm.instructor}
                        onChange={(e) =>
                          setOfferingForm({
                            ...offeringForm,
                            instructor: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="form-check mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="addDropCheck"
                      checked={offeringForm.addDropOpen}
                      onChange={(e) =>
                        setOfferingForm({
                          ...offeringForm,
                          addDropOpen: e.target.checked,
                        })
                      }
                    />
                    <label
                      className="form-check-label fw-bold"
                      htmlFor="addDropCheck"
                    >
                      Open Add/Drop Window for this offering
                    </label>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button
                    type="button"
                    onClick={() => setShowOfferingModal(false)}
                    className="btn btn-light fw-bold"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold">
                    Save Offering
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
