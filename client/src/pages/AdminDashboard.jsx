import React, { useEffect, useState } from "react";
import { apiFetch } from "../api";

export default function AdminDashboard({ user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [error, setError] = useState("");

  // Create Form State
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "student",
    studentId: "",
    password: "password123",
  });

  // Edit Modal State
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
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
        role: "student",
        studentId: "",
        password: "password123",
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

  return (
    <div className="container-xxl pb-5 p-3 p-md-4 rounded-4 bg-body-tertiary">
      {/* Top Header */}
      <div className="card border-0 dashboard-card p-4 bg-white mb-4">
        <span className="dashboard-caption fw-bold text-primary bg-primary-subtle px-3 py-1 rounded-pill text-uppercase">
          Admin Management Portal
        </span>
        <h2 className="fs-3 fw-bold text-dark mt-2 mb-0">
          User Account Administration
        </h2>
        <p className="dashboard-caption text-secondary mt-1 mb-0">
          Manage system users, student IDs, user roles, and account statuses
        </p>
      </div>

      {/* Form: Create User */}
      <section className="card border-0 dashboard-card p-4 mb-4">
        <h3 className="fs-6 fw-bold text-dark mb-3">Create New User Account</h3>
        <form onSubmit={handleCreate} className="row g-3 dashboard-caption">
          <div className="col-md-4">
            <label className="fw-bold mb-1">Full Name</label>
            <input
              className="form-control"
              placeholder="e.g. John Doe"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="fw-bold mb-1">Email Address</label>
            <input
              className="form-control"
              placeholder="e.g. john@stamford.edu"
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="col-md-4">
            <label className="fw-bold mb-1">User Role</label>
            <select
              className="form-select"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="student">Student</option>
              <option value="advisor">Advisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {form.role === "student" && (
            <div className="col-md-4">
              <label className="fw-bold mb-1">Student ID</label>
              <input
                className="form-control"
                placeholder="e.g. 2403040017"
                value={form.studentId}
                onChange={(e) =>
                  setForm({ ...form, studentId: e.target.value })
                }
              />
            </div>
          )}
          <div className="col-md-4">
            <label className="fw-bold mb-1">Initial Password</label>
            <input
              className="form-control"
              placeholder="Initial Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div className="col-md-4 d-flex align-items-end">
            <button type="submit" className="btn btn-primary fw-bold w-100">
              Create User Account
            </button>
          </div>
        </form>
      </section>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* User List Table */}
      <div className="card border-0 dashboard-card p-4">
        <div className="row align-items-center mb-3">
          <div className="col-auto">
            <h3 className="fs-6 fw-bold text-dark mb-0">System Users</h3>
          </div>
          <div className="col-auto ms-auto d-flex align-items-center gap-2">
            <label
              className="col-auto col-form-label dashboard-caption fw-semibold"
              htmlFor="role-filter"
            >
              Filter by Role:
            </label>
            <select
              id="role-filter"
              className="form-select form-select-sm"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="student">Student</option>
              <option value="advisor">Advisor</option>
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 dashboard-caption text-start">
            <thead>
              <tr
                className="border-bottom text-uppercase text-secondary fw-bold"
                style={{ fontSize: "11px" }}
              >
                <th className="pb-3">Name</th>
                <th className="pb-3">Email</th>
                <th className="pb-3">Role</th>
                <th className="pb-3">Student ID</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf =
                  u._id === currentUser._id || u.email === currentUser.email;

                return (
                  <tr key={u._id}>
                    <td className="fw-bold text-body">
                      {u.name}{" "}
                      {isSelf && (
                        <span className="badge bg-primary-subtle text-primary ms-1">
                          You
                        </span>
                      )}
                    </td>
                    <td className="text-secondary">{u.email}</td>
                    <td>
                      <span className="badge bg-light text-dark border text-uppercase">
                        {u.role}
                      </span>
                    </td>
                    <td className="text-secondary">{u.studentId || "-"}</td>
                    <td>
                      <span
                        className={`badge ${
                          u.active !== false
                            ? "bg-success-subtle text-success-emphasis"
                            : "bg-secondary-subtle text-secondary"
                        }`}
                      >
                        {u.active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="text-end">
                      <button
                        className="btn btn-light btn-sm fw-bold me-2"
                        onClick={() => handleOpenEdit(u)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm fw-bold"
                        onClick={() => handleDelete(u)}
                        disabled={isSelf}
                      >
                        Delete Permanently
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Edit User Details */}
      {editingUser && (
        <div className="modal show d-block bg-dark bg-opacity-50" tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 rounded-4 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">Edit User Details</h5>
                <button
                  onClick={() => setEditingUser(null)}
                  className="btn-close"
                ></button>
              </div>
              <form onSubmit={handleSaveEdit}>
                <div className="modal-body dashboard-caption dashboard-stack">
                  <div>
                    <label className="fw-bold mb-1">Full Name</label>
                    <input
                      className="form-control"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm({ ...editForm, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="fw-bold mb-1">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="fw-bold mb-1">User Role</label>
                    <select
                      className="form-select"
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

                  {editForm.role === "student" && (
                    <div>
                      <label className="fw-bold mb-1">Student ID</label>
                      <input
                        className="form-control"
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

                  <div className="form-check mt-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="activeStatusCheck"
                      checked={editForm.active}
                      onChange={(e) =>
                        setEditForm({ ...editForm, active: e.target.checked })
                      }
                    />
                    <label
                      className="form-check-label fw-bold"
                      htmlFor="activeStatusCheck"
                    >
                      Account Active
                    </label>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="btn btn-light fw-bold"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary fw-bold">
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
