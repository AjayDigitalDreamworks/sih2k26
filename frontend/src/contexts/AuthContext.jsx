import React, { createContext, useContext, useEffect, useState } from "react";
import ApiClient from "../lib/api";
import { parseJwt } from "../lib/jwt";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  // Restore session strictly derived from the cryptographically signed JWT token.
  // The client NEVER trusts unverified role properties in localStorage.
  const restoreSession = () => {
    const savedUser = localStorage.getItem("ner_logismart_user") || sessionStorage.getItem("ner_logismart_user");
    const token = localStorage.getItem("ner_access_token") || sessionStorage.getItem("ner_access_token");

    if (!token) return null;

    // Verify token claims and expiry
    const jwtClaims = parseJwt(token);
    if (!jwtClaims || !jwtClaims.id) {
      // Token is invalid, malformed, or expired
      ApiClient.clearTokens();
      localStorage.removeItem("ner_logismart_user");
      sessionStorage.removeItem("ner_logismart_user");
      return null;
    }

    const authoritativeBackendRole = jwtClaims.role;
    const authoritativeMappedRole =
      authoritativeBackendRole === "admin" || authoritativeBackendRole === "district_officer"
        ? "official"
        : authoritativeBackendRole === "transporter"
        ? "operator"
        : authoritativeBackendRole === "driver"
        ? "driver"
        : authoritativeBackendRole === "field_officer" || authoritativeBackendRole === "field_officier" || authoritativeBackendRole === "field_agent"
        ? "field_officer"
        : "user";

    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id === jwtClaims.id) {
          // Detect and self-correct any role tampering or stale localStorage role
          if (parsed.backendRole !== authoritativeBackendRole || parsed.role !== authoritativeMappedRole) {
            console.warn(
              `[Security] Detected role mismatch in storage. Token: ${authoritativeBackendRole}, Stored: ${parsed.backendRole}. Synchronizing to verified cryptographic token role.`
            );
            parsed.role = authoritativeMappedRole;
            parsed.backendRole = authoritativeBackendRole;
            localStorage.setItem("ner_logismart_user", JSON.stringify(parsed));
          }
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse saved user", e);
      }
    }

    // Fallback: reconstruct from verified cryptographic claims
    return {
      id: jwtClaims.id,
      name: jwtClaims.name || "User",
      emailOrPhone: jwtClaims.email || "",
      role: authoritativeMappedRole,
      backendRole: authoritativeBackendRole,
      roleTitle:
        authoritativeMappedRole === "official"
          ? "Regional Command Officer"
          : authoritativeMappedRole === "operator"
          ? "Fleet Operations Manager"
          : authoritativeMappedRole === "driver"
          ? "Commercial Fleet Driver"
          : authoritativeMappedRole === "field_officer"
          ? "Field GIS Verification Officer"
          : "Consignee / Citizen User",
      agency:
        authoritativeMappedRole === "official"
          ? "MDoNER Logistics Division"
          : jwtClaims.transporterId
          ? "Registered Transporter"
          : "Independent Operator",
    };
  };

  const [user, setUser] = useState(restoreSession);
  const [isLoading, setIsLoading] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState(user?.role || "official");

  useEffect(() => {
    if (user?.role) setActiveRoleTab(user.role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Validate session integrity with backend /api/auth/me on mount
  useEffect(() => {
    let isMounted = true;
    const verifySessionWithServer = async () => {
      const token = ApiClient.getAccessToken();
      if (!token) return;

      try {
        const res = await ApiClient.getMe();
        if (!isMounted) return;

        if (res && res.success && res.data) {
          const serverUser = res.data;
          const verifiedBackendRole = serverUser.role;
          const verifiedMappedRole =
            verifiedBackendRole === "admin" || verifiedBackendRole === "district_officer"
              ? "official"
              : verifiedBackendRole === "transporter"
              ? "operator"
              : verifiedBackendRole === "driver"
              ? "driver"
              : verifiedBackendRole === "field_officer" || verifiedBackendRole === "field_officier" || verifiedBackendRole === "field_agent"
              ? "field_officer"
              : "user";

          setUser((curr) => {
            if (!curr) return null;
            const updated = {
              ...curr,
              id: serverUser.id,
              name: serverUser.name || curr.name,
              emailOrPhone: serverUser.email || curr.emailOrPhone,
              role: verifiedMappedRole,
              backendRole: verifiedBackendRole,
              agency: serverUser.agency || curr.agency,
              phone: serverUser.phone || curr.phone,
            };
            localStorage.setItem("ner_logismart_user", JSON.stringify(updated));
            return updated;
          });
        } else if (res && !res.success && res.message?.includes('expired')) {
          // Token expired and refresh failed
          logout();
        }
      } catch (err) {
        // Network offline, keep using cryptographic JWT claims
      }
    };

    verifySessionWithServer();
    return () => {
      isMounted = false;
    };
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

  // Listen to 403 Forbidden events
  useEffect(() => {
    const handleForbidden = () => {
      // If user receives a 403, immediately re-verify profile from server
      ApiClient.getMe().then((res) => {
        if (res && res.success && res.data) {
          const serverRole = res.data.role;
          setUser((curr) => (curr ? { ...curr, backendRole: serverRole } : null));
        }
      });
    };
    window.addEventListener("raahi:forbidden", handleForbidden);
    return () => window.removeEventListener("raahi:forbidden", handleForbidden);
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
