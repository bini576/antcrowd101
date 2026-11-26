import PortalLogin from "@shared-ui/PortalLogin";

export default function LoginPage({ expectedRole, successPath, title }) {
  return (
    <PortalLogin
      expectedRole={expectedRole}
      successPath={successPath}
      title={title}
      description="Use your assigned account to access dashboard features."
    />
  );
}
