import PortalLogin from "@shared-ui/PortalLogin";

export default function LoginPage({ expectedRole, successPath, title }) {
  return (
    <PortalLogin
      expectedRole={expectedRole}
      successPath={successPath}
      title={title}
      description="Use your organization account to access training requests and approvals."
      wrongRoleLabel="organization admin"
    />
  );
}
