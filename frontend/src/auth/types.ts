export type AccountType = 'researcher' | 'organization' | 'platform_admin';
export type ResearcherType = 'internal' | 'external';
export type ApprovalStatus = 'not_required' | 'pending_submission' | 'submitted' | 'approved' | 'rejected';

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  website?: string | null;
  role: 'owner' | 'admin' | 'manager' | 'member';
};

export type PlatformRole = 'compliance_team' | 'developer';

export type AuthUser = {
  id: string;
  email: string;
  accountType: AccountType;
  researcherType?: ResearcherType | null;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  jobTitle?: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  approvalStatus: ApprovalStatus;
  organization?: OrganizationSummary | null;
  platformRole?: PlatformRole | null;
};
