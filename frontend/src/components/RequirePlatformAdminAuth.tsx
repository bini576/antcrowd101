import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type RequirePlatformAdminAuthProps = {
  children: React.ReactElement;
};

export default function RequirePlatformAdminAuth({ children }: RequirePlatformAdminAuthProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#020617', color: '#e2e8f0' }}>
        Loading the platform admin workspace...
      </div>
    );
  }

  if (user?.accountType === 'platform_admin') {
    return children;
  }

  return <Navigate to="/login" replace />;
}
