import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

type RequireOrganizationAuthProps = {
  children: React.ReactElement;
};

export default function RequireOrganizationAuth({ children }: RequireOrganizationAuthProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f1218', color: '#e5e7eb' }}>
        Loading your workspace...
      </div>
    );
  }

  if (user?.accountType === 'organization') {
    if (!['approved', 'not_required'].includes(user.approvalStatus)) {
      return <Navigate to="/organization/pending-approval" replace />;
    }
    return children;
  }

  return <Navigate to="/login" replace />;
}
