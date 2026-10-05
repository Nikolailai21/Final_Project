import React from "react";
// Import the logo asset at the top so Vite bundles it correctly
import logoImg from "../assets/Stamford-International-University-feature-img_bg_removed.png.png";

export default function Navbar({ user, onLogout }) {
  // Helper for dynamic role badge styling matching the screenshot colors
  const getRoleBadgeClass = (role) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return "bg-danger-subtle text-danger border-danger-subtle";
      case "advisor":
        return "bg-info-subtle text-info-emphasis border-info-subtle";
      case "student":
        return "bg-primary-subtle text-primary border-primary-subtle";
      default:
        return "bg-light text-dark border-light";
    }
  };

  return (
    <header
      className="navbar-shell text-white shadow"
      style={{ backgroundColor: "#0094DA" }}
    >
      <div className="container-fluid container-xxl py-3 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-3">
          <div className="bg-white text-white fw-bold p-1 rounded d-flex align-items-center justify-content-center">
            <img
              src={logoImg}
              alt="Stamford International University Logo"
              style={{ height: "60px", width: "auto", objectFit: "contain" }}
            />
          </div>
          <div>
            <h1 className="fw-bold fs-5 lh-1 mb-1">
              Course Registration Portal
            </h1>
            <p className="small text-white-50 mb-0">
              Department of Computer Science & IT
            </p>
          </div>
        </div>

        {user && (
          <div className="d-flex align-items-center gap-3">
            <div className="text-end">
              <p className="small fw-semibold text-nowrap mb-1">{user.name}</p>
              <span
                className={`badge border text-uppercase px-2.5 py-1 ${getRoleBadgeClass(
                  user.role,
                )}`}
              >
                {user.role}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="btn btn-outline-light btn-sm text-nowrap"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
