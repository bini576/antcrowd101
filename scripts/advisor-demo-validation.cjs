const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8089';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const PASSWORD = process.env.DEMO_PASSWORD || 'Antcrowd123!';

const ADMIN_USER = process.env.ADMIN_USER || 'platform-admin@antcrowd.local';
const ORG_USER = process.env.ORG_USER || 'org-admin@antcrowd.local';
const EXTERNAL_USER = process.env.EXTERNAL_USER || 'alpha@crowd.local';

const timestamp = Date.now();
const invitedResearcher = {
  fullName: `Advisor Internal ${timestamp}`,
  firstName: 'Advisor',
  lastName: `Internal${timestamp}`,
  displayName: `advisor-internal-${timestamp}`,
  email: `advisor.internal.${timestamp}@antcrowd.local`
};

const diagnostics = [];

function addDiagnostic(kind, label, message) {
  diagnostics.push(`${kind} [${label}] ${message}`);
}

function attachDiagnostics(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      addDiagnostic('console', label, msg.text());
    }
  });

  page.on('pageerror', (error) => {
    addDiagnostic('pageerror', label, error.message);
  });
}

async function clearAndType(locator, value) {
  await locator.click({ clickCount: 3 });
  await locator.press('Control+A');
  await locator.press('Backspace');
  await locator.type(value, { delay: 25 });
}

async function waitForExactPath(page, expectedPath) {
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 15000 });
}

async function expectBodyContent(page, label, minLength = 80) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(400);
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  assert.ok(text.length >= minLength, `${label} rendered too little content (${text.length} characters)`);
  for (const disallowed of ['Authentication request failed', 'Application error', 'Unhandled Runtime Error', 'ReferenceError', 'TypeError']) {
    assert.ok(!text.includes(disallowed), `${label} contains "${disallowed}"`);
  }
}

async function expectRedirectToLogin(page, path, expectedPath, label) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await waitForExactPath(page, expectedPath);
  await expectBodyContent(page, label, 40);
}

async function loginAdmin(page) {
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
  await clearAndType(page.getByPlaceholder('Work email'), ADMIN_USER);
  await clearAndType(page.getByPlaceholder('Enter your password'), PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await waitForExactPath(page, '/admin');
  await page.getByText('Unified Admin Dashboard').waitFor({ state: 'visible', timeout: 15000 });
  await expectBodyContent(page, 'admin dashboard');
}

async function loginMain(page, path, email, expectedPath, readyText, label) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await clearAndType(page.getByLabel('Email address'), email);
  await clearAndType(page.getByLabel('Password'), PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await waitForExactPath(page, expectedPath);
  await page.getByText(readyText, { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  await expectBodyContent(page, label);
}

async function navigateAndValidate(page, path, label, minLength = 80) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await expectBodyContent(page, label, minLength);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const redirectContext = await browser.newContext();
    const redirectPage = await redirectContext.newPage();
    await expectRedirectToLogin(redirectPage, '/organization/workspace', '/login', 'organization protected route');
    await expectRedirectToLogin(redirectPage, '/dashboard/internal', '/researchers/login', 'researcher protected route');
    await redirectContext.close();

    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    attachDiagnostics(publicPage, 'public');
    await navigateAndValidate(publicPage, '/', 'public home');
    await navigateAndValidate(publicPage, '/workspace/vdp/researcher/', 'public VDP dashboard');
    await navigateAndValidate(publicPage, '/workspace/vdp/researcher/security/acme', 'public VDP disclosure page');

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    attachDiagnostics(adminPage, 'admin');

    await loginAdmin(adminPage);
    await navigateAndValidate(adminPage, '/admin/researchers', 'admin researchers');
    await adminPage.getByText('Researcher Operations').waitFor({ state: 'visible', timeout: 15000 });

    await clearAndType(adminPage.getByPlaceholder('Full name *'), invitedResearcher.fullName);
    await clearAndType(adminPage.getByPlaceholder('Work email *'), invitedResearcher.email);
    await clearAndType(adminPage.getByPlaceholder('Optional onboarding note for the invite email'), 'Advisor demonstration invite');
    await adminPage.getByRole('button', { name: 'Invite Internal Researcher' }).click();

    const inviteNotice = adminPage.locator('.notice.success').filter({ hasText: 'Create Your ANTCROWD Account' });
    await inviteNotice.waitFor({ state: 'visible', timeout: 15000 });
    const inviteText = await inviteNotice.innerText();
    const inviteMatch = inviteText.match(/https?:\/\/\S+|\/create-password\?token=\S+/);
    assert.ok(inviteMatch, 'Invite link was not shown after sending the internal researcher invitation.');
    const inviteLink = inviteMatch[0].startsWith('http') ? inviteMatch[0] : `${BASE_URL}${inviteMatch[0]}`;
    assert.ok(inviteLink.includes('/create-password?token='), 'Invite link did not point to /create-password.');

    await adminPage.getByRole('button', { name: 'Logout' }).click();
    await waitForExactPath(adminPage, '/admin/login');
    await expectBodyContent(adminPage, 'admin logout', 30);

    const inviteContext = await browser.newContext();
    const invitePage = await inviteContext.newPage();
    attachDiagnostics(invitePage, 'invite');

    await invitePage.goto(inviteLink, { waitUntil: 'domcontentloaded' });
    await expectBodyContent(invitePage, 'invite acceptance');
    await clearAndType(invitePage.getByLabel('First name'), invitedResearcher.firstName);
    await clearAndType(invitePage.getByLabel('Last name'), invitedResearcher.lastName);
    await clearAndType(invitePage.getByLabel('Display name'), invitedResearcher.displayName);
    await clearAndType(invitePage.getByLabel('Create password'), PASSWORD);
    await clearAndType(invitePage.getByLabel('Confirm password'), PASSWORD);
    await invitePage.getByRole('button', { name: 'Create account' }).click();
    await invitePage.getByRole('link', { name: 'Continue to sign in' }).waitFor({ state: 'visible', timeout: 15000 });
    await invitePage.getByRole('link', { name: 'Continue to sign in' }).click();
    await waitForExactPath(invitePage, '/researchers/login');

    const reusedInviteContext = await browser.newContext();
    const reusedInvitePage = await reusedInviteContext.newPage();
    await reusedInvitePage.goto(inviteLink, { waitUntil: 'domcontentloaded' });
    await expectBodyContent(reusedInvitePage, 'invite reuse');
    const reuseText = await reusedInvitePage.locator('body').innerText();
    assert.ok(/already|invalid|expired/i.test(reuseText), 'Invite token reuse did not show an invalid or already-used state.');
    await reusedInviteContext.close();

    const internalContext = await browser.newContext();
    const internalPage = await internalContext.newPage();
    attachDiagnostics(internalPage, 'internal');

    await loginMain(
      internalPage,
      '/researchers/login',
      invitedResearcher.email,
      '/dashboard/internal',
      'Internal Researcher Dashboard',
      'internal researcher dashboard'
    );
    await internalPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForExactPath(internalPage, '/dashboard/internal');
    await expectBodyContent(internalPage, 'internal researcher dashboard after refresh');
    await navigateAndValidate(internalPage, '/workspace/pen/internal/', 'internal pentest workspace');
    await navigateAndValidate(internalPage, '/workspace/training/researcher/researcher', 'internal training workspace');
    await navigateAndValidate(internalPage, '/dashboard/internal', 'internal dashboard before logout');
    await internalPage.getByRole('button', { name: 'Sign out' }).click();
    await waitForExactPath(internalPage, '/researchers/login');
    await expectBodyContent(internalPage, 'internal logout', 40);

    const organizationContext = await browser.newContext();
    const organizationPage = await organizationContext.newPage();
    attachDiagnostics(organizationPage, 'organization');

    await loginMain(
      organizationPage,
      '/login',
      ORG_USER,
      '/organization/workspace',
      'Organization Command Center',
      'organization dashboard'
    );
    await organizationPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForExactPath(organizationPage, '/organization/workspace');
    await expectBodyContent(organizationPage, 'organization dashboard after refresh');
    await navigateAndValidate(organizationPage, '/workspace/pen/org/', 'organization pentest workspace');
    await navigateAndValidate(organizationPage, '/workspace/vdp/org/org-admin', 'organization VDP workspace');
    await navigateAndValidate(organizationPage, '/workspace/training/org/organization/training', 'organization training workspace');
    await navigateAndValidate(organizationPage, '/organization/workspace', 'organization dashboard before logout');
    await organizationPage.getByRole('button', { name: 'Sign out' }).click();
    await waitForExactPath(organizationPage, '/login');
    await expectBodyContent(organizationPage, 'organization logout', 40);

    const externalContext = await browser.newContext();
    const externalPage = await externalContext.newPage();
    attachDiagnostics(externalPage, 'external');

    await loginMain(
      externalPage,
      '/researchers/login',
      EXTERNAL_USER,
      '/dashboard/external',
      'External Researcher Dashboard',
      'external researcher dashboard'
    );
    await externalPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForExactPath(externalPage, '/dashboard/external');
    await expectBodyContent(externalPage, 'external researcher dashboard after refresh');
    await navigateAndValidate(externalPage, '/workspace/pen/external/', 'external pentest workspace');
    await navigateAndValidate(externalPage, '/dashboard/external', 'external dashboard before logout');
    await externalPage.getByRole('button', { name: 'Sign out' }).click();
    await waitForExactPath(externalPage, '/researchers/login');
    await expectBodyContent(externalPage, 'external logout', 40);

    if (diagnostics.length > 0) {
      throw new Error(`Browser diagnostics were not clean:\n${[...new Set(diagnostics)].join('\n')}`);
    }

    console.log(JSON.stringify({
      ok: true,
      invitedResearcher: invitedResearcher.email,
      validated: [
        'protected routes redirect correctly',
        'admin login and internal invite flow',
        'invite activation and one-time reuse protection',
        'internal researcher login, refresh, pen, training, logout',
        'organization login, refresh, pen, VDP, training, logout',
        'external researcher login, refresh, pen, logout',
        'public VDP pages render',
        'no browser console errors or page crashes observed'
      ]
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
