'use client';

import { useState } from 'react';

type Section = 'overview' | 'snowflake-setup' | 'saas-connection' | 'sync-launch';

const sections: { id: Section; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '1' },
  { id: 'snowflake-setup', label: 'Snowflake Setup', icon: '2' },
  { id: 'saas-connection', label: 'Connect to Gallery', icon: '3' },
  { id: 'sync-launch', label: 'Sync & Launch', icon: '4' },
];

function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm overflow-x-auto font-mono leading-relaxed">
        {children.trim()}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-600"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function StepNumber({ n }: { n: string }) {
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold mr-2 shrink-0">
      {n}
    </span>
  );
}

function SectionOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
        <p className="text-muted-foreground leading-relaxed">
          Snowflake App Gallery connects to your Snowflake account via the SQL API using keypair authentication.
          A dedicated <strong>Gallery Operator</strong> Native App manages compute pool lifecycle (start, stop, auto-expiry)
          inside your Snowflake account. This SaaS application provides the web UI for your team.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-4">
          <div className="text-2xl mb-2">❄️</div>
          <h3 className="font-semibold mb-1">Snowflake Account</h3>
          <p className="text-sm text-muted-foreground">
            Install Gallery Operator, create a dedicated user and role for API access.
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl mb-2">🔑</div>
          <h3 className="font-semibold mb-1">Keypair Auth</h3>
          <p className="text-sm text-muted-foreground">
            Generate an RSA keypair. The public key is assigned to the Snowflake user; the private key is stored here.
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl mb-2">🖥</div>
          <h3 className="font-semibold mb-1">Gallery SaaS</h3>
          <p className="text-sm text-muted-foreground">
            Configure the connection in Settings, sync your app catalog, and manage apps from the web.
          </p>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">Prerequisites</h3>
        <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
          <li>Snowflake account with ACCOUNTADMIN access (for initial setup)</li>
          <li>Gallery Operator Native App installed (<code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">BLUE_APP_GALLERY</code>)</li>
          <li>At least one app registered in the Operator dashboard</li>
          <li>OpenSSL installed locally (for keypair generation)</li>
        </ul>
      </div>
    </div>
  );
}

function SectionSnowflakeSetup() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Snowflake Setup</h2>
        <p className="text-muted-foreground mb-6">
          Create a dedicated user and role that the Gallery SaaS will use to communicate with your Snowflake account.
          This user should only have access to the Gallery Operator API — nothing else.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <StepNumber n="1" />
          Generate RSA Keypair
        </h3>
        <p className="text-sm text-muted-foreground ml-9">
          Run these commands on your local machine to generate a 2048-bit RSA keypair in PKCS#8 format.
        </p>
        <div className="ml-9">
          <CodeBlock>{`# Generate private key (PKCS#8 format, no passphrase)
openssl genrsa 2048 | openssl pkcs8 -topk8 -inform PEM -out gallery_key.p8 -nocrypt

# Extract public key
openssl rsa -in gallery_key.p8 -pubout -out gallery_key.pub`}</CodeBlock>
        </div>
        <div className="ml-9 border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Important:</strong> The private key must be in PKCS#8 format
            (begins with <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded">-----BEGIN PRIVATE KEY-----</code>).
            PKCS#1 format (<code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded">BEGIN RSA PRIVATE KEY</code>) is not supported.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <StepNumber n="2" />
          Create Account Role
        </h3>
        <p className="text-sm text-muted-foreground ml-9">
          Create a Snowflake role dedicated to Gallery SaaS API access.
          This role will be granted the Operator&apos;s application role.
        </p>
        <div className="ml-9">
          <CodeBlock>{`-- Run as ACCOUNTADMIN
USE ROLE ACCOUNTADMIN;

-- Create dedicated role for Gallery SaaS
CREATE ROLE IF NOT EXISTS GALLERY_SAAS_ROLE
  COMMENT = 'Role for App Gallery SaaS to access Operator API';

-- Grant the Operator application role to this account role
GRANT APPLICATION ROLE BLUE_APP_GALLERY.operator_saas
  TO ROLE GALLERY_SAAS_ROLE;`}</CodeBlock>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <StepNumber n="3" />
          Create Dedicated User
        </h3>
        <p className="text-sm text-muted-foreground ml-9">
          Create a service user that authenticates via keypair only. This user cannot log in interactively.
        </p>
        <div className="ml-9">
          <CodeBlock>{`-- Run as ACCOUNTADMIN
USE ROLE ACCOUNTADMIN;

-- Read your public key (remove header/footer/newlines)
-- Example: MIIBIjANBgkqhk...

CREATE USER IF NOT EXISTS GALLERY_SAAS_USER
  TYPE = SERVICE
  DEFAULT_ROLE = GALLERY_SAAS_ROLE
  RSA_PUBLIC_KEY = '<paste public key content here>'
  COMMENT = 'Service user for App Gallery SaaS';

-- Grant the role to the user
GRANT ROLE GALLERY_SAAS_ROLE TO USER GALLERY_SAAS_USER;`}</CodeBlock>
        </div>
        <div className="ml-9 border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Tip:</strong> To extract the public key content without headers, run:<br />
            <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 rounded mt-1 inline-block">
              grep -v &quot;^---&quot; gallery_key.pub | tr -d &apos;\n&apos;
            </code>
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <StepNumber n="4" />
          Verify Setup
        </h3>
        <p className="text-sm text-muted-foreground ml-9">
          Test that the user can call the Operator API.
        </p>
        <div className="ml-9">
          <CodeBlock>{`-- Switch to the new role and user context
USE ROLE GALLERY_SAAS_ROLE;

-- This should return the Operator version
CALL BLUE_APP_GALLERY.api.get_version();

-- This should list your registered apps
CALL BLUE_APP_GALLERY.api.list_apps();`}</CodeBlock>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <StepNumber n="5" />
          Find Your Account Identifiers
        </h3>
        <p className="text-sm text-muted-foreground ml-9">
          You will need these values when configuring the connection in the Gallery SaaS.
        </p>
        <div className="ml-9">
          <CodeBlock>{`-- Account Identifier (org-account format, e.g., MYORG-MYACCOUNT)
-- Found in the Snowsight URL: https://app.snowflake.com/MYORG/MYACCOUNT/

-- Account Locator (e.g., TC59315)
SELECT CURRENT_ACCOUNT();`}</CodeBlock>
        </div>
      </div>
    </div>
  );
}

function SectionSaaSConnection() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Connect to Gallery</h2>
        <p className="text-muted-foreground mb-6">
          Configure the Snowflake connection in this application.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <StepNumber n="1" />
          Go to Settings → Connections
        </h3>
        <p className="text-sm text-muted-foreground ml-9">
          Click <strong>Add Connection</strong> and fill in the following fields:
        </p>
        <div className="ml-9 border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-3 font-medium">Field</th>
                <th className="text-left p-3 font-medium">Value</th>
                <th className="text-left p-3 font-medium">Example</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="p-3 font-mono text-xs">Account Identifier</td>
                <td className="p-3 text-muted-foreground">Org-Account format from Snowsight URL</td>
                <td className="p-3 font-mono text-xs">MYORG-MYACCOUNT</td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs">Account Locator</td>
                <td className="p-3 text-muted-foreground">Result of SELECT CURRENT_ACCOUNT()</td>
                <td className="p-3 font-mono text-xs">TC59315</td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs">Username</td>
                <td className="p-3 text-muted-foreground">The service user you created</td>
                <td className="p-3 font-mono text-xs">GALLERY_SAAS_USER</td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs">Role</td>
                <td className="p-3 text-muted-foreground">The account role you created</td>
                <td className="p-3 font-mono text-xs">GALLERY_SAAS_ROLE</td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs">Private Key</td>
                <td className="p-3 text-muted-foreground">Full PEM content of gallery_key.p8</td>
                <td className="p-3 font-mono text-xs">-----BEGIN PRIVATE KEY-----...</td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs">Database</td>
                <td className="p-3 text-muted-foreground">Gallery Operator app name</td>
                <td className="p-3 font-mono text-xs">BLUE_APP_GALLERY</td>
              </tr>
              <tr>
                <td className="p-3 font-mono text-xs">Warehouse</td>
                <td className="p-3 text-muted-foreground">Leave empty (serverless)</td>
                <td className="p-3 font-mono text-xs">(empty)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <StepNumber n="2" />
          Test the Connection
        </h3>
        <p className="text-sm text-muted-foreground ml-9">
          Click <strong>Test</strong> on the connection card. This calls <code className="text-xs bg-muted px-1 rounded">api.get_version()</code> to verify
          that authentication and role grants are working correctly.
        </p>
        <div className="ml-9 border rounded-lg p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <strong>Common issues:</strong>
          </p>
          <ul className="text-sm text-amber-700 dark:text-amber-300 list-disc list-inside mt-1 space-y-1">
            <li><strong>JWT error</strong> — Account Locator may be wrong. Use <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">SELECT CURRENT_ACCOUNT()</code></li>
            <li><strong>Unknown function</strong> — Database field should be the app name (e.g., <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">BLUE_APP_GALLERY</code>)</li>
            <li><strong>Insufficient privileges</strong> — Ensure <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">GRANT APPLICATION ROLE ... TO ROLE</code> was run</li>
            <li><strong>PKCS#1 error</strong> — Private key must start with <code className="text-xs bg-amber-100 dark:bg-amber-900 px-1 rounded">BEGIN PRIVATE KEY</code> (PKCS#8)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function SectionSyncLaunch() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Sync & Launch</h2>
        <p className="text-muted-foreground mb-6">
          Once connected, sync your app catalog and start managing apps.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <StepNumber n="1" />
          Sync App Catalog
        </h3>
        <p className="text-sm text-muted-foreground ml-9">
          Go to <strong>Settings → App Catalog</strong> and click <strong>Sync from Snowflake</strong>.
          This calls <code className="text-xs bg-muted px-1 rounded">api.list_apps()</code> to import all
          registered apps from the Operator into the Gallery.
        </p>
        <p className="text-sm text-muted-foreground ml-9">
          After syncing, you can customize each app&apos;s display name, icon, category, and description
          by clicking <strong>Edit</strong>.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <StepNumber n="2" />
          Launch an App
        </h3>
        <p className="text-sm text-muted-foreground ml-9">
          Go to the <strong>Gallery</strong> page. Click on an app card to launch it.
          The Operator will resume the compute pool and start the service.
          Once the endpoint is ready, click the card again to open the app.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center">
          <StepNumber n="3" />
          Manage Leases
        </h3>
        <p className="text-sm text-muted-foreground ml-9">
          Active leases are shown in the <strong>Leases</strong> page.
          You can extend or stop leases from there. The Operator&apos;s watchdog automatically
          suspends compute pools when leases expire.
        </p>
      </div>

      <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
        <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">After Operator Upgrade</h3>
        <p className="text-sm text-green-700 dark:text-green-300">
          When the Gallery Operator is upgraded, the application role grant may be revoked.
          If the connection test fails after an upgrade, re-run:
        </p>
        <div className="mt-2">
          <CodeBlock>{`GRANT APPLICATION ROLE BLUE_APP_GALLERY.operator_saas
  TO ROLE GALLERY_SAAS_ROLE;`}</CodeBlock>
        </div>
      </div>
    </div>
  );
}

export default function SetupGuidePage() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const renderSection = () => {
    switch (activeSection) {
      case 'overview': return <SectionOverview />;
      case 'snowflake-setup': return <SectionSnowflakeSetup />;
      case 'saas-connection': return <SectionSaaSConnection />;
      case 'sync-launch': return <SectionSyncLaunch />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Setup Guide</h1>
      <p className="text-muted-foreground mb-6">
        Connect your Snowflake account to the App Gallery in 4 steps.
      </p>

      {/* Step navigation */}
      <div className="flex gap-1 mb-8 border rounded-lg p-1 bg-muted/50">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              activeSection === section.id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
              activeSection === section.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted-foreground/20 text-muted-foreground'
            }`}>
              {section.icon}
            </span>
            <span className="hidden sm:inline">{section.label}</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="pb-12">
        {renderSection()}
      </div>
    </div>
  );
}
