import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { storeResearcherReturnTo } from '../researcher/researcherAuth';
import { useAuth } from '../auth/AuthContext';

type RequireResearcherAuthProps = {
  children: React.ReactElement;
};

export default function RequireResearcherAuth({ children }: RequireResearcherAuthProps) {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f1218', color: '#e5e7eb' }}>
        Loading your session...
      </div>
    );
  }

  if (user?.accountType === 'researcher') {
    return children;
  }

  const target = `${location.pathname}${location.search}${location.hash}`;
  storeResearcherReturnTo(target);

  return <Navigate to="/researchers/login" replace state={{ from: target }} />;
}
