import { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function AdminDashboard({ user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState("");
  const [telegramChats, setTelegramChats] = useState([]);
  const [telegramChatsError, setTelegramChatsError] = useState("");
  const [loadingTelegramChats, setLoadingTelegramChats] = useState(false);

  // Create Form State
  const [form, setForm] = useState({
    name: "",
    email: "",
    telegramChatId: "",
    role: "student",
    studentId: "",
    password: "",
  });

  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    telegramChatId: "",
    role: "student",
    studentId: "",
    active: true,
  });

  const loadUsers = async () => {
    try {
      const url = roleFilter ? `/users?role=${roleFilter}` : "/users";
      const data = await apiFetch(url);
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  const loadTelegramChats = async () => {
    setLoadingTelegramChats(true);
    setTelegramChatsError("");
    try {
      const chats = await apiFetch("/telegram/chats");
      setTelegramChats(chats);
    } catch (err) {
      setTelegramChatsError(err.message);
    } finally {
      setLoadingTelegramChats(false);
    }
  };

  // --- Create User ---
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({
        name: "",
        email: "",
        telegramChatId: "",
        role: "student",
        studentId: "",
        password: "",
      });
      loadUsers();
    } catch (err) {
      alert(err.message || "Failed to create user account");
    }
  };

  // --- Edit User ---
  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      telegramChatId: u.telegramChatId || "",
      role: u.role,
      studentId: u.studentId || "",
      active: u.active !== false,
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/users/${editingUser._id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      alert(err.message || "Failed to update user details");
    }
  };

  // --- Delete User Guardrails ---
  const handleDelete = async (u) => {
    // Safety Check 1: Cannot delete own account
    if (u._id === currentUser._id || u.email === currentUser.email) {
      alert("Action Blocked: You cannot delete your own admin account.");
      return;
    }

    // Safety Check 2: Check if system would be left with 0 admins
    const adminCount = users.filter(
      (usr) => usr.role === "admin" && usr.active !== false,
    ).length;
    if (u.role === "admin" && u.active !== false && adminCount <= 1) {
      alert("Action Blocked: System must never be left with zero admins.");
      return;
    }

    const confirmDelete = window.confirm(
      `Permanently delete ${u.name}? This also deletes their course registrations and academic records. This action cannot be undone.`,
    );
    if (!confirmDelete) return;

    try {
      await apiFetch(`/users/${u._id}`, { method: "DELETE" });
      loadUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  // Helper for Role Badges
  const getRoleBadgeClass = (role) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "bg-danger-subtle text-danger border-danger-subtle";
      case "advisor":
        return "bg-info-subtle text-info-emphasis border-info-subtle";
      case "student":
      default:
        return "bg-primary-subtle text-primary border-primary-subtle";
    }
  };

  // Helper for User Initials
  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const normalizedSearchTerm = searchTerm.trim().toLocaleLowerCase();
  const filteredUsers = normalizedSearchTerm
    ? users.filter((user) =>
        [user.name, user.email, user.studentId, user._id, user.id].some(
          (value) =>
            String(value ?? "")
              .toLocaleLowerCase()
              .includes(normalizedSearchTerm),
        ),
      )
    : users;

  return (
    <div className="container-fluid max-w-7xl px-3 px-md-4 py-4 min-vh-100">
      {/* Top Banner Header */}
      <div className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
        <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
          <div>
            <div
              className="d-inline-flex align-items-center gap-2 px-3 py-1 rounded-pill text-white fw-semibold fs-7 mb-2"
              style={{ backgroundColor: "#0094DA" }}
            >
              <svg
                width="14"
                height="14"
                fill="currentColor"
                viewBox="0 0 16 16"
              >
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
              </svg>
              Admin Management Portal
            </div>
            <h1 className="fs-3 fw-bold text-dark mb-1">
              User Account Administration
            </h1>
            <p className="text-muted mb-0 small">
              Manage platform roles, student credentials, permissions, and
              status controls
            </p>
          </div>

          {/* Metrics Bar */}
          <div className="d-flex gap-2 gap-sm-3 bg-light p-2 rounded-3 border w-100 w-lg-auto text-center justify-content-around">
            <div className="px-2 px-sm-3">
              <span
                className="d-block text-muted text-uppercase fw-semibold"
                style={{ fontSize: "10px" }}
              >
                Total
              </span>
              <span className="fs-5 fw-bold text-dark">{users.length}</span>
            </div>
            <div className="vr my-1"></div>
            <div className="px-2 px-sm-3">
              <span
                className="d-block text-muted text-uppercase fw-semibold"
                style={{ fontSize: "10px" }}
              >
                Students
              </span>
              <span className="fs-5 fw-bold text-primary">
                {users.filter((u) => u.role === "student").length}
              </span>
            </div>
            <div className="vr my-1"></div>
            <div className="px-2 px-sm-3">
              <span
                className="d-block text-muted text-uppercase fw-semibold"
                style={{ fontSize: "10px" }}
              >
                Advisors
              </span>
              <span className="fs-5 fw-bold text-info-emphasis">
                {users.filter((u) => u.role === "advisor").length}
              </span>
            </div>
            <div className="vr my-1"></div>
            <div className="px-2 px-sm-3">
              <span
                className="d-block text-muted text-uppercase fw-semibold"
                style={{ fontSize: "10px" }}
              >
                Admins
              </span>
              <span className="fs-5 fw-bold text-danger">
                {users.filter((u) => u.role === "admin").length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger border-0 shadow-sm rounded-3 d-flex align-items-center gap-2 mb-4">
          <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
            <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
          </svg>
          {error}
        </div>
      )}

      {/* Form Section: Create User */}
      <section className="card border-0 shadow-sm rounded-4 p-4 mb-4 bg-white">
        <div className="border-bottom pb-3 mb-3">
          <h2 className="fs-5 fw-bold text-dark mb-1">Create New Account</h2>
          <p className="text-muted small mb-0">
            Register a student, advisor, or administrator into the system.
          </p>
        </div>

        <form onSubmit={handleCreate} className="row g-3">
          <div className="col-md-4">
            <label className="form-label fw-semibold text-secondary small">
              Full Name
            </label>
            <input
              className="form-control form-control-md shadow-none"
              placeholder="Enter full name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="col-md-4">
            <label className="form-label fw-semibold text-secondary small">
              {form.role === "advisor" ? "Login Email Address" : "Email Address"}
            </label>
            <input
              className="form-control form-control-md shadow-none"
              placeholder="Enter email address"
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="col-md-4">
            <label className="form-label fw-semibold text-secondary small">
              User Role
            </label>
            <select
              className="form-select form-select-md shadow-none"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="student">Student</option>
              <option value="advisor">Advisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {form.role === "advisor" && (
            <div className="col-md-4">
              <label className="form-label fw-semibold text-secondary small">
                Advisor Telegram Chat ID
              </label>
              <input
                className="form-control form-control-md shadow-none"
                placeholder="Start the bot, then enter chat ID"
                value={form.telegramChatId}
                onChange={(e) =>
                  setForm({ ...form, telegramChatId: e.target.value })
                }
              />
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm mt-2"
                onClick={loadTelegramChats}
                disabled={loadingTelegramChats}
              >
                {loadingTelegramChats ? "Checking Telegram..." : "Find Telegram chats"}
              </button>
              {telegramChats.length > 0 && (
                <select
                  className="form-select form-select-sm mt-2"
                  value=""
                  onChange={(e) =>
                    setForm({ ...form, telegramChatId: e.target.value })
                  }
                >
                  <option value="">Choose a chat from recent bot activity</option>
                  {telegramChats.map((chat) => (
                    <option key={chat.chatId} value={chat.chatId}>
                      {chat.name}
                      {chat.username ? ` (@${chat.username})` : ""} — {chat.chatId}
                    </option>
                  ))}
                </select>
              )}
              {telegramChatsError && (
                <small className="text-danger d-block mt-2">
                  {telegramChatsError}
                </small>
              )}
              <small className="text-muted">
                The advisor must message the bot first. Keep the bot token on
                the server only.
              </small>
            </div>
          )}

          {form.role === "student" && (
            <div className="col-md-4">
              <label className="form-label fw-semibold text-secondary small">
                Student ID
              </label>
              <input
                className="form-control form-control-md shadow-none"
                placeholder="Enter student ID"
                value={form.studentId}
                onChange={(e) =>
                  setForm({ ...form, studentId: e.target.value })
                }
              />
            </div>
          )}

          <div className="col-md-4">
            <label className="form-label fw-semibold text-secondary small">
              Password
            </label>
            <input
              className="form-control form-control-md shadow-none"
              placeholder="Enter your password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div
            className={`col-md-${form.role === "student" ? "4" : "8"} d-flex align-items-end`}
          >
            <button
              type="submit"
              className="btn text-white fw-semibold px-4 w-100 shadow-sm d-flex justify-content-center align-items-center gap-2"
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
              Create Account
            </button>
          </div>
        </form>
      </section>

      {/* User List Table */}
      <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
        <div className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center justify-content-between gap-3 mb-3 border-bottom pb-3">
          <div>
            <div className="d-flex align-items-center gap-2">
              <h2 className="fs-5 fw-bold text-dark mb-0">List of Users</h2>
              {normalizedSearchTerm && (
                <span className="badge bg-light text-secondary border fw-medium">
                  {filteredUsers.length} of {users.length} match
                </span>
              )}
            </div>
            <p className="text-muted small mb-0">
              List of registered accounts and system credentials
            </p>
          </div>

          {/* Search & Filter Group */}
          <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2">
            {/* Modern Integrated Search Bar */}
            <div
              className="position-relative flex-grow-1"
              style={{ minWidth: "260px" }}
            >
              <span className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted">
                <svg
                  width="15"
                  height="15"
                  fill="currentColor"
                  viewBox="0 0 16 16"
                >
                  <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.099zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
                </svg>
              </span>
              <input
                type="text"
                className="form-control form-control-sm ps-5 pe-4 py-2 bg-light border-0 shadow-none rounded-3"
                placeholder="Search name, email, or student ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="btn btn-link btn-sm text-secondary text-decoration-none position-absolute top-50 end-0 translate-middle-y me-1 p-1"
                  onClick={() => setSearchTerm("")}
                  title="Clear search"
                >
                  <svg
                    width="12"
                    height="12"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Role Filter Select */}
            <div className="d-flex align-items-center gap-2">
              <select
                id="role-filter"
                className="form-select form-select-sm bg-light border-0 shadow-none py-2 rounded-3 text-secondary fw-semibold"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="">All Roles</option>
                <option value="student">Student</option>
                <option value="advisor">Advisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="bg-light">
              <tr
                className="text-uppercase text-secondary fw-bold border-bottom"
                style={{ fontSize: "11px", letterSpacing: "0.5px" }}
              >
                <th className="py-3 px-3">User Details</th>
                <th className="py-3">Role</th>
                <th className="py-3">Student ID</th>
                <th className="py-3">Status</th>
                <th className="py-3 text-end px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-5 text-muted">
                    <div className="d-flex flex-column align-items-center gap-2">
                      <svg
                        width="32"
                        height="32"
                        fill="currentColor"
                        className="text-black-50 mb-1"
                        viewBox="0 0 16 16"
                      >
                        <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.099zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0" />
                      </svg>
                      <span className="fw-semibold text-secondary">
                        No matching user accounts found
                      </span>
                      {searchTerm && (
                        <button
                          className="btn btn-link btn-sm text-decoration-none"
                          onClick={() => setSearchTerm("")}
                        >
                          Clear search query
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSelf =
                    u._id === currentUser._id || u.email === currentUser.email;

                  return (
                    <tr key={u._id} className="border-bottom-subtle">
                      <td className="py-3 px-3">
                        <div className="d-flex align-items-center gap-3">
                          <div
                            className="rounded-circle text-white fw-bold d-flex align-items-center justify-content-center"
                            style={{
                              width: "38px",
                              height: "38px",
                              fontSize: "13px",
                              backgroundColor: "#0094DA",
                            }}
                          >
                            {getInitials(u.name)}
                          </div>
                          <div>
                            <div className="fw-semibold text-dark d-flex align-items-center gap-2">
                              {u.name}
                              {isSelf && (
                                <span
                                  className="badge text-white font-monospace"
                                  style={{
                                    fontSize: "10px",
                                    backgroundColor: "#0094DA",
                                  }}
                                >
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-muted small">{u.email}</div>
                            {u.role === "advisor" && u.telegramChatId && (
                              <div className="text-muted small">
                                Telegram chat: {u.telegramChatId}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`badge border text-uppercase px-2.5 py-1 ${getRoleBadgeClass(
                            u.role,
                          )}`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="text-secondary small font-monospace">
                        {u.studentId || "—"}
                      </td>

                      <td>
                        <span
                          className={`badge rounded-pill px-2.5 py-1 ${
                            u.active !== false
                              ? "bg-success-subtle text-success border border-success-subtle"
                              : "bg-secondary-subtle text-secondary border border-secondary-subtle"
                          }`}
                        >
                          {u.active !== false ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td className="text-end px-3">
                        <div className="d-inline-flex gap-2">
                          <button
                            className="btn btn-outline-secondary btn-sm fw-medium d-flex align-items-center gap-1"
                            onClick={() => handleOpenEdit(u)}
                          >
                            <svg
                              width="14"
                              height="14"
                              fill="currentColor"
                              viewBox="0 0 16 16"
                            >
                              <path d="M12.146.146a.5.5 0 0 1 .708 0l1.292 1.292a.5.5 0 0 1 0 .708l-9.5 9.5a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l9.5-9.5zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            className="btn btn-outline-danger btn-sm fw-medium d-flex align-items-center gap-1"
                            onClick={() => handleDelete(u)}
                            disabled={isSelf}
                            title={
                              isSelf
                                ? "Cannot delete own account"
                                : "Delete user"
                            }
                          >
                            <svg
                              width="14"
                              height="14"
                              fill="currentColor"
                              viewBox="0 0 16 16"
                            >
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                              <path
                                fillRule="evenodd"
                                d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                              />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Edit User Details */}
      {editingUser && (
        <div
          className="modal show d-block backdrop-blur"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.45)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow-lg overflow-hidden">
              <div className="modal-header bg-light border-bottom px-4 py-3">
                <div>
                  <h5 className="modal-title fw-bold text-dark mb-0">
                    Edit User Details
                  </h5>
                  <span className="text-muted small">
                    Update profile and permissions
                  </span>
                </div>
                <button
                  onClick={() => setEditingUser(null)}
                  className="btn-close shadow-none"
                ></button>
              </div>

              <form onSubmit={handleSaveEdit}>
                <div className="modal-body p-4 d-flex flex-column gap-3">
                  <div>
                    <label className="form-label fw-semibold text-secondary small">
                      Full Name
                    </label>
                    <input
                      className="form-control shadow-none"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label fw-semibold text-secondary small">
                      {editForm.role === "advisor"
                        ? "Login Email Address"
                        : "Email Address"}
                    </label>
                    <input
                      type="email"
                      className="form-control shadow-none"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label fw-semibold text-secondary small">
                      User Role
                    </label>
                    <select
                      className="form-select shadow-none"
                      value={editForm.role}
                      onChange={(e) =>
                        setEditForm({ ...editForm, role: e.target.value })
                      }
                    >
                      <option value="student">Student</option>
                      <option value="advisor">Advisor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {editForm.role === "advisor" && (
                    <div>
                      <label className="form-label fw-semibold text-secondary small">
                        Advisor Telegram Chat ID
                      </label>
                      <input
                        className="form-control shadow-none"
                        value={editForm.telegramChatId}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            telegramChatId: e.target.value,
                          })
                        }
                        placeholder="Start the bot, then enter chat ID"
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm mt-2"
                        onClick={loadTelegramChats}
                        disabled={loadingTelegramChats}
                      >
                        {loadingTelegramChats
                          ? "Checking Telegram..."
                          : "Find Telegram chats"}
                      </button>
                      {telegramChats.length > 0 && (
                        <select
                          className="form-select form-select-sm mt-2"
                          value=""
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              telegramChatId: e.target.value,
                            })
                          }
                        >
                          <option value="">
                            Choose a chat from recent bot activity
                          </option>
                          {telegramChats.map((chat) => (
                            <option key={chat.chatId} value={chat.chatId}>
                              {chat.name}
                              {chat.username ? ` (@${chat.username})` : ""} —{" "}
                              {chat.chatId}
                            </option>
                          ))}
                        </select>
                      )}
                      {telegramChatsError && (
                        <small className="text-danger d-block mt-2">
                          {telegramChatsError}
                        </small>
                      )}
                      <small className="text-muted">
                        The advisor must message the bot first. Keep the bot
                        token on the server only.
                      </small>
                    </div>
                  )}

                  {editForm.role === "student" && (
                    <div>
                      <label className="form-label fw-semibold text-secondary small">
                        Student ID
                      </label>
                      <input
                        className="form-control shadow-none"
                        value={editForm.studentId}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            studentId: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}

                  <div className="p-3 bg-light rounded-3 border">
                    <div className="form-check form-switch m-0">
                      <input
                        className="form-check-input shadow-none"
                        type="checkbox"
                        role="switch"
                        id="activeStatusCheck"
                        checked={editForm.active}
                        onChange={(e) =>
                          setEditForm({ ...editForm, active: e.target.checked })
                        }
                      />
                      <label
                        className="form-check-label fw-semibold text-dark ms-2"
                        htmlFor="activeStatusCheck"
                      >
                        Account Active Status
                      </label>
                    </div>
                  </div>
                </div>

                <div className="modal-footer bg-light border-top px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
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
                    Save Changes
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
