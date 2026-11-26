#!/usr/bin/env python3
"""Patch all three service App.jsx files to remove demo auth and use session-based auth."""
import re
import os

SERVICES = [
    "bug-bounty-service",
    "ai-redteam-service",
    "challenge-service",
]

BASE = "/home/apex/Documents/integration (2)/integration/antcrowd101/services"


def patch_app_jsx(filepath: str) -> None:
    with open(filepath, "r") as f:
        content = f.read()

    original = content

    # 1. Fix imports — remove demo imports, add fetchWhoAmI
    content = content.replace(
        """import {
  closeProgram,
  createProgram,
  CURRENT_SERVICE,
  CURRENT_SERVICE_KEY,
  decideProgram,
  deleteProgram,
  DEMO_USERS,
  demoLogin,
  fetchDashboard,
  fetchNotifications,
  fetchPublicSnapshot,
  getRole,
  joinProgram,
  markNotificationRead,
  SERVICES,
  submitFinding,
} from "./api";""",
        """import {
  closeProgram,
  createProgram,
  CURRENT_SERVICE,
  CURRENT_SERVICE_KEY,
  decideProgram,
  deleteProgram,
  fetchDashboard,
  fetchNotifications,
  fetchPublicSnapshot,
  fetchWhoAmI,
  joinProgram,
  markNotificationRead,
  SERVICES,
  submitFinding,
} from "./api";"""
    )

    # 2. Remove sessionKey constant
    content = content.replace('const sessionKey = "antcrowd-demo-user";\n', '')

    # 3. Replace AppShell session state initialization
    content = content.replace(
        """  const [session, setSession] = useState(() => {
    const stored = window.localStorage.getItem(sessionKey);
    return stored ? JSON.parse(stored) : null;
  });""",
        """  const [session, setSession] = useState(null);"""
    )

    # 4. Replace username/role resolution
    content = content.replace(
        """  const username = session?.username ?? null;
  const role = getRole(username);""",
        """  const username = session?.username ?? null;
  const role = session?.role ?? null;
  const displayName = session?.displayName ?? null;
  const loginUrl = session?.loginUrl ?? "/login";
  const logoutUrl = session?.logoutUrl ?? "/api/auth/logout";"""
    )

    # 5. Add whoami effect after document.title effect
    whoami_effect = """
  useEffect(() => {
    fetchWhoAmI()
      .then((data) => {
        if (data.authenticated) {
          setSession({ username: data.username, role: data.role, displayName: data.displayName, loginUrl: data.loginUrl, logoutUrl: data.logoutUrl });
        } else {
          setSession({ username: null, role: "user", displayName: null, loginUrl: data.loginUrl, logoutUrl: data.logoutUrl });
        }
      })
      .catch(() => {
        setSession({ username: null, role: "user", displayName: null, loginUrl: "/login", logoutUrl: "/api/auth/logout" });
      });
  }, []);

"""
    # Insert after the document.title effect
    content = content.replace(
        """  useEffect(() => {
    document.title = `${CURRENT_SERVICE.name} | AntCrowd`;
  }, []);

  useEffect(() => {
    loadPublicSnapshots();
  }, []);""",
        """  useEffect(() => {
    document.title = `${CURRENT_SERVICE.name} | AntCrowd`;
  }, []);
""" + whoami_effect + """  useEffect(() => {
    loadPublicSnapshots();
  }, []);"""
    )

    # 6. Replace handleLogin with redirect
    # Remove the entire handleLogin function
    content = re.sub(
        r'  async function handleLogin\(usernameToUse\) \{.*?\n  \}\n',
        '  function handleLogin() {\n    window.location.href = loginUrl;\n  }\n',
        content, count=1, flags=re.DOTALL
    )

    # 7. Replace handleLogout to redirect to auth logout
    content = re.sub(
        r'  function handleLogout\(\) \{.*?\n  \}\n',
        '  function handleLogout() {\n    window.location.href = logoutUrl;\n  }\n',
        content, count=1, flags=re.DOTALL
    )

    # 8. Remove username from refreshWorkspace calls and update function
    content = content.replace(
        """    if (!username || role === "user") {
      setDashboards({});
      setNotificationsByService({});
      setLoading(false);
      return;
    }
    refreshWorkspace(username);
    const interval = window.setInterval(() => refreshWorkspace(username), REFRESH_INTERVAL_MS);""",
        """    if (!username || role === "user") {
      setDashboards({});
      setNotificationsByService({});
      setLoading(false);
      return;
    }
    refreshWorkspace();
    const interval = window.setInterval(() => refreshWorkspace(), REFRESH_INTERVAL_MS);"""
    )

    # Update refreshWorkspace to not take username param
    content = content.replace(
        "  async function refreshWorkspace(nextUsername) {",
        "  async function refreshWorkspace() {"
    )
    # Remove username from fetchDashboard/fetchNotifications calls
    content = content.replace(
        "serviceKeys.map((serviceKey) => fetchDashboard(serviceKey, nextUsername))",
        "serviceKeys.map((serviceKey) => fetchDashboard(serviceKey))"
    )
    content = content.replace(
        "serviceKeys.map((serviceKey) => fetchNotifications(serviceKey, nextUsername))",
        "serviceKeys.map((serviceKey) => fetchNotifications(serviceKey))"
    )

    # 9. Remove username from API calls that used to take it
    content = content.replace(
        "await joinProgram(serviceKey, programId, username)",
        "await joinProgram(serviceKey, programId)"
    )
    content = content.replace(
        "await markNotificationRead(note.serviceKey, note.id, username)",
        "await markNotificationRead(note.serviceKey, note.id)"
    )

    # 10. Update refreshWorkspace call in handlers
    content = content.replace(
        "refreshWorkspace(username)",
        "refreshWorkspace()"
    )

    # 11. Remove username from payloads
    content = re.sub(
        r'prepareProgramPayload\(username, programDraft\)',
        'prepareProgramPayload(programDraft)',
        content
    )
    # Fix prepareProgramPayload function to not take username
    content = content.replace(
        "function prepareProgramPayload(username, draft)",
        "function prepareProgramPayload(draft)"
    )
    content = re.sub(
        r'    return \{\n      username,\n      \.\.\.cleanDraft,',
        '    return {\n      ...cleanDraft,',
        content
    )

    # Remove username from submission payloads
    content = re.sub(
        r'        \? \{\n              username,\n              title:',
        '        ? {\n              title:',
        content
    )
    content = re.sub(
        r'            \? \{\n                username,\n                title:',
        '            ? {\n                title:',
        content
    )
    content = re.sub(
        r'            : \{\n                username,\n                title:',
        '            : {\n                title:',
        content
    )

    # Remove username from decision payloads
    content = content.replace(
        '{ username, action, comment: `${action}d by ${username}` }',
        '{ action, comment: `${action}d` }'
    )
    content = content.replace(
        '{ username, action: "delete", comment: `Deleted by ${username}` }',
        '{ action: "delete", comment: "Deleted" }'
    )
    content = content.replace(
        '{ username, action: "close", comment: `Closed by ${username}` }',
        '{ action: "close", comment: "Closed" }'
    )

    # 12. Update TopNav to use session display name and proper login/logout
    content = content.replace(
        '          onLogout={handleLogout}\n          onOpenLogin={() => setLoginOpen(true)}',
        '          onLogout={handleLogout}\n          onOpenLogin={handleLogin}\n          loginUrl={loginUrl}\n          logoutUrl={logoutUrl}'
    )
    content = content.replace(
        'function TopNav({ currentUser, role, aggregate, onLogout, onOpenLogin, onNotificationOpen }) {',
        'function TopNav({ currentUser, role, aggregate, onLogout, onOpenLogin, onNotificationOpen, displayName: navDisplayName }) {'
    )

    # 13. Replace demo login button text
    content = content.replace('>Demo Login</button>', '>Sign In</button>')
    content = content.replace('>Demo Login</button', '>Sign In</button')

    # 14. Update the display name shown in nav bar
    content = content.replace(
        '{currentUser === "researcher" ? "Bob" : currentUser}',
        '{navDisplayName || currentUser}'
    )

    # 15. Remove DemoLoginModal usage from render
    content = content.replace(
        '      {loginOpen ? <DemoLoginModal actionBusy={actionBusy} onClose={() => setLoginOpen(false)} onLogin={handleLogin} /> : null}',
        ''
    )

    # 16. Remove the entire DemoLoginModal component definition
    content = re.sub(
        r'function DemoLoginModal\(\{.*?\}\n\}\n',
        '',
        content, count=1, flags=re.DOTALL
    )

    # 17. Remove loginOpen state
    content = content.replace('  const [loginOpen, setLoginOpen] = useState(false);\n', '')

    # 18. Update LandingPage to not show demo accounts sidebar
    content = content.replace(
        '  return (\n    <div className="flex flex-col gap-8">\n      <section className="grid gap-6 rounded-[2rem]',
        '  return (\n    <div className="flex flex-col gap-8">\n      <section className="grid gap-6 rounded-[2rem]'
    )
    # Replace Demo Login button on landing with Sign In
    content = content.replace(
        '            {!currentUser ? <button type="button" onClick={onOpenLogin} className="rounded-full bg-[#C8102E] px-5 py-3 text-sm font-semibold text-white shadow-sm">Demo Login</button> : null}',
        '            {!currentUser ? <a href={loginUrl} className="rounded-full bg-[#C8102E] px-5 py-3 text-sm font-semibold text-white shadow-sm inline-block">Sign In</a> : null}'
    )

    # 19. Update LandingPage props to include loginUrl
    content = content.replace(
        '<LandingPage currentUser={username} onOpenLogin={() => setLoginOpen(true)} aggregate={aggregate} loading={loading} />',
        '<LandingPage currentUser={username} onOpenLogin={handleLogin} loginUrl={loginUrl} aggregate={aggregate} loading={loading} />'
    )
    content = re.sub(
        r'function LandingPage\(\{ currentUser, onOpenLogin, aggregate, loading \}\)',
        'function LandingPage({ currentUser, onOpenLogin, loginUrl, aggregate, loading })',
        content
    )

    # 20. Remove demo accounts sidebar from LandingPage
    content = re.sub(
        r'        <div className="rounded-\[1\.75rem\] border border-\[#efe3da\] bg-white/90 p-6">\n'
        r'          <h2 className="font-serif text-2xl text-slate-950">Demo accounts</h2>\n'
        r'          <div className="mt-4 grid gap-3">\n'
        r'            \{DEMO_USERS\.map\(\(account\) => \(\n'
        r'              <div key=\{account\.username\}.*?'
        r'            \)\)\}\n'
        r'          </div>\n'
        r'        </div>',
        '',
        content, count=1, flags=re.DOTALL
    )

    # 21. Pass displayName to TopNav
    content = content.replace(
        '          onNotificationOpen={handleNotificationOpen}\n        />',
        '          onNotificationOpen={handleNotificationOpen}\n          displayName={displayName}\n        />'
    )

    if content == original:
        print(f"  WARNING: No changes made to {filepath}")
    else:
        with open(filepath, "w") as f:
            f.write(content)
        print(f"  Patched: {filepath}")


for svc in SERVICES:
    fp = os.path.join(BASE, svc, "frontend", "src", "App.jsx")
    print(f"Processing {svc}...")
    patch_app_jsx(fp)

print("Done.")
