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
  const [offeringCourseSearch, setOfferingCourseSearch] = useState("");
  const [activeOfferingCourseIndex, setActiveOfferingCourseIndex] =
    useState(-1);
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
  const [studentSearch, setStudentSearch] = useState("");
  const [studentRecord, setStudentRecord] = useState(null);
  const [studentRegistrations, setStudentRegistrations] = useState([]);
  const [studentCourseRequests, setStudentCourseRequests] = useState([]);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState("");
  const [pendingRequestNotifications, setPendingRequestNotifications] =
    useState([]);
  const [pendingNotificationsError, setPendingNotificationsError] =
    useState("");
  const [showRequestNotifications, setShowRequestNotifications] =
    useState(false);
  const [openRequestNotificationMenuKey, setOpenRequestNotificationMenuKey] =
    useState("");
  const [reviewingAddDropRequestId, setReviewingAddDropRequestId] =
    useState("");
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
  const overlappingScheduleOfferings = offerings.filter((offering) => {
    const sameDay =
      String(offering.day).toLocaleLowerCase() ===
      String(offeringForm?.day || "").toLocaleLowerCase();
    const overlapsTime =
      Boolean(offeringForm?.startTime && offeringForm?.endTime) &&
      offeringForm.startTime < offering.endTime &&
      offeringForm.endTime > offering.startTime;

    return (
      offering.term === offeringForm?.term &&
      offering._id !== editingOffering?._id &&
      sameDay &&
      overlapsTime
    );
  });
  const unavailableRooms = new Set(
    overlappingScheduleOfferings.map((offering) =>
      String(offering.room).trim().toLocaleLowerCase(),
    ),
  );
  const unavailableInstructors = new Set(
    overlappingScheduleOfferings.map((offering) =>
      String(offering.instructor).trim().toLocaleLowerCase(),
    ),
  );
  const roomOptions = [
    ...new Set([
      ...offeringOptions.rooms,
      ...(offeringForm?.room ? [offeringForm.room] : []),
    ]),
  ];
  const instructorOptions = [
    ...new Set([
      ...offeringOptions.instructors,
      ...(offeringForm?.instructor ? [offeringForm.instructor] : []),
    ]),
  ];
  const normalizedStudentSearch = studentSearch.trim().toLocaleLowerCase();
  const filteredStudents = students.filter((student) =>
    [student.name, student.studentId, student.email].some((value) =>
      String(value || "")
        .toLocaleLowerCase()
        .includes(normalizedStudentSearch),
    ),
  );
  const normalizedOfferingCourseSearch =
    offeringCourseSearch.trim().toLocaleLowerCase();
  const filteredOfferingCourses = courses.filter((course) =>
    [course.code, course.title].some((value) =>
      String(value || "")
        .toLocaleLowerCase()
        .includes(normalizedOfferingCourseSearch),
    ),
  );
  const selectedOfferingCourse = courses.find(
    (course) => course._id === offeringForm?.courseId,
  );
  const selectedStudent = students.find(
    (student) => student._id === selectedStudentId,
  );
  const unreadRequestCount = pendingRequestNotifications.filter(
    (notification) => !notification.read,
  ).length;

  const selectOfferingCourse = (course) => {
    const usedSections = new Set(
      offerings
        .filter(
          (offering) =>
            offering.term === offeringForm.term &&
            offering.courseId?._id === course._id &&
            offering._id !== editingOffering?._id,
        )
        .map((offering) => Number(offering.section)),
    );
    const section = offeringOptions.sections.find(
      (value) => !usedSections.has(Number(value)),
    );
    setOfferingForm({
      ...offeringForm,
      courseId: course._id,
      section: section ?? "",
    });
    setOfferingCourseSearch("");
    setActiveOfferingCourseIndex(-1);
  };

  const loadOfferings = useCallback(() => {
    setOfferingLoading(true);
    apiFetch("/offerings?term=2026-2")
      .then(setOfferings)
      .catch(console.error)
      .finally(() => setOfferingLoading(false));
  }, []);

  const loadPendingRequestNotifications = useCallback(async () => {
    try {
      const notifications = await apiFetch("/course-requests/advisor/pending");
      setPendingRequestNotifications(notifications);
      setPendingNotificationsError("");
    } catch (err) {
      setPendingNotificationsError(
        err.message || "Unable to load pending course request notifications.",
      );
    }
  }, []);

  // Load the active term's offerings on startup.
  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  useEffect(() => {
    loadPendingRequestNotifications();
    const intervalId = window.setInterval(
      loadPendingRequestNotifications,
      30000,
    );
    return () => window.clearInterval(intervalId);
  }, [loadPendingRequestNotifications]);

  useEffect(() => {
    if (activeOfferingCourseIndex >= 0) {
      document
        .getElementById(`offering-course-option-${activeOfferingCourseIndex}`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [activeOfferingCourseIndex]);

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
    if (!offeringForm.courseId) {
      setOfferingSaveError("Select a course before saving the offering.");
      return;
    }

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

  const handleOpenRequestNotification = async (notification) => {
    setActiveTab("register");
    setStudentSearch("");
    await handleSelectStudent(String(notification.studentId));
  };

  const handleToggleRequestRead = async (notification) => {
    const nextReadState = !notification.read;
    setPendingRequestNotifications((current) =>
      current.map((item) =>
        item.id === notification.id &&
        item.requestType === notification.requestType
          ? { ...item, read: nextReadState }
          : item,
      ),
    );
    try {
      await apiFetch(
        `/course-requests/advisor/notifications/${notification.requestType}/${notification.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ read: nextReadState }),
        },
      );
    } catch (err) {
      setPendingNotificationsError(
        err.message || "Unable to update notification read status.",
      );
      await loadPendingRequestNotifications();
    }
  };

  const handleDismissRequestNotification = async (notification) => {
    try {
      await apiFetch(
        `/course-requests/advisor/notifications/${notification.requestType}/${notification.id}`,
        { method: "DELETE" },
      );
      setPendingRequestNotifications((current) =>
        current.filter(
          (item) =>
            item.id !== notification.id ||
            item.requestType !== notification.requestType,
        ),
      );
      setPendingNotificationsError("");
      return true;
    } catch (err) {
      setPendingNotificationsError(
        err.message || "Unable to delete notification.",
      );
      await loadPendingRequestNotifications();
      return false;
    }
  };

  const handleReviewAddDropRequest = async (notification, decision) => {
    setReviewingAddDropRequestId(String(notification.id));
    setPendingNotificationsError("");
    try {
      await apiFetch(`/add-drop-requests/${notification.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      await Promise.all([
        loadPendingRequestNotifications(),
        loadOfferings(),
        selectedStudentId === String(notification.studentId)
          ? handleSelectStudent(selectedStudentId)
          : Promise.resolve(),
      ]);
      setRegisterSuccess(
        decision === "approved"
          ? notification.addDropType === "change_section"
            ? "Section change approved."
            : "Course drop approved."
          : "Add/drop request rejected.",
      );
    } catch (err) {
      setPendingNotificationsError(
        err.message || "Unable to review the add/drop request.",
      );
    } finally {
      setReviewingAddDropRequestId("");
    }
  };

  const handleRemoveStudentCourse = async (registrationId) => {
    if (!window.confirm("Remove this course from the student's schedule?"))
      return;
    setRegisterError("");
    setRegisterSuccess("");
    try {
      await apiFetch(`/registrations/${registrationId}`, {
        method: "DELETE",
      });
      setRegisterSuccess("Course removed from the student's schedule.");
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
      await loadPendingRequestNotifications();
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
      await loadPendingRequestNotifications();
      if (decision === "rejected") {
        setRegisterSuccess("Unfinished course request rejected.");
      }
    } catch (err) {
      setRegisterError(err.message || "Failed to review course request.");
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
              Welcome, Advisor {user.name}!
            </h1>
            <p className="text-muted mb-0 small">
              Department of Computer Science & IT
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="d-flex align-items-center gap-2">
            <div
              className="btn-group bg-light p-1 rounded-3 border"
              role="group"
            >
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
            <div className="position-relative">
              <button
                type="button"
                className={`btn btn-sm position-relative ${
                  showRequestNotifications
                    ? "btn-primary"
                    : "btn-light border text-secondary"
                }`}
                aria-label={`Course request notifications${
                  unreadRequestCount ? `, ${unreadRequestCount} unread` : ""
                }`}
                aria-expanded={showRequestNotifications}
                onClick={() => {
                  const nextOpen = !showRequestNotifications;
                  setShowRequestNotifications(nextOpen);
                  if (nextOpen) loadPendingRequestNotifications();
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 16a2 2 0 0 0 1.985-1.75h-3.97A2 2 0 0 0 8 16m.104-14.995a1 1 0 0 0-.208 0A5 5 0 0 0 3 6c0 1.098-.179 2.346-.468 3.327-.149.505-.338.99-.595 1.375-.246.368-.59.7-1.037.83V12h14.2v-.468c-.446-.13-.79-.462-1.036-.83-.257-.385-.446-.87-.595-1.375C13.18 8.346 13 7.098 13 6a5 5 0 0 0-4.896-4.995" />
                </svg>
                {unreadRequestCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                    {unreadRequestCount > 99 ? "99+" : unreadRequestCount}
                  </span>
                )}
              </button>
              {showRequestNotifications && (
                <div className="card shadow border-0 position-absolute end-0 mt-2 p-3 advisor-request-notification-menu">
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                    <strong className="small">Course Requests</strong>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={loadPendingRequestNotifications}
                    >
                      Refresh
                    </button>
                  </div>
                  {pendingNotificationsError ? (
                    <p className="small text-danger mb-0" role="alert">
                      {pendingNotificationsError}
                    </p>
                  ) : pendingRequestNotifications.length === 0 ? (
                    <p className="small text-secondary mb-0">
                      No pending course requests.
                    </p>
                  ) : (
                    <div className="d-flex flex-column gap-2 advisor-request-notification-list">
                      {pendingRequestNotifications.map((notification) => {
                        const notificationMenuKey = `${notification.requestType}-${notification.id}`;
                        return (
                          <div
                            key={notificationMenuKey}
                            className={`course-notification-item advisor-notification-item border rounded p-2 ${
                              notification.read
                                ? "bg-white"
                                : "bg-light is-unread"
                            }`}
                          >
                            {!notification.read && (
                              <span
                                className="course-notification-unread-dot"
                                aria-label="Unread notification"
                                title="Unread"
                              />
                            )}
                            <div className="course-notification-heading">
                              <button
                                type="button"
                                className="advisor-notification-link"
                                onClick={() => {
                                  if (!notification.read) {
                                    handleToggleRequestRead(notification);
                                  }
                                  setOpenRequestNotificationMenuKey("");
                                  setShowRequestNotifications(false);
                                  handleOpenRequestNotification(notification);
                                }}
                              >
                                <span className="d-block fw-semibold small text-dark">
                                  {notification.studentName} (
                                  {notification.studentNumber || "Student"})
                                </span>
                                <span className="d-block small text-secondary">
                                  {notification.courseCode} —{" "}
                                  {notification.courseTitle}
                                </span>
                                {notification.requestType === "add_drop" && (
                                  <span className="d-block small text-secondary mt-1">
                                    {notification.addDropType ===
                                    "change_section"
                                      ? `Change section ${notification.currentSection} → ${notification.targetSection} (${notification.targetSchedule})`
                                      : "Drop this course"}
                                  </span>
                                )}
                              </button>
                              <div className="position-relative">
                                <button
                                  type="button"
                                  className="course-notification-menu-button"
                                  aria-label={`Notification options for ${notification.studentName} ${notification.courseCode}`}
                                  aria-expanded={
                                    openRequestNotificationMenuKey ===
                                    notificationMenuKey
                                  }
                                  onClick={() =>
                                    setOpenRequestNotificationMenuKey(
                                      (currentKey) =>
                                        currentKey === notificationMenuKey
                                          ? ""
                                          : notificationMenuKey,
                                    )
                                  }
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 16 16"
                                    fill="currentColor"
                                    aria-hidden="true"
                                  >
                                    <circle cx="3" cy="8" r="1.5" />
                                    <circle cx="8" cy="8" r="1.5" />
                                    <circle cx="13" cy="8" r="1.5" />
                                  </svg>
                                </button>
                                {openRequestNotificationMenuKey ===
                                  notificationMenuKey && (
                                  <div
                                    className="course-notification-action-menu"
                                    role="group"
                                    aria-label="Notification actions"
                                  >
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await handleToggleRequestRead(
                                          notification,
                                        );
                                        setOpenRequestNotificationMenuKey("");
                                      }}
                                    >
                                      Mark as{" "}
                                      {notification.read ? "unread" : "read"}
                                    </button>
                                    <button
                                      type="button"
                                      className="course-notification-delete-action"
                                      onClick={async () => {
                                        const dismissed =
                                          await handleDismissRequestNotification(
                                            notification,
                                          );
                                        if (dismissed) {
                                          setOpenRequestNotificationMenuKey("");
                                        }
                                      }}
                                    >
                                      Delete notification
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {notification.requestType === "add_drop" && (
                              <>
                                <p className="small text-secondary mb-2 mt-2">
                                  {notification.message}
                                </p>
                                <div className="d-flex justify-content-end gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    disabled={
                                      reviewingAddDropRequestId ===
                                      String(notification.id)
                                    }
                                    onClick={() =>
                                      handleReviewAddDropRequest(
                                        notification,
                                        "rejected",
                                      )
                                    }
                                  >
                                    Reject
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-success"
                                    disabled={
                                      reviewingAddDropRequestId ===
                                      String(notification.id)
                                    }
                                    onClick={() =>
                                      handleReviewAddDropRequest(
                                        notification,
                                        "approved",
                                      )
                                    }
                                  >
                                    {reviewingAddDropRequestId ===
                                    String(notification.id)
                                      ? "Reviewing..."
                                      : "Approve"}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ================= TAB 1: COURSE OFFERINGS & ADD/DROP CONTROL ================= */}
      {activeTab === "offerings" && (
        <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
          <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 border-bottom pb-3 mb-3">
            <div>
              <h2 className="fs-5 fw-bold text-dark mb-1">
                Course Offerings (Term 2/2026)
              </h2>
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
                setOfferingCourseSearch("");
                setActiveOfferingCourseIndex(-1);
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
                    <th className="py-3 text-center">Add/Drop</th>
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
                            {off.addDropOpen ? "● Open" : "Closed"}
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
                                setOfferingCourseSearch("");
                                setActiveOfferingCourseIndex(-1);
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

              <input
                type="search"
                className="form-control shadow-none"
                placeholder={
                  studentsLoading
                    ? "Loading students..."
                    : "Search by name, student ID, or email..."
                }
                aria-label="Search students by name, student ID, or email"
                value={studentSearch}
                onChange={(event) => {
                  setStudentSearch(event.target.value);
                  setRegisterError("");
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !studentSearch.trim()) return;
                  event.preventDefault();
                  if (filteredStudents.length === 0) {
                    setRegisterError("No assigned students match your search.");
                    return;
                  }
                  const student = filteredStudents[0];
                  setStudentSearch("");
                  handleSelectStudent(student._id);
                }}
                disabled={studentsLoading}
              />

              {studentSearch.trim() && (
                <div className="list-group mt-2">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.slice(0, 8).map((student) => (
                      <button
                        key={student._id}
                        type="button"
                        className="list-group-item list-group-item-action text-start"
                        onClick={() => {
                          setStudentSearch("");
                          handleSelectStudent(student._id);
                        }}
                      >
                        <span className="d-block fw-semibold">
                          {student.name} ({student.studentId || "STU"})
                        </span>
                        <span className="small text-secondary">
                          {student.email}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="list-group-item small text-secondary">
                      No assigned students match your search.
                    </div>
                  )}
                </div>
              )}

              {!studentSearch.trim() && selectedStudent && (
                <div className="form-control mt-2 bg-light">
                  <span className="fw-semibold">{selectedStudent.name}</span>{" "}
                  <span className="text-secondary">
                    ({selectedStudent.studentId || "STU"}) —{" "}
                    {selectedStudent.email}
                  </span>
                </div>
              )}

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
                      Registered Courses (Term 2/2026)
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
                            No active course registrations for Term 2/2026.
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
                                  Remove from schedule
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
                      Course Requests (Term 2/2026)
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
                      : "Open Course Offering (Term 2/2026)"}
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
                  <div className="offering-field position-relative">
                    <label
                      htmlFor="offering-course-search"
                      className="form-label fw-semibold text-secondary small"
                    >
                      Select Course
                    </label>
                    <input
                      id="offering-course-search"
                      type="search"
                      className="form-control shadow-none mb-2"
                      placeholder="Search by course code or title"
                      value={offeringCourseSearch}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={Boolean(offeringCourseSearch.trim())}
                      aria-controls="offering-course-results"
                      aria-activedescendant={
                        activeOfferingCourseIndex >= 0
                          ? `offering-course-option-${activeOfferingCourseIndex}`
                          : undefined
                      }
                      onChange={(e) => {
                        setOfferingCourseSearch(e.target.value)
                        setActiveOfferingCourseIndex(-1);
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === "ArrowDown" &&
                          offeringCourseSearch.trim() &&
                          filteredOfferingCourses.length > 0
                        ) {
                          e.preventDefault();
                          setActiveOfferingCourseIndex((current) =>
                            current < filteredOfferingCourses.length - 1
                              ? current + 1
                              : 0,
                          );
                        } else if (
                          e.key === "ArrowUp" &&
                          offeringCourseSearch.trim() &&
                          filteredOfferingCourses.length > 0
                        ) {
                          e.preventDefault();
                          setActiveOfferingCourseIndex((current) =>
                            current <= 0
                              ? filteredOfferingCourses.length - 1
                              : current - 1,
                          );
                        } else if (
                          e.key === "Enter" &&
                          offeringCourseSearch.trim()
                        ) {
                          e.preventDefault();
                          const course =
                            filteredOfferingCourses[
                              activeOfferingCourseIndex
                            ];
                          if (course && activeOfferingCourseIndex >= 0) {
                            selectOfferingCourse(course);
                          }
                        } else if (e.key === "Escape") {
                          setOfferingCourseSearch("");
                          setActiveOfferingCourseIndex(-1);
                        }
                      }}
                      autoComplete="off"
                    />
                    {selectedOfferingCourse && (
                      <div className="d-flex align-items-center gap-2 rounded border border-primary-subtle bg-primary-subtle px-3 py-2 mb-2">
                        <span
                          className="badge rounded-pill text-bg-primary"
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                        <span className="small text-primary-emphasis">
                          <span className="fw-semibold">Selected:</span>{" "}
                          {selectedOfferingCourse.code} —{" "}
                          {selectedOfferingCourse.title}
                        </span>
                      </div>
                    )}
                    {offeringCourseSearch.trim() && (
                      <div
                        id="offering-course-results"
                        className="dropdown-menu show w-100 p-1"
                        role="listbox"
                        aria-label="Matching courses"
                        style={{
                          maxHeight: "180px",
                          overflowY: "auto",
                          position: "absolute",
                          zIndex: 1050,
                        }}
                      >
                        {filteredOfferingCourses.map((course, index) => (
                          <button
                            key={course._id}
                            type="button"
                            id={`offering-course-option-${index}`}
                            className={`dropdown-item rounded text-start ${
                              index === activeOfferingCourseIndex
                                ? "active"
                                : ""
                            }`}
                            role="option"
                            aria-selected={
                              index === activeOfferingCourseIndex
                            }
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() =>
                              setActiveOfferingCourseIndex(index)
                            }
                            onClick={() => selectOfferingCourse(course)}
                          >
                            {course.code} — {course.title} ({course.credits}{" "}
                            Credits)
                          </button>
                        ))}
                        {!coursesLoading &&
                          !coursesError &&
                          filteredOfferingCourses.length === 0 && (
                            <div className="list-group-item text-secondary">
                              No matching courses
                            </div>
                          )}
                      </div>
                    )}
                    {coursesError && (
                      <div className="text-danger small mt-1" role="alert">
                        {coursesError}
                      </div>
                    )}
                    {!offeringForm.courseId && courses.length === 0 && (
                      <div className="form-text">
                        {coursesLoading
                          ? "Loading courses..."
                          : coursesError
                            ? ""
                            : "No courses available"}
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
                        {roomOptions.map((room) => {
                          const unavailable = unavailableRooms.has(
                            String(room).trim().toLocaleLowerCase(),
                          );
                          return (
                            <option
                              key={room}
                              value={room}
                              disabled={unavailable}
                            >
                              {room}
                              {unavailable ? " (Unavailable)" : ""}
                            </option>
                          );
                        })}
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
                        {instructorOptions.map((instructor) => {
                          const unavailable = unavailableInstructors.has(
                            String(instructor).trim().toLocaleLowerCase(),
                          );
                          return (
                            <option
                              key={instructor}
                              value={instructor}
                              disabled={unavailable}
                            >
                              {instructor}
                              {unavailable ? " (Unavailable)" : ""}
                            </option>
                          );
                        })}
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
