import React from "react";
// Import the logo asset at the top so Vite bundles it correctly
import logoImg from "../assets/Stamford-International-University-feature-img_bg_removed.png.png";

export default function Navbar({ user, onLogout }) {
  return (
    <header className="navbar-shell text-white shadow">
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
              <span className="badge text-bg-dark text-primary text-uppercase">
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
