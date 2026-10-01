import React, { useState, useEffect } from "react";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdvisorDashboard from "./pages/AdvisorDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import Navbar from "./components/Navbar";

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  if (!user) return <Login onLoginSuccess={setUser} />;

  return (
    <div className="app-container">
      <Navbar user={user} onLogout={handleLogout} />
      <div className="main-content" style={{ padding: "20px" }}>
        {user.role === "admin" && <AdminDashboard user={user} />}
        {user.role === "advisor" && <AdvisorDashboard user={user} />}
        {user.role === "student" && <StudentDashboard user={user} />}
      </div>
    </div>
  );
}
