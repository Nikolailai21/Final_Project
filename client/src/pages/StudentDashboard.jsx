import Schedule from "../components/Schedule";
import { useEffect, useState } from "react";
import { apiFetch } from "../api";
import WithdrawalRequestModal from "../components/WithdrawalRequestModal";

const NEXT_TERM = "2026-2";
const [NEXT_TERM_YEAR, NEXT_TERM_SEMESTER] = NEXT_TERM.split("-");
const NEXT_TERM_LABEL = `Term ${NEXT_TERM_SEMESTER}/${NEXT_TERM_YEAR}`;
const PASSING_GRADES = ["A", "B+", "B", "C+", "C", "D+", "D"];
const CURRICULUM_GROUPS = [
  {
    title: "General education",
    description: "(40 credits)",
    codes: [
      "ENG101",
      "ENG103",
      "ECO200",
      "GEO101",
      "HIS101",
      "MAT101",
      "MAT102",
      "MIS103",
      "PSY101",
      "PSY202",
      "SOC221",
      "STA101",
      "THA101",
    ],
  },
  {
    title: "Basic core",
    description: "(12 credits)",
    codes: ["ITE101", "ITE102", "ITE104"],
  },
  {
    title: "Information Technology courses",
    description: "(100 credits)",
    codes: [
      "ITE201",
      "ITE120",
      "ITE210",
      "ITE221",
      "ITE222",
      "ITE224",
      "ITE233",
      "ITE240",
      "ITE254",
      "ITE343",
      "ITE353",
      "ITE365",
      "ITE368",
      "ITE321",
      "ITE331",
      "ITE420",
      "ITE421",
      "ITE441",
      "ITE442",
      "ITE451",
      "ITE475",
      "ITE476",
      "ITE477",
      "ITE479",
      "ITE220",
    ],
  },
];
const APPROVED_COURSE_CODES = new Set(
  CURRICULUM_GROUPS.flatMap((group) => group.codes),
);

const isApprovedCourse = (course) => APPROVED_COURSE_CODES.has(course.code);

const getCourseDisplayCode = (course) => course?.code || "N/A";

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

  const semMatch = termStr.match(/(?:Semester|Term)\s*(\d+)\s*\/\s*(\d{4})/i);
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

const getTermDisplayLabel = (termStr) => {
  const semesterMatch = termStr?.match(
    /(?:Semester|Term)\s*(\d+)\s*\/\s*(\d{4})/i,
  );
  if (semesterMatch) {
    return `Term ${semesterMatch[1]}/${semesterMatch[2]}`;
  }

  const compactMatch = termStr?.match(/(\d{4})\s*-\s*(\d+)/);
  if (compactMatch) {
    return `Term ${compactMatch[2]}/${compactMatch[1]}`;
  }

  return termStr || "Previous Term";
};

const getUnfinishedCourses = (courses, records) => {
  const coursesInHistory = new Set(
    records
      .map((record) => String(record.courseId?._id || record.courseId))
      .filter(Boolean),
  );

  return courses
    .filter((course) => !coursesInHistory.has(String(course._id)))
    .sort((a, b) => a.code.localeCompare(b.code));
};

export default function StudentDashboard({ user }) {
  const [registrations, setRegistrations] = useState([]);
  const [records, setRecords] = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState("");
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [registrationsError, setRegistrationsError] = useState("");
  const [eligibleCourses, setEligibleCourses] = useState([]);
  const [eligibleCoursesLoading, setEligibleCoursesLoading] = useState(true);
  const [eligibleCoursesError, setEligibleCoursesError] = useState("");
  const [openOfferings, setOpenOfferings] = useState([]);
  const [openOfferingsLoading, setOpenOfferingsLoading] = useState(true);
  const [openOfferingsError, setOpenOfferingsError] = useState("");
  const [openOfferingNotificationError, setOpenOfferingNotificationError] =
    useState("");
  const [openOfferingMenuId, setOpenOfferingMenuId] = useState("");
  const [showOpenCourseNotifications, setShowOpenCourseNotifications] =
    useState(false);
  const [courseRequests, setCourseRequests] = useState([]);
  const [courseRequestsLoading, setCourseRequestsLoading] = useState(true);
  const [courseRequestsError, setCourseRequestsError] = useState("");
  const [courseRequestMessage, setCourseRequestMessage] = useState("");
  const [requestingCourseId, setRequestingCourseId] = useState("");

  // Search state for unfinished courses
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCurriculumGroups, setExpandedCurriculumGroups] = useState(() =>
    Object.fromEntries(CURRICULUM_GROUPS.map(({ title }) => [title, false])),
  );

  const loadRegistrations = () =>
    apiFetch("/students/me/registrations")
      .then((nextRegistrations) => {
        setRegistrations(nextRegistrations);
        setRegistrationsError("");
      })
      .catch((err) => setRegistrationsError(err.message));

  const loadEligibleCourses = (showLoading = false) => {
    if (showLoading) setEligibleCoursesLoading(true);
    return apiFetch("/students/me/eligible-courses")
      .then((courses) => {
        setEligibleCourses(courses);
        setEligibleCoursesError("");
      })
      .catch((err) => setEligibleCoursesError(err.message))
      .finally(() => setEligibleCoursesLoading(false));
  };

  const loadOpenOfferings = () =>
    apiFetch(`/offerings/open?term=${NEXT_TERM}`)
      .then((offerings) => {
        setOpenOfferings(offerings);
        setOpenOfferingsError("");
      })
      .catch((err) =>
        setOpenOfferingsError(err.message || "Unable to check open courses."),
      )
      .finally(() => setOpenOfferingsLoading(false));

  const setOpenOfferingReadState = async (offeringId, read) => {
    setOpenOfferingNotificationError("");
    try {
      await apiFetch(`/offerings/open/${offeringId}/read-state`, {
        method: "PATCH",
        body: JSON.stringify({ read }),
      });
      setOpenOfferings((currentOfferings) =>
        currentOfferings.map((offering) =>
          String(offering._id) === String(offeringId)
            ? { ...offering, read }
            : offering,
        ),
      );
      return true;
    } catch (err) {
      setOpenOfferingNotificationError(
        err.message || "Unable to update notification status.",
      );
      return false;
    }
  };

  const dismissOpenOfferingNotification = async (offeringId) => {
    setOpenOfferingNotificationError("");
    try {
      await apiFetch(`/offerings/open/${offeringId}/notification`, {
        method: "DELETE",
      });
      setOpenOfferings((currentOfferings) =>
        currentOfferings.filter(
          (offering) => String(offering._id) !== String(offeringId),
        ),
      );
      return true;
    } catch (err) {
      setOpenOfferingNotificationError(
        err.message || "Unable to delete notification.",
      );
      return false;
    }
  };

  const openCourseInFinder = async (offering) => {
    const markedRead = await setOpenOfferingReadState(offering._id, true);
    if (!markedRead) return;

    setSearchTerm(offering.courseId?.code || "");
    setShowOpenCourseNotifications(false);
    const searchInput = document.getElementById("student-course-search");
    searchInput?.scrollIntoView({ behavior: "smooth", block: "center" });
    searchInput?.focus({ preventScroll: true });
  };

  const loadCourseRequests = (showLoading = false) => {
    if (showLoading) setCourseRequestsLoading(true);
    return apiFetch("/course-requests/me")
      .then((requests) => {
        setCourseRequests(requests);
        setCourseRequestsError("");
      })
      .catch((err) => setCourseRequestsError(err.message))
      .finally(() => setCourseRequestsLoading(false));
  };

  const refreshCourseData = () => {
    loadRegistrations();
    loadEligibleCourses();
    loadOpenOfferings();
    loadCourseRequests();
  };

  useEffect(() => {
    loadRegistrations();
    apiFetch("/courses")
      .then(setCourses)
      .catch((err) => setCoursesError(err.message || "Unable to load courses."))
      .finally(() => setCoursesLoading(false));
    apiFetch("/students/me/eligible-courses")
      .then((courses) => {
        setEligibleCourses(courses);
        setEligibleCoursesError("");
      })
      .catch((err) => setEligibleCoursesError(err.message))
      .finally(() => setEligibleCoursesLoading(false));
    loadOpenOfferings();
    apiFetch("/course-requests/me")
      .then((requests) => {
        setCourseRequests(requests);
        setCourseRequestsError("");
      })
      .catch((err) => setCourseRequestsError(err.message))
      .finally(() => setCourseRequestsLoading(false));

    apiFetch("/students/me/record")
      .then(setRecords)
      .catch((err) =>
        setRecordsError(err.message || "Unable to load grade results."),
      )
      .finally(() => setRecordsLoading(false));

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        refreshCourseData();
      }
    };
    const courseDataRefresh = window.setInterval(refreshCourseData, 30000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(courseDataRefresh);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const handleRequestUnfinishedCourse = async (courseId) => {
    setCourseRequestMessage("");
    setRequestingCourseId(courseId);
    try {
      await apiFetch("/course-requests", {
        method: "POST",
        body: JSON.stringify({ courseId, term: NEXT_TERM }),
      });
      setCourseRequestMessage(
        "Course request sent. Your advisor will review it.",
      );
      await Promise.all([
        loadCourseRequests(true),
        loadEligibleCourses(),
        loadOpenOfferings(),
      ]);
    } catch (err) {
      setCourseRequestMessage(err.message || "Unable to request this course.");
    } finally {
      setRequestingCourseId("");
    }
  };

  const handleCancelRequest = async (courseId) => {
    setCourseRequestMessage("");
    try {
      // Find the specific request ID for this course
      const requestToCancel = courseRequests.find(
        (r) =>
          String(r.courseId?._id || r.courseId) === String(courseId) &&
          r.status === "pending",
      );
      if (requestToCancel) {
        await apiFetch(`/course-requests/${requestToCancel._id}`, {
          method: "DELETE",
        });
        await loadCourseRequests(true);
      }
    } catch (err) {
      setCourseRequestMessage(err.message || "Failed to cancel request.");
    }
  };
  const approvedCourses = courses.filter(isApprovedCourse);
  const unfinishedCourses = getUnfinishedCourses(approvedCourses, records);

  // Filtered courses based on search query
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredUnfinishedCourses = unfinishedCourses.filter(
    (c) =>
      getCourseDisplayCode(c).toLowerCase().includes(normalizedSearchTerm) ||
      c.title.toLowerCase().includes(normalizedSearchTerm),
  );
  const curriculumGroups = CURRICULUM_GROUPS.map((group) => ({
    ...group,
    courses: group.codes
      .map((code) => approvedCourses.find((course) => course.code === code))
      .filter(Boolean)
      .sort((a, b) =>
        a.code.localeCompare(b.code, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      ),
  }));
  const sortedOpenOfferings = [...openOfferings].sort(
    (a, b) =>
      a.courseId?.code.localeCompare(b.courseId?.code, undefined, {
        numeric: true,
        sensitivity: "base",
      }) || Number(a.section) - Number(b.section),
  );
  const unreadOpenOfferingCount = openOfferings.filter(
    (offering) => !offering.read,
  ).length;

  const registeredCourseIds = new Set(
    registrations
      .filter(
        (registration) =>
          registration.term === NEXT_TERM && registration.status === "registered",
      )
      .map((registration) =>
        String(
          registration.offeringId?.courseId?._id ||
            registration.offeringId?.courseId,
        ),
      ),
  );
  const termCourseRequests = courseRequests.filter((request) => {
    const courseId = String(request.courseId?._id || request.courseId);
    return (
      request.term === NEXT_TERM &&
      (request.status !== "approved" || registeredCourseIds.has(courseId))
    );
  });
  const activeCourseRequestIds = new Set(
    termCourseRequests
      .filter((request) => ["pending", "approved"].includes(request.status))
      .map((request) => String(request.courseId?._id || request.courseId)),
  );
  const comingSemesterCoursesById = new Map();
  registrations
    .filter(
      (registration) =>
        registration.term === NEXT_TERM && registration.status === "registered",
    )
    .forEach((registration) => {
      const offering = registration.offeringId;
      const course = offering?.courseId;
      if (course?._id) {
        comingSemesterCoursesById.set(String(course._id), {
          course,
          section: offering.section,
        });
      }
    });
  const comingSemesterCourses = [...comingSemesterCoursesById.values()].sort(
    (a, b) => a.course.code.localeCompare(b.course.code),
  );

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

        if (c.grade in GRADE_POINTS && c.grade !== "F") {
          thisEarn += c.credits;
        }

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
      <Schedule registrations={registrations} />
      {/* --- STANDALONE CARD: My Registered Courses --- */}
      <div className="card border-0 dashboard-card p-4 dashboard-stack">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h3 className="fs-6 fw-bold text-dark">
              Registration Courses ({NEXT_TERM_LABEL})
            </h3>
          </div>
        </div>

        {registrationsError && (
          <div className="alert alert-danger mb-0" role="alert">
            {registrationsError}
          </div>
        )}

        <div className="table-responsive">
          <table className="table table-hover align-middle text-start mb-0">
            <thead>
              <tr className="dashboard-caption fw-bold text-secondary text-uppercase">
                <th className="pb-3">Course</th>
                <th className="pb-3">Schedule</th>
                <th className="pb-3 text-center">Status</th>
                <th className="pb-3 text-end">Action</th>
              </tr>
            </thead>
            <tbody className="dashboard-caption">
              {registrations.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-4 text-center text-secondary">
                    No registered courses found.
                  </td>
                </tr>
              ) : (
                registrations.map((registration) => (
                  <tr key={registration._id}>
                    <td className="py-3 fw-bold text-body">
                      {getCourseDisplayCode(registration.offeringId?.courseId)}{" "}
                      <span className="fw-medium text-secondary">
                        — {registration.offeringId?.courseId?.title}
                      </span>
                    </td>
                    <td className="py-3 text-secondary">
                      {registration.offeringId?.day}{" "}
                      {registration.offeringId?.startTime}-
                      {registration.offeringId?.endTime}
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`badge ${
                          registration.status === "pending"
                            ? "bg-warning-subtle text-warning-emphasis"
                            : "bg-success-subtle text-success-emphasis"
                        }`}
                      >
                        {registration.status === "pending"
                          ? "Pending Approval"
                          : "Registered"}
                      </span>
                    </td>
                    <td className="py-3 text-end">
                      {registration.status === "registered" &&
                        registration.offeringId?.addDropOpen && (
                          <button
                            onClick={() =>
                              setSelectedRegistration(registration)
                            }
                            className="btn btn-dark btn-sm fw-bold"
                          >
                            Add/Drop Request
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

      {/* --- Course finder and curriculum checklist --- */}
      <div className="row g-4 align-items-start">
        <div className="col-lg-5">
          <div className="card border-0 dashboard-card available-classes-card p-3 p-md-4 dashboard-stack">
            <div className="d-flex justify-content-between align-items-start gap-3">
              <div>
                <h3 className="fs-6 fw-bold text-dark mb-1">Course Finder</h3>
                <p className="dashboard-caption text-secondary mb-0">
                  Search courses to request for {NEXT_TERM_LABEL}. Your
                  advisor must approve each request.
                </p>
              </div>
            </div>
            <div>
              <label
                htmlFor="student-course-search"
                className="form-label dashboard-caption fw-semibold"
              >
                Search by course code or title
              </label>
              <input
                id="student-course-search"
                type="search"
                className="form-control form-control-sm dashboard-caption"
                placeholder="e.g. ITE101 or Programming"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {openOfferingsError && (
              <div className="alert alert-danger mb-0 dashboard-caption" role="alert">
                Course availability could not be checked: {openOfferingsError}
                {" "}Course requests are disabled until availability can be
                checked.
              </div>
            )}
            {recordsError && (
              <div className="alert alert-danger mb-0" role="alert">
                {recordsError}
              </div>
            )}
            {coursesError && (
              <div className="alert alert-danger mb-0" role="alert">
                {coursesError}
              </div>
            )}
            {courseRequestMessage && (
              <div className="alert alert-info mb-0" role="status">
                {courseRequestMessage}
              </div>
            )}
            {courseRequestsError && (
              <div className="alert alert-danger mb-0" role="alert">
                {courseRequestsError}
              </div>
            )}

            {recordsLoading || coursesLoading ? (
              <div className="text-center text-secondary py-3">
                Loading available courses...
              </div>
            ) : searchTerm.trim() ? (
              <div className="table-responsive">
                <table className="table table-hover align-middle text-start mb-0">
                  <colgroup>
                    <col />
                    <col style={{ width: "1%" }} />
                  </colgroup>
                  <thead>
                    <tr className="dashboard-caption fw-bold text-secondary text-uppercase">
                      <th className="pb-2">Course</th>
                      <th className="pb-2 text-end text-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody className="dashboard-caption">
                    {recordsError || coursesError ? (
                      <tr>
                        <td
                          colSpan="2"
                          className="py-4 text-center text-secondary"
                        >
                          Courses cannot be requested until course history
                          loads.
                        </td>
                      </tr>
                    ) : filteredUnfinishedCourses.length === 0 ? (
                      <tr>
                        <td
                          colSpan="2"
                          className="py-4 text-center text-secondary"
                        >
                          No courses match your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUnfinishedCourses.map((course) => {
                        const hasActiveRequest = activeCourseRequestIds.has(
                          String(course._id),
                        );
                        const hasOpenOffering = openOfferings.some(
                          (offering) =>
                            String(offering.courseId?._id) ===
                            String(course._id),
                        );
                        return (
                          <tr key={course._id}>
                            <td className="py-2 fw-bold text-body">
                              {getCourseDisplayCode(course)}{" "}
                              <span className="fw-medium text-secondary">
                                — {course.title}
                              </span>
                            </td>
                            <td className="py-2 text-end text-nowrap">
                              {hasActiveRequest ? (
                                courseRequests.find(
                                  (r) =>
                                    String(r.courseId?._id || r.courseId) ===
                                    String(course._id),
                                )?.status === "pending" ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCancelRequest(course._id)
                                    }
                                    className="btn btn-outline-danger btn-sm fw-bold"
                                  >
                                    Take Back
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn btn-success btn-sm fw-bold opacity-75"
                                    disabled
                                  >
                                    Approved
                                  </button>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRequestUnfinishedCourse(course._id)
                                  }
                                  className="btn btn-primary btn-sm fw-bold"
                                  disabled={
                                    requestingCourseId === course._id ||
                                    openOfferingsLoading ||
                                    Boolean(openOfferingsError) ||
                                    !hasOpenOffering
                                  }
                                  title={
                                    openOfferingsError
                                      ? "Course availability could not be checked."
                                      : hasOpenOffering
                                        ? undefined
                                        : "Unavailable until the advisor opens a section with available seats."
                                  }
                                >
                                  {requestingCourseId === course._id
                                    ? "Requesting..."
                                    : openOfferingsLoading
                                      ? "Checking..."
                                      : hasOpenOffering &&
                                          !openOfferingsError
                                        ? "Request Course"
                                        : "Unavailable"}
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
            ) : (
              <div className="course-finder-empty dashboard-caption text-secondary">
                Start typing to find a course. The full course list stays hidden
                until you search.
              </div>
            )}

            {/* Inner Section: My Course Requests */}
            <div className="border-top pt-3">
              <h4 className="fs-6 fw-bold text-dark">My Course Requests</h4>
              {courseRequestsLoading ? (
                <p className="dashboard-caption text-center text-secondary">
                  Loading course requests...
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle text-start mb-0">
                    <thead>
                      <tr className="dashboard-caption fw-bold text-secondary text-uppercase">
                        <th className="pb-3">Course</th>
                        <th className="pb-3">Request Date</th>
                        <th className="pb-3 text-center">Advisor Decision</th>
                      </tr>
                    </thead>
                    <tbody className="dashboard-caption">
                      {termCourseRequests.length === 0 ? (
                        <tr>
                          <td
                            colSpan="3"
                            className="py-4 text-center text-secondary"
                          >
                            No course requests submitted for {NEXT_TERM_LABEL}.
                          </td>
                        </tr>
                      ) : (
                        termCourseRequests.map((request) => (
                          <tr key={request._id}>
                            <td className="py-3 fw-bold text-body">
                              {getCourseDisplayCode(request.courseId)}{" "}
                              <span className="fw-medium text-secondary">
                                — {request.courseId?.title}
                              </span>
                            </td>
                            <td className="py-3 text-secondary">
                              {new Date(request.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 text-center">
                              <span
                                className={`badge ${
                                  request.status === "pending"
                                    ? "bg-warning-subtle text-warning-emphasis"
                                    : request.status === "approved"
                                      ? "bg-success-subtle text-success-emphasis"
                                      : "bg-danger-subtle text-danger-emphasis"
                                }`}
                              >
                                {request.status === "pending"
                                  ? "Pending"
                                  : request.status === "approved"
                                    ? "Approved"
                                    : "Rejected"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-7">
          <div className="card border-0 dashboard-card curriculum-card p-3 p-md-4 dashboard-stack">
            <div>
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
                <div className="d-flex w-100 justify-content-between align-items-start gap-3">
                  <h3 className="fs-6 fw-bold text-dark mb-1">
                    Information Technology 2021 Curriculum
                  </h3>
                  <div className="position-relative course-notification-anchor">
                    <button
                      type="button"
                      className={`btn btn-sm position-relative ${
                        showOpenCourseNotifications
                          ? "btn-primary"
                          : "btn-light border text-secondary"
                      }`}
                      aria-label={`Open course notifications${
                        unreadOpenOfferingCount
                          ? `, ${unreadOpenOfferingCount} unread`
                          : ""
                      }`}
                      aria-expanded={showOpenCourseNotifications}
                      aria-controls="open-course-notifications"
                      title="Courses open for requests"
                      onClick={() =>
                        setShowOpenCourseNotifications((isOpen) => !isOpen)
                      }
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
                      {unreadOpenOfferingCount > 0 && !openOfferingsError && (
                        <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                          {unreadOpenOfferingCount > 99
                            ? "99+"
                            : unreadOpenOfferingCount}
                        </span>
                      )}
                    </button>
                    {showOpenCourseNotifications && (
                      <div
                        id="open-course-notifications"
                        className="card shadow border-0 position-absolute end-0 mt-2 p-3 course-notification-menu"
                        role="region"
                        aria-label="Open course notifications"
                      >
                        <h4 className="dashboard-caption fw-bold text-dark mb-2">
                          Open courses for {NEXT_TERM_LABEL}
                        </h4>
                        {openOfferingsError ? (
                          <p className="dashboard-caption text-danger mb-0">
                            Course availability could not be checked:{" "}
                            {openOfferingsError}
                          </p>
                        ) : openOfferingsLoading ? (
                          <p className="dashboard-caption text-secondary mb-0">
                            Checking course availability...
                          </p>
                        ) : sortedOpenOfferings.length === 0 ? (
                          <p className="dashboard-caption text-secondary mb-0">
                            No courses are currently open for requests.
                          </p>
                        ) : (
                          <ul className="list-unstyled dashboard-caption mb-0">
                            {sortedOpenOfferings.map((offering) => {
                              const course = offering.courseId;
                              return (
                                <li
                                  className={`course-notification-item border-top py-2 ${
                                    offering.read ? "" : "is-unread"
                                  }`}
                                  key={offering._id}
                                >
                                  {!offering.read && (
                                    <span
                                      className="course-notification-unread-dot"
                                      aria-label="Unread notification"
                                      title="Unread"
                                    />
                                  )}
                                  <div className="course-notification-heading">
                                    <button
                                      type="button"
                                      className="course-notification-link"
                                      onClick={() =>
                                        openCourseInFinder(offering)
                                      }
                                    >
                                      <strong>{course.code}</strong> —{" "}
                                      {course.title}
                                    </button>
                                    <div className="position-relative">
                                      <button
                                        type="button"
                                        className="course-notification-menu-button"
                                        aria-label={`Notification options for ${course.code} section ${offering.section}`}
                                        aria-expanded={
                                          openOfferingMenuId === offering._id
                                        }
                                        onClick={() =>
                                          setOpenOfferingMenuId((currentId) =>
                                            currentId === offering._id
                                              ? ""
                                              : offering._id,
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
                                      {openOfferingMenuId === offering._id && (
                                        <div
                                          className="course-notification-action-menu"
                                          role="group"
                                          aria-label="Notification actions"
                                        >
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              const updated =
                                                await setOpenOfferingReadState(
                                                  offering._id,
                                                  !offering.read,
                                                );
                                              if (updated) {
                                                setOpenOfferingMenuId("");
                                              }
                                            }}
                                          >
                                            Mark as{" "}
                                            {offering.read ? "unread" : "read"}
                                          </button>
                                          <button
                                            type="button"
                                            className="course-notification-delete-action"
                                            onClick={async () => {
                                              const dismissed =
                                                await dismissOpenOfferingNotification(
                                                  offering._id,
                                                );
                                              if (dismissed) {
                                                setOpenOfferingMenuId("");
                                              }
                                            }}
                                          >
                                            Delete notification
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="course-notification-details text-secondary">
                                    {offering.day} {offering.startTime}-
                                    {offering.endTime} · {offering.instructor}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {openOfferingNotificationError && (
                          <p
                            className="dashboard-caption text-danger mt-2 mb-0"
                            role="alert"
                          >
                            {openOfferingNotificationError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {recordsError && (
              <div
                className="alert alert-danger mb-0 dashboard-caption"
                role="alert"
              >
                Curriculum completion cannot be checked until academic history
                loads.
              </div>
            )}
            {eligibleCoursesError && (
              <div
                className="alert alert-warning mb-0 dashboard-caption"
                role="alert"
              >
                Term availability could not be loaded: {eligibleCoursesError}
              </div>
            )}
            {coursesLoading ? (
              <div className="text-center text-secondary py-3 dashboard-caption">
                Loading curriculum courses...
              </div>
            ) : (
              <>
                <div className="curriculum-groups">
                  {curriculumGroups.map((group) => (
                    <section className="curriculum-group" key={group.title}>
                      <button
                        type="button"
                        className="curriculum-group-heading"
                        aria-expanded={expandedCurriculumGroups[group.title]}
                        aria-controls={`curriculum-group-${group.title
                          .toLowerCase()
                          .replaceAll(" ", "-")}`}
                        onClick={() =>
                          setExpandedCurriculumGroups((expanded) => ({
                            ...expanded,
                            [group.title]: !expanded[group.title],
                          }))
                        }
                      >
                        <span className="curriculum-group-title">
                          {group.title}
                        </span>
                        <span className="curriculum-group-control">
                          <span className="dashboard-caption text-secondary">
                            {group.courses.length} courses
                          </span>
                          <span
                            className="curriculum-group-toggle-icon"
                            aria-hidden="true"
                          >
                            {expandedCurriculumGroups[group.title] ? "−" : "+"}
                          </span>
                        </span>
                      </button>
                      {expandedCurriculumGroups[group.title] && (
                        <div
                          id={`curriculum-group-${group.title
                            .toLowerCase()
                            .replaceAll(" ", "-")}`}
                        >
                          <p className="dashboard-caption text-secondary mb-2 mt-2 fw-sbold">
                            {group.description}
                          </p>
                          {group.courses.length === 0 ? (
                            <p className="dashboard-caption text-secondary mb-0">
                              None of these courses are currently listed in the
                              course catalog.
                            </p>
                          ) : (
                            <div className="table-responsive curriculum-table-wrap">
                              <table className="table table-sm align-middle mb-0 curriculum-table">
                                <thead>
                                  <tr>
                                    <th scope="col" className="text-center">
                                      Done
                                    </th>
                                    <th scope="col">Course code</th>
                                    <th scope="col">Course name</th>
                                    <th scope="col" className="text-end">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.courses.map((course) => {
                                    const courseId = String(course._id);
                                    const completed = records.some(
                                      (record) =>
                                        String(
                                          record.courseId?._id ||
                                            record.courseId,
                                        ) === courseId &&
                                        PASSING_GRADES.includes(record.grade),
                                    );
                                    const request = termCourseRequests.find(
                                      (item) =>
                                        String(
                                          item.courseId?._id || item.courseId,
                                        ) === courseId &&
                                        item.term === NEXT_TERM,
                                    );
                                    const registration = registrations.find(
                                      (item) =>
                                        item.term === NEXT_TERM &&
                                        item.status === "registered" &&
                                        String(
                                          item.offeringId?.courseId?._id ||
                                            item.offeringId?.courseId,
                                        ) === courseId,
                                    );
                                    const courseAvailability =
                                      eligibleCourses.filter(
                                        (item) =>
                                          String(
                                            item.offering?.courseId?._id,
                                          ) === courseId,
                                      );
                                    const hasOpenOffering = openOfferings.some(
                                      (offering) =>
                                        String(offering.courseId?._id) ===
                                        courseId,
                                    );
                                    const openCourseAvailability =
                                      courseAvailability.filter((item) =>
                                        openOfferings.some(
                                          (offering) =>
                                            String(offering._id) ===
                                            String(item.offering?._id),
                                        ),
                                      );
                                    const availableOpenOffering =
                                      openCourseAvailability.find(
                                        (item) => item.eligible,
                                      );
                                    let status = "Not completed";
                                    let statusClass = "text-secondary";
                                    if (completed) {
                                      status = "Completed";
                                      statusClass = "text-success";
                                    } else if (registration) {
                                      status = `Registered for ${NEXT_TERM_LABEL}`;
                                      statusClass = "text-success";
                                    } else if (request?.status === "pending") {
                                      status = `Pending approval for ${NEXT_TERM_LABEL}`;
                                      statusClass = "text-warning-emphasis";
                                    } else if (request?.status === "approved") {
                                      status = `Approved for ${NEXT_TERM_LABEL}`;
                                      statusClass = "text-success";
                                    } else if (request?.status === "rejected") {
                                      status = `Request declined for ${NEXT_TERM_LABEL}`;
                                      statusClass = "text-danger";
                                    } else if (availableOpenOffering) {
                                      status = `Available in ${NEXT_TERM_LABEL}`;
                                      statusClass = "text-primary";
                                    } else if (eligibleCoursesLoading) {
                                      status = "Checking term availability";
                                    } else if (
                                      !hasOpenOffering &&
                                      !openOfferingsError
                                    ) {
                                      status =
                                        "Unavailable — advisor has not opened a section";
                                    } else if (hasOpenOffering) {
                                      status =
                                        openCourseAvailability[0]?.reason ||
                                        "Not available to request";
                                    } else if (courseAvailability.length > 0) {
                                      status =
                                        courseAvailability[0].reason ||
                                        "Not available to request";
                                    }

                                    return (
                                      <tr key={course._id}>
                                        <td className="text-center">
                                          <span
                                            className={`curriculum-check ${
                                              completed
                                                ? ""
                                                : "curriculum-check-empty"
                                            }`}
                                            aria-label={
                                              completed
                                                ? "Completed"
                                                : "Not completed"
                                            }
                                          >
                                            {completed ? "✓" : ""}
                                          </span>
                                        </td>
                                        <th scope="row" className="text-nowrap">
                                          {getCourseDisplayCode(course)}
                                        </th>
                                        <td>{course.title}</td>
                                        <td
                                          className={`curriculum-course-status ${statusClass}`}
                                        >
                                          {status}
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
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- Section 3: Dynamic Academic Progress & Transcript Grid --- */}
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
                      {getTermDisplayLabel(sem.term)}
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

                  {/* Course Table */}
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
                                className="dashboard-caption fw-bold px-3 py-1 rounded-pill shadow-xs"
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

                  {/* Dual Summary Blocks */}
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
          {!courseRequestsLoading && comingSemesterCourses.length > 0 && (
            <div className="card border-0 dashboard-card p-3 p-md-4">
              <h4 className="small fw-bold text-primary-emphasis border-bottom border-light pb-3 mb-0">
                Coming {NEXT_TERM_LABEL}
              </h4>
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
                      <th className="pb-2 text-end">Section</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comingSemesterCourses.map(({ course, section }) => (
                      <tr key={course._id}>
                        <td className="fw-bold text-body py-2">
                          {getCourseDisplayCode(course)}
                        </td>
                        <td className="text-secondary py-2">{course.title}</td>
                        <td className="text-center text-secondary py-2">
                          {course.credits || 4} Credits
                        </td>
                        <td className="text-end text-secondary py-2">
                          {section || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1/3): Student Information & Advisor */}
        <div className="col-lg-4 dashboard-stack">
          <h3 className="fs-6 fw-bold text-dark">Student Information</h3>

          {/* Profile Card */}
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

          {/* Assigned Advisor Box */}
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
            <span className="dashboard-caption text-secondary">
              Add/drop requests are sent to your advisor through Telegram.
            </span>
          </div>
        </div>
      </div>

      {/* Add / Drop Modal */}
      {selectedRegistration && (
        <WithdrawalRequestModal
          registration={selectedRegistration}
          onClose={() => setSelectedRegistration(null)}
        />
      )}
    </div>
  );
}
