import { useState } from "react";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import AdvisorDashboard from "./pages/AdvisorDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import Navbar from "./components/Navbar";

export default function App() {
  const [user, setUser] = useState(() => {
    let savedUser = sessionStorage.getItem("user");
    let savedToken = sessionStorage.getItem("token");

    if (!savedUser || !savedToken) {
      const legacyUser = localStorage.getItem("user");
      const legacyToken = localStorage.getItem("token");
      if (legacyUser && legacyToken) {
        sessionStorage.setItem("user", legacyUser);
        sessionStorage.setItem("token", legacyToken);
        savedUser = legacyUser;
        savedToken = legacyToken;
      }
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }

    return savedUser && savedToken ? JSON.parse(savedUser) : null;
  });

  const handleLogout = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
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
