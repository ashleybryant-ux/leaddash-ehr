import React from "react";
import { Route, Routes, Navigate } from "react-router-dom";
import { authRoutes, publicRoutes } from "./router.link";
import Feature from "../layouts/feature";
import AuthFeature from "../layouts/authFeature";
import AuthProvider from "../contexts/AuthProvider";

const ALLRoutes: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Default redirect to dashboard */}
        <Route path="/" element={<Navigate to="/index" replace />} />
        
        {/* Public Routes - with main layout */}
        <Route element={<Feature />}>
          {publicRoutes.map((route, idx) => (
            <Route path={route.path} element={route.element} key={idx} />
          ))}
        </Route>

        {/* Auth Routes - minimal layout */}
        <Route element={<AuthFeature />}>
          {authRoutes.map((route, idx) => (
            <Route path={route.path} element={route.element} key={idx} />
          ))}
        </Route>

        {/* SSO Entry Point */}
        <Route
          path="/auth/sso"
          element={
            <div className="d-flex justify-content-center align-items-center" style={{ height: "100vh" }}>
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          }
        />

        {/* Catch-all - redirect to 404 */}
        <Route path="*" element={<Navigate to="/error-404" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default ALLRoutes;