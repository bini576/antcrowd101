import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { storeResearcherReturnTo } from '../researcher/researcherAuth';

type RequireApprovedResearcherProps = {
  children: React.ReactElement;
};

export default function RequireApprovedResearcher({ children }: RequireApprovedResearcherProps) {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f1218', color: '#e5e7eb' }}>
        Loading your researcher access...
      </div>
    );
  }

  if (!user || user.accountType !== 'researcher') {
    const target = `${location.pathname}${location.search}${location.hash}`;
    storeResearcherReturnTo(target);
    return <Navigate to="/researchers/login" replace state={{ from: target }} />;
  }

  if (user.approvalStatus !== 'approved') {
    return <Navigate to="/researcher/verification" replace />;
  }

  return children;
}
