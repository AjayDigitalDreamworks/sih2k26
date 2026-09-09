import React, { createContext, useContext, useEffect, useState } from "react";
import ApiClient from "../lib/api";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  // Restore the session synchronously so ProtectedRoute never bounces a
  // returning (already logged-in) user back to /login on a refresh.
  const restoreSession = () => {
    const savedUser = localStorage.getItem("ner_logismart_user") || sessionStorage.getItem("ner_logismart_user");
    const token = localStorage.getItem("ner_access_token") || sessionStorage.getItem("ner_access_token");
    if (savedUser && token) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) return parsed;
      } catch (e) {
        console.error("Failed to parse saved user", e);
      }
    }
    return null;
  };

  const [user, setUser] = useState(restoreSession);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState(user?.role || "official");

  useEffect(() => {
    if (user?.role) setActiveRoleTab(user.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      localStorage.removeItem("ner_logismart_user");
      sessionStorage.removeItem("ner_logismart_user");
    };
    window.addEventListener("raahi:auth_expired", handleAuthExpired);
    return () => window.removeEventListener("raahi:auth_expired", handleAuthExpired);
  }, []);

  const saveUserSession = (userProfile, rememberMe = true) => {
    setUser(userProfile);
    const json = JSON.stringify(userProfile);
    if (rememberMe) {
      localStorage.setItem("ner_logismart_user", json);
    } else {
      sessionStorage.setItem("ner_logismart_user", json);
    }
  };

  const login = async (role, identifier, password, rememberMe = true) => {
    setIsLoading(true);

    try {
      // Real JWT Authentication with PostgreSQL / Backend
      const res = await ApiClient.login(identifier, password);

      if (res && res.success && res.data) {
        const { user: apiUser, accessToken, refreshToken } = res.data;
        ApiClient.setTokens(accessToken, refreshToken, rememberMe);

        const mappedRole =
          apiUser.role === "admin" || apiUser.role === "district_officer"
            ? "official"
            : apiUser.role === "transporter"
            ? "operator"
            : apiUser.role === "driver"
            ? "driver"
            : apiUser.role === "field_officer" || apiUser.role === "field_officier" || apiUser.role === "field_agent"
            ? "field_officer"
            : "user";

        const loggedInUser = {
          id: apiUser.id,
          name: apiUser.name,
          emailOrPhone: apiUser.email || identifier,
          role: mappedRole,
          backendRole: apiUser.role,
          roleTitle:
            mappedRole === "official"
              ? "Regional Command Officer"
              : mappedRole === "operator"
              ? "Fleet Operations Manager"
              : mappedRole === "driver"
              ? "Commercial Fleet Driver"
              : mappedRole === "field_officer"
              ? "Field GIS Verification Officer"
              : "Consignee / Citizen User",
          agency:
            apiUser.agency ||
            (mappedRole === "official"
              ? "MDoNER Logistics Division"
              : apiUser.transporterId
                ? "Registered Transporter"
                : mappedRole === "driver"
                ? "Fleet Logistics"
                : mappedRole === "field_officer"
                ? "State Disaster Response & GIS"
                : "Independent Operator"),
        };

        saveUserSession(loggedInUser, rememberMe);
        setIsLoading(false);
        return { success: true, message: `Welcome back, ${loggedInUser.name}!`, user: loggedInUser };
      } else {
        // Explicitly reject invalid credentials
        setIsLoading(false);
        return {
          success: false,
          message: res?.message || "Invalid email or password. Please check your credentials.",
        };
      }
    } catch (err) {
      setIsLoading(false);
      return {
        success: false,
        message: "Unable to connect to authentication server. Please check your backend connection.",
      };
    }
  };

  const logout = async () => {
    try {
      await ApiClient.logout();
    } catch (e) {}
    ApiClient.clearTokens();
    setUser(null);
    localStorage.removeItem("ner_logismart_user");
    sessionStorage.removeItem("ner_logismart_user");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        activeRoleTab,
        setActiveRoleTab,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
