import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api";

const getTwoHourEndTime = (startTime) => {
  if (!/^\d{2}:\d{2}$/.test(startTime)) return "";
  const [hours, minutes] = startTime.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + 120;
  if (endMinutes > 18 * 60) return "";
  return `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
};

const START_TIMES = Array.from({ length: 17 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
});
// Grade badge color helper matching student transcript
const getGradeBadgeStyle = (grade) => {
  const g = String(grade || "").toUpperCase();
  switch (g) {
    case "A":
      return { backgroundColor: "#82E0AA", color: "#145A32" };
    case "B+":
    case "B":
      return { backgroundColor: "#A9DFBF", color: "#1E8449" };
    case "C+":
    case "C":
      return { backgroundColor: "#F9E79F", color: "#7D6608" };
    case "D+":
    case "D":
      return { backgroundColor: "#f29927", color: "#ffffff" };
    case "F":
      return { backgroundColor: "#F5B7B1", color: "#78281F" };
    case "IP":
      return { backgroundColor: "#0084FF", color: "#ffffff" };
    default:
      return { backgroundColor: "#e0e0e0", color: "#333333" };
  }
};

export default function AdvisorDashboard({ user }) {
  const [activeTab, setActiveTab] = useState("offerings"); // "offerings" | "register"

  // Section 1 State: Course Offerings
  const [offerings, setOfferings] = useState([]);
  const [courses, setCourses] = useState([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [coursesError, setCoursesError] = useState("");
  const [offeringLoading, setOfferingLoading] = useState(true);
  const [showOfferingModal, setShowOfferingModal] = useState(false);
  const [editingOffering, setEditingOffering] = useState(null);
  const [offeringForm, setOfferingForm] = useState(null);
  const [offeringOptions, setOfferingOptions] = useState({
    sections: [],
    rooms: [],
    instructors: [],
  });
  const [offeringOptionsError, setOfferingOptionsError] = useState("");
  const [offeringSaveError, setOfferingSaveError] = useState("");

  // Section 2 State: Registering a Student
  const [students, setStudents] = useState([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentRecord, setStudentRecord] = useState(null);
  const [studentRegistrations, setStudentRegistrations] = useState([]);
  const [studentCourseRequests, setStudentCourseRequests] = useState([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const occupiedSections = new Set(
    offerings
      .filter(
        (offering) =>
          offering.term === offeringForm?.term &&
          offering.courseId?._id === offeringForm?.courseId &&
          offering._id !== editingOffering?._id,
      )
      .map((offering) => Number(offering.section)),
  );
  const sectionOptions = offeringOptions.sections.filter(
    (section) => !occupiedSections.has(Number(section)),
  );

  const loadOfferings = useCallback(() => {
    setOfferingLoading(true);
    apiFetch("/offerings?term=2026-2")
      .then(setOfferings)
      .catch(console.error)
      .finally(() => setOfferingLoading(false));
  }, []);

  // Load the active term's offerings on startup.
  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const loadCourses = async () => {
    if (coursesLoaded || coursesLoading) return;

    setCoursesLoading(true);
    setCoursesError("");
    try {
      setCourses(await apiFetch("/courses"));
      setCoursesLoaded(true);
    } catch (err) {
      setCoursesError(err.message || "Unable to load courses.");
    } finally {
      setCoursesLoading(false);
    }
  };

  const loadOfferingOptions = async () => {
    setOfferingOptionsError("");
    try {
      const options = await apiFetch("/offerings/options");
      setOfferingOptions(options);
      return options;
    } catch (err) {
      setOfferingOptionsError(
        err.message || "Unable to load section, room, and instructor options.",
      );
      return null;
    }
  };

  const loadStudents = async () => {
    if (studentsLoaded || studentsLoading) return;

    setStudentsLoading(true);
    try {
      setStudents(await apiFetch("/students"));
      setStudentsLoaded(true);
    } catch (err) {
      setRegisterError(err.message || "Unable to load students.");
    } finally {
      setStudentsLoading(false);
    }
  };

  // --- Handlers for Course Offerings ---
  const handleSaveOffering = async (e) => {
    e.preventDefault();
    setOfferingSaveError("");
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
      if (selectedStudentId) {
        await handleSelectStudent(selectedStudentId);
      }
    } catch (err) {
      setOfferingSaveError(err.message || "Failed to save course offering");
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
      return;
    }

    setRegisterLoading(true);
    try {
      // 1. Fetch student academic history & active registrations
      const [records, regs, courseRequests] = await Promise.all([
        apiFetch(`/students/${studentId}/record`),
        apiFetch(`/students/${studentId}/registrations?term=2026-2`),
        apiFetch(`/course-requests/student/${studentId}`),
      ]);

      setStudentRecord(records);
      setStudentRegistrations(regs);
      setStudentCourseRequests(courseRequests);
    } catch (err) {
      setRegisterError(
        err.message || "Failed to load student registration details.",
      );
    } finally {
      setRegisterLoading(false);
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

  const handleRemoveApproved = async (requestId) => {
    if (
      !window.confirm(
        "Are you sure you want to revoke this approval? This will remove the course from the student's schedule.",
      )
    )
      return;
    setRegisterError("");
    setRegisterSuccess("");
    try {
      await apiFetch(`/course-requests/${requestId}`, { method: "DELETE" });
      await handleSelectStudent(selectedStudentId);
      setRegisterSuccess("Approved course revoked and removed from schedule.");
    } catch (err) {
      setRegisterError(err.message || "Failed to remove approved request.");
    }
  };

  return (
    <div className="container-fluid max-w-7xl px-3 px-md-4 py-4 min-vh-100">
      {/* Top Banner Header */}
      <div className="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
          <div>
            <div
              className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill text-white fw-semibold fs-7 mb-2"
              style={{ backgroundColor: "#0094DA" }}
            >
              Academic Advisor Portal
            </div>
            <h1 className="fs-3 fw-bold text-dark mb-1">
              Welcome, Advisor {user.name}! 🎓
            </h1>
            <p className="text-muted mb-0 small">
              Department of Computer Science & IT • Managing Term 2026-2
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="btn-group bg-light p-1 rounded-3 border" role="group">
            <button
              onClick={() => setActiveTab("offerings")}
              className={`btn btn-sm fw-semibold px-3 py-2 rounded-2 transition-all ${
                activeTab === "offerings"
                  ? "text-white shadow-sm"
                  : "btn-light text-secondary border-0"
              }`}
              style={
                activeTab === "offerings"
                  ? { backgroundColor: "#0094DA", borderColor: "#0094DA" }
                  : {}
              }
            >
              Course Offerings & Add/Drop
            </button>
            <button
              onClick={() => {
                setActiveTab("register");
                loadStudents();
                if (selectedStudentId) {
                  handleSelectStudent(selectedStudentId);
                }
              }}
              className={`btn btn-sm fw-semibold px-3 py-2 rounded-2 transition-all ${
                activeTab === "register"
                  ? "text-white shadow-sm"
                  : "btn-light text-secondary border-0"
              }`}
              style={
                activeTab === "register"
                  ? { backgroundColor: "#0094DA", borderColor: "#0094DA" }
                  : {}
              }
            >
              Register Student
            </button>
          </div>
        </div>
      </div>

      {/* ================= TAB 1: COURSE OFFERINGS & ADD/DROP CONTROL ================= */}
      {activeTab === "offerings" && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 border-bottom pb-3 mb-3">
            <div>
              <h2 className="fs-5 fw-bold text-dark mb-1">
                Course Offerings (Term 2026-2)
              </h2>
              <p className="text-muted small mb-0">
                Open sections, edit schedules, track live seat counts, and
                control Add/Drop windows
              </p>
            </div>
            <button
              onClick={async () => {
                const [optionData] = await Promise.all([
                  loadOfferingOptions(),
                  loadCourses(),
                ]);
                if (!optionData) return;
                setOfferingSaveError("");
                setEditingOffering(null);
                setOfferingForm({
                  courseId: "",
                  term: "2026-2",
                  section: "",
                  day: "Monday",
                  startTime: "08:00",
                  endTime: "10:00",
                  room: optionData.rooms[0] || "",
                  instructor: optionData.instructors[0] || "",
                  seats: 30,
                  addDropOpen: true,
                });
                setShowOfferingModal(true);
              }}
              className="btn text-white fw-semibold px-3 py-2 shadow-sm d-flex align-items-center gap-2"
              style={{ backgroundColor: "#0094DA", borderColor: "#0094DA" }}
            >
              <svg
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
              </svg>
              Open New Section
            </button>
          </div>

          {offeringLoading ? (
            <div className="text-center py-5 text-muted">
              Loading offerings...
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="bg-light">
                  <tr
                    className="border-bottom text-uppercase text-secondary fw-bold"
                    style={{ fontSize: "11px", letterSpacing: "0.5px" }}
                  >
                    <th className="py-3 px-3">Course</th>
                    <th className="py-3">Sec</th>
                    <th className="py-3">Schedule</th>
                    <th className="py-3">Room</th>
                    <th className="py-3">Instructor</th>
                    <th className="py-3 text-center">
                      Live Seats (Taken / Total)
                    </th>
                    <th className="py-3 text-center">Add/Drop Window</th>
                    <th className="py-3 text-end px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {offerings.map((off) => {
                    const seatsTaken = off.seatsTaken || 0;
                    const seatsTotal = off.seats || 30;
                    const remaining = seatsTotal - seatsTaken;

                    return (
                      <tr key={off._id} className="border-bottom-subtle">
                        <td className="py-3 px-3 fw-bold text-dark">
                          {off.courseId?.code}{" "}
                          <span className="fw-normal text-muted">
                            — {off.courseId?.title}
                          </span>
                        </td>
                        <td className="py-3 fw-semibold">Sec {off.section}</td>
                        <td className="py-3 text-secondary small">
                          {off.day} {off.startTime}-{off.endTime}
                        </td>
                        <td className="py-3 text-secondary small">
                          {off.room}
                        </td>
                        <td className="py-3 text-secondary small">
                          {off.instructor}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`badge px-2.5 py-1 rounded-pill ${
                              remaining <= 0
                                ? "bg-danger-subtle text-danger border border-danger-subtle"
                                : remaining <= 5
                                  ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle"
                                  : "bg-success-subtle text-success border border-success-subtle"
                            }`}
                          >
                            {seatsTaken} / {seatsTotal} ({remaining} Left)
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => handleToggleAddDrop(off)}
                            className={`btn btn-sm fw-semibold rounded-pill px-3 ${
                              off.addDropOpen
                                ? "btn-success"
                                : "btn-outline-secondary"
                            }`}
                          >
                            {off.addDropOpen ? "● Window Open" : "Closed"}
                          </button>
                        </td>
                        <td className="py-3 text-end px-3">
                          <div className="d-inline-flex gap-2">
                            <button
                              onClick={async () => {
                                const [optionData] = await Promise.all([
                                  loadOfferingOptions(),
                                  loadCourses(),
                                ]);
                                if (!optionData) return;
                                setOfferingSaveError("");
                                setEditingOffering(off);
                                setOfferingForm({
                                  courseId: off.courseId?._id || "",
                                  term: off.term,
                                  section: off.section,
                                  day: off.day,
                                  startTime: off.startTime,
                                  endTime: getTwoHourEndTime(off.startTime),
                                  room: off.room,
                                  instructor: off.instructor,
                                  seats: off.seats,
                                  addDropOpen: off.addDropOpen,
                                });
                                setShowOfferingModal(true);
                              }}
                              className="btn btn-outline-secondary btn-sm fw-medium"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteOffering(off._id)}
                              className="btn btn-outline-danger btn-sm fw-medium"
                            >
                              Remove
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
      )}

      {/* ================= TAB 2: REGISTERING A STUDENT ================= */}
      {activeTab === "register" && (
        <div className="row g-4">
          {/* Left Side: Select Student & View Record */}
          <div className="col-lg-5 d-flex flex-column gap-4">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <h2 className="fs-5 fw-bold text-dark mb-1">Select Student</h2>
              <p className="text-muted small mb-3">
                Choose a student to view academic records and register term
                courses
              </p>

              <select
                className="form-select shadow-none fw-semibold mb-3"
                value={selectedStudentId}
                disabled={studentsLoading}
                onChange={(e) => handleSelectStudent(e.target.value)}
              >
                <option value="">
                  {studentsLoading
                    ? "Loading students..."
                    : "-- Choose Student --"}
                </option>
                {students.map((st) => (
                  <option key={st._id} value={st._id}>
                    {st.name} ({st.studentId || "STU"}) — {st.email}
                  </option>
                ))}
              </select>

              {registerError && (
                <div
                  className="alert alert-danger border-0 shadow-sm rounded-3 p-2.5 small mb-3"
                  role="alert"
                >
                  {registerError}
                </div>
              )}

              {registerSuccess && (
                <div
                  className="alert alert-success border-0 shadow-sm rounded-3 p-2.5 small mb-3"
                  role="alert"
                >
                  {registerSuccess}
                </div>
              )}
            </div>

            {/* Student Academic Record Summary with Student GPA Colors */}
            {selectedStudentId && studentRecord && (
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                <h3 className="fs-6 fw-bold text-dark mb-1">Academic Record</h3>
                <p className="text-muted small mb-3">
                  Completed, passed, and failed courses
                </p>

                <div className="table-responsive">
                  <table className="table table-borderless align-middle mb-0">
                    <thead className="bg-light">
                      <tr
                        className="border-bottom text-uppercase text-secondary fw-bold"
                        style={{ fontSize: "10px", letterSpacing: "0.5px" }}
                      >
                        <th className="py-2 px-2">Course</th>
                        <th className="py-2">Term</th>
                        <th className="py-2 text-end px-2">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentRecord.length === 0 ? (
                        <tr>
                          <td
                            colSpan="3"
                            className="text-muted text-center py-4 small"
                          >
                            No prior records found.
                          </td>
                        </tr>
                      ) : (
                        studentRecord.map((rec, idx) => {
                          const badgeStyle = getGradeBadgeStyle(rec.grade);
                          return (
                            <tr key={idx} className="border-bottom-subtle">
                              <td className="fw-bold py-2 px-2 text-dark small">
                                {rec.courseId?.code}{" "}
                                <span className="fw-normal text-muted">
                                  {rec.courseId?.title}
                                </span>
                              </td>
                              <td className="text-secondary py-2 small">
                                {rec.term}
                              </td>
                              <td className="text-end py-2 px-2">
                                <span
                                  className="fw-bold px-3 py-1 rounded-pill small shadow-xs"
                                  style={{
                                    backgroundColor: badgeStyle.backgroundColor,
                                    color: badgeStyle.color,
                                  }}
                                >
                                  {rec.grade}
                                </span>
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

          {/* Right Side: Active Registrations & Rule-Engine Eligible Courses */}
          <div className="col-lg-7 d-flex flex-column gap-4">
            {/* Active Term Registrations */}
            {selectedStudentId && (
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
                  <div>
                    <h3 className="fs-6 fw-bold text-dark mb-0">
                      Registered Courses (Term 2026-2)
                    </h3>
                    <p className="text-muted small mb-0">
                      Current student registrations for this semester
                    </p>
                  </div>
                  <span
                    className="fw-bold text-white px-3 py-1 rounded-pill small"
                    style={{ backgroundColor: "#0094DA" }}
                  >
                    {studentRegistrations.length} Enrolled
                  </span>
                </div>

                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="bg-light">
                      <tr
                        className="border-bottom text-uppercase text-secondary fw-bold"
                        style={{ fontSize: "10px", letterSpacing: "0.5px" }}
                      >
                        <th className="py-2.5 px-3">Course</th>
                        <th className="py-2.5">Schedule</th>
                        <th className="py-2.5">Room</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5 text-end px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentRegistrations.length === 0 ? (
                        <tr>
                          <td
                            colSpan="5"
                            className="text-muted text-center py-4 small"
                          >
                            No active course registrations for Term 2026-2.
                          </td>
                        </tr>
                      ) : (
                        studentRegistrations.map((reg) => (
                          <tr key={reg._id} className="border-bottom-subtle">
                            <td className="fw-bold py-2.5 px-3 text-dark small">
                              {reg.offeringId?.courseId?.code}{" "}
                              <span className="fw-normal text-muted">
                                — {reg.offeringId?.courseId?.title}
                              </span>
                            </td>
                            <td className="text-secondary py-2.5 small">
                              {reg.offeringId?.day} {reg.offeringId?.startTime}-
                              {reg.offeringId?.endTime}
                            </td>
                            <td className="text-secondary py-2.5 small">
                              {reg.offeringId?.room}
                            </td>
                            <td className="py-2.5 text-capitalize">
                              {reg.status === "pending" ? (
                                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                                  Pending approval
                                </span>
                              ) : (
                                <span className="badge bg-success-subtle text-success border border-success-subtle">
                                  Registered
                                </span>
                              )}
                            </td>
                            <td className="text-end py-2.5 px-3">
                              {reg.status === "pending" ? (
                                <button
                                  onClick={() =>
                                    handleApproveCourseRequest(reg._id)
                                  }
                                  className="btn btn-success btn-sm fw-medium px-2 py-1"
                                  style={{ fontSize: "11px" }}
                                >
                                  Approve
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    handleRemoveStudentCourse(reg._id)
                                  }
                                  className="btn btn-outline-danger btn-sm fw-medium px-2 py-1"
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
              <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
                <div className="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
                  <div>
                    <h3 className="fs-6 fw-bold text-dark mb-0">
                      Course Requests (Term 2026-2)
                    </h3>
                    <p className="text-muted small mb-0">
                      Student submitted requests pending advisor review
                    </p>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="bg-light">
                      <tr
                        className="border-bottom text-uppercase text-secondary fw-bold"
                        style={{ fontSize: "10px", letterSpacing: "0.5px" }}
                      >
                        <th className="py-2.5 px-3">Course</th>
                        <th className="py-2.5">Term</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5 text-end px-3">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentCourseRequests.length === 0 ? (
                        <tr>
                          <td
                            colSpan="4"
                            className="text-muted text-center py-4 small"
                          >
                            No unfinished course requests from this student.
                          </td>
                        </tr>
                      ) : (
                        studentCourseRequests.map((request) => {
                          const scheduleOffering = request.scheduleOffering;
                          const canApprove =
                            Boolean(scheduleOffering) &&
                            !request.scheduleConflict;
                          return (
                            <tr
                              key={request._id}
                              className="border-bottom-subtle"
                            >
                              <td className="fw-bold py-2.5 px-3 text-dark small">
                                {request.courseId?.code}{" "}
                                <span className="fw-normal text-muted">
                                  — {request.courseId?.title}
                                </span>
                                {request.status === "pending" && (
                                  <span
                                    className={`d-block fw-normal ${
                                      canApprove ? "text-muted" : "text-danger"
                                    }`}
                                    style={{ fontSize: "11px" }}
                                  >
                                    {request.scheduleConflict ||
                                      (scheduleOffering
                                        ? `Schedule: ${scheduleOffering.day} ${scheduleOffering.startTime}-${scheduleOffering.endTime}`
                                        : "No scheduled offering exists for this course and term.")}
                                    {request.scheduleConflict &&
                                      " Please choose another course."}
                                  </span>
                                )}
                              </td>
                              <td className="text-secondary py-2.5 small">
                                {request.term}
                              </td>
                              <td className="py-2.5">
                                <span
                                  className={`badge ${
                                    request.status === "pending"
                                      ? "bg-warning-subtle text-warning-emphasis border border-warning-subtle"
                                      : request.status === "approved"
                                        ? "bg-success-subtle text-success border border-success-subtle"
                                        : "bg-danger-subtle text-danger border border-danger-subtle"
                                  }`}
                                >
                                  {request.status}
                                </span>
                              </td>
                              <td className="text-end py-2.5 px-3">
                                {request.status === "pending" && (
                                  <div className="d-inline-flex gap-2">
                                    <button
                                      onClick={() =>
                                        handleReviewUnfinishedCourseRequest(
                                          request._id,
                                          "approved",
                                        )
                                      }
                                      className="btn btn-success btn-sm fw-medium px-2 py-1"
                                      disabled={registerLoading || !canApprove}
                                      style={{ fontSize: "11px" }}
                                      title={
                                        canApprove
                                          ? `Approve for ${scheduleOffering.day} ${scheduleOffering.startTime}-${scheduleOffering.endTime}`
                                          : "Cannot approve: the existing course schedule conflicts with the student's timetable"
                                      }
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
                                      className="btn btn-outline-danger btn-sm fw-medium px-2 py-1"
                                      style={{ fontSize: "11px" }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                                {request.status === "approved" && (
                                  <button
                                    onClick={() =>
                                      handleRemoveApproved(request._id)
                                    }
                                    className="btn btn-danger btn-sm fw-medium px-2 py-1"
                                    style={{ fontSize: "11px" }}
                                  >
                                    Revoke
                                  </button>
                                )}
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
        <div
          className="modal show d-block backdrop-blur"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }}
        >
          <div className="modal-dialog modal-dialog-centered offering-modal-dialog">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <div>
                  <h5 className="modal-title fw-bold text-dark mb-0">
                    {editingOffering
                      ? "Edit Course Offering"
                      : "Open Course Offering (Term 2026-2)"}
                  </h5>
                  <span className="text-muted small">
                    Manage course schedules and seat availability
                  </span>
                </div>
                <button
                  onClick={() => setShowOfferingModal(false)}
                  className="btn-close shadow-none"
                ></button>
              </div>

              <form onSubmit={handleSaveOffering}>
                <div className="modal-body offering-modal-body d-flex flex-column gap-3">
                  {offeringSaveError && (
                    <div className="alert alert-danger mb-0" role="alert">
                      {offeringSaveError}
                    </div>
                  )}
                  {offeringOptionsError && (
                    <div className="alert alert-danger mb-0" role="alert">
                      {offeringOptionsError}
                    </div>
                  )}
                  <div className="offering-field">
                    <label className="form-label fw-semibold text-secondary small">
                      Select Course
                    </label>
                    <select
                      className="form-select shadow-none"
                      value={offeringForm.courseId}
                      onChange={(e) => {
                        const courseId = e.target.value;
                        const usedSections = new Set(
                          offerings
                            .filter(
                              (offering) =>
                                offering.term === offeringForm.term &&
                                offering.courseId?._id === courseId &&
                                offering._id !== editingOffering?._id,
                            )
                            .map((offering) => Number(offering.section)),
                        );
                        const section = offeringOptions.sections.find(
                          (value) => !usedSections.has(Number(value)),
                        );
                        setOfferingForm({
                          ...offeringForm,
                          courseId,
                          section: section ?? "",
                        });
                      }}
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
                      <div className="text-danger small mt-1" role="alert">
                        {coursesError}
                      </div>
                    )}
                  </div>

                  <div className="row g-2">
                    <div className="col-6 offering-field">
                      <label className="form-label fw-semibold text-secondary small">
                        Section No.
                      </label>
                      <select
                        className="form-select shadow-none"
                        value={offeringForm.section}
                        disabled={!offeringForm.courseId}
                        onChange={(e) => {
                          setOfferingForm({
                            ...offeringForm,
                            section: Number(e.target.value),
                          });
                        }}
                        required
                      >
                        <option value="" disabled>
                          {offeringForm.courseId
                            ? sectionOptions.length === 0
                              ? "No sections available"
                              : "Select section"
                            : "Select course first"}
                        </option>
                        {editingOffering &&
                          !sectionOptions.includes(
                            Number(editingOffering.section),
                          ) && (
                            <option value={offeringForm.section}>
                              {offeringForm.section}
                            </option>
                          )}
                        {sectionOptions.map((section) => (
                          <option key={section} value={section}>
                            {section}
                          </option>
                        ))}
                      </select>
                      {offeringForm.courseId &&
                        sectionOptions.length === 0 &&
                        !editingOffering && (
                          <span className="offering-field-hint text-danger">
                            This course already has all four sections.
                          </span>
                        )}
                    </div>
                    <div className="col-6 offering-field">
                      <label className="form-label fw-semibold text-secondary small">
                        Total Seats
                      </label>
                      <input
                        type="number"
                        className="form-control shadow-none"
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

                  <div className="offering-schedule-fields">
                    <div className="offering-field">
                      <label className="form-label fw-semibold text-secondary small">
                        Day
                      </label>
                      <select
                        className="form-select shadow-none"
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
                    <div className="offering-field">
                      <label className="form-label fw-semibold text-secondary small">
                        Start Time
                      </label>
                      <select
                        className="form-select shadow-none"
                        value={offeringForm.startTime}
                        onChange={(e) =>
                          setOfferingForm({
                            ...offeringForm,
                            startTime: e.target.value,
                            endTime: getTwoHourEndTime(e.target.value),
                          })
                        }
                        required
                      >
                        {START_TIMES.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="offering-field">
                      <label className="form-label fw-semibold text-secondary small">
                        End Time
                      </label>
                      <input
                        type="time"
                        className="form-control shadow-none"
                        value={offeringForm.endTime}
                        readOnly
                        required
                      />
                      <span className="offering-field-hint">2-hour class</span>
                    </div>
                  </div>

                  <div className="row g-2">
                    <div className="col-6 offering-field">
                      <label className="form-label fw-semibold text-secondary small">
                        Room
                      </label>
                      <select
                        className="form-select shadow-none"
                        value={offeringForm.room}
                        onChange={(e) =>
                          setOfferingForm({
                            ...offeringForm,
                            room: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="" disabled>
                          Select room
                        </option>
                        {offeringForm.room &&
                          !offeringOptions.rooms.includes(
                            offeringForm.room,
                          ) && (
                            <option value={offeringForm.room}>
                              {offeringForm.room}
                            </option>
                          )}
                        {offeringOptions.rooms.map((room) => (
                          <option key={room} value={room}>
                            {room}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-6 offering-field">
                      <label className="form-label fw-semibold text-secondary small">
                        Instructor
                      </label>
                      <select
                        className="form-select shadow-none"
                        value={offeringForm.instructor}
                        onChange={(e) =>
                          setOfferingForm({
                            ...offeringForm,
                            instructor: e.target.value,
                          })
                        }
                        required
                      >
                        <option value="" disabled>
                          Select instructor
                        </option>
                        {offeringForm.instructor &&
                          !offeringOptions.instructors.includes(
                            offeringForm.instructor,
                          ) && (
                            <option value={offeringForm.instructor}>
                              {offeringForm.instructor}
                            </option>
                          )}
                        {offeringOptions.instructors.map((instructor) => (
                          <option key={instructor} value={instructor}>
                            {instructor}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="p-3 bg-light rounded-3 border mt-2">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input shadow-none"
                        type="checkbox"
                        role="switch"
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
                        className="form-check-label fw-semibold text-dark ms-2"
                        htmlFor="addDropCheck"
                      >
                        Open Add/Drop Window for this offering
                      </label>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light border-top px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setShowOfferingModal(false)}
                    className="btn btn-outline-secondary fw-medium px-4"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn text-white fw-medium px-4"
                    style={{
                      backgroundColor: "#0094DA",
                      borderColor: "#0094DA",
                    }}
                  >
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
