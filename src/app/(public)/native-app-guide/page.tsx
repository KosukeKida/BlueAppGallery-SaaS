'use client';

import { useState } from 'react';

type Tab = 'installation' | 'developers' | 'troubleshooting';

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'installation', label: 'Installation', icon: '📦' },
  { id: 'developers', label: 'For Developers', icon: '🛠️' },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: '🔧' },
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

function Divider() {
  return <hr className="my-10 border-border" />;
}

// =============================================================================
// Installation Tab
// =============================================================================
function TabInstallation() {
  return (
    <div className="space-y-6">
      {/* Overview */}
      <div>
        <h2 className="text-2xl font-bold mb-4">What is Blue App Gallery?</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Blue App Gallery is a free Snowflake Native App that manages the compute lifecycle of your
          Snowflake applications. It provides centralized start/stop control, automatic shutdown via
          configurable timeouts (leases), and a built-in dashboard for monitoring.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          The Operator works as a <strong>standalone product</strong> — no external services required.
          It also exposes a documented API layer for integration with external tools and automation scripts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="border rounded-lg p-4">
          <div className="text-2xl mb-2">🚀</div>
          <h3 className="font-semibold mb-1">Start/Stop Control</h3>
          <p className="text-sm text-muted-foreground">
            Resume and suspend Compute Pools and Services with a single click or API call.
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl mb-2">⏱️</div>
          <h3 className="font-semibold mb-1">Lease Management</h3>
          <p className="text-sm text-muted-foreground">
            Time-boxed sessions automatically stop resources when the lease expires.
          </p>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl mb-2">🔌</div>
          <h3 className="font-semibold mb-1">Public API</h3>
          <p className="text-sm text-muted-foreground">
            Documented SQL procedures for automation, CI/CD, or third-party integration.
          </p>
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">App Types Supported</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-blue-700 dark:text-blue-300">
                <th className="pr-4 py-1">Type</th>
                <th className="pr-4 py-1">Description</th>
                <th className="pr-4 py-1">Lifecycle</th>
              </tr>
            </thead>
            <tbody className="text-blue-600 dark:text-blue-400">
              <tr>
                <td className="pr-4 py-1 font-mono text-xs">native_app</td>
                <td className="pr-4 py-1">Snowflake Native App with SPCS</td>
                <td className="pr-4 py-1">CP + SERVICE resume/suspend</td>
              </tr>
              <tr>
                <td className="pr-4 py-1 font-mono text-xs">streamlit_cp</td>
                <td className="pr-4 py-1">Streamlit on Container Runtime</td>
                <td className="pr-4 py-1">CP resume/suspend only</td>
              </tr>
              <tr>
                <td className="pr-4 py-1 font-mono text-xs">streamlit_wh</td>
                <td className="pr-4 py-1">Streamlit on Warehouse</td>
                <td className="pr-4 py-1">Always available (no start/stop)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Divider />

      {/* Installation Steps */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Installation</h2>
        <p className="text-muted-foreground mb-6">
          Blue App Gallery is available for free on the Snowflake Marketplace. Installation takes about 5 minutes.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Step 1: Install from Marketplace</h3>
        <p className="text-sm text-muted-foreground">
          Search for &quot;Blue App Gallery&quot; in the Snowflake Marketplace and click <strong>Get</strong>.
          Accept the terms and install to your account.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Step 2: Run the Setup Notebook</h3>
        <p className="text-sm text-muted-foreground mb-3">
          The Marketplace listing includes a Setup Notebook. Open it and run each cell with the <code className="text-xs bg-muted px-1 rounded">ACCOUNTADMIN</code> role.
          This creates the App Registry database and Discovery procedure.
        </p>
        <p className="text-sm text-muted-foreground mb-3">
          Alternatively, copy and run the following SQL in a Snowsight worksheet:
        </p>
        <CodeBlock>{`USE ROLE ACCOUNTADMIN;

-- 1. Create App Registry Database
CREATE DATABASE IF NOT EXISTS BLUE_APP_GALLERY_REGISTRY;
CREATE SCHEMA IF NOT EXISTS BLUE_APP_GALLERY_REGISTRY.PUBLIC;

-- 2. Register Operator
CREATE TABLE IF NOT EXISTS BLUE_APP_GALLERY_REGISTRY.PUBLIC.OPERATOR (
    app_name VARCHAR DEFAULT 'BLUE_APP_GALLERY'
);
MERGE INTO BLUE_APP_GALLERY_REGISTRY.PUBLIC.OPERATOR t
USING (SELECT 'BLUE_APP_GALLERY' AS app_name) s
ON t.app_name = s.app_name
WHEN NOT MATCHED THEN INSERT (app_name) VALUES (s.app_name);

-- 3. Create Discovery Procedure
-- (See Setup Notebook for full procedure code)

-- 4. Grant Permissions to Operator
GRANT USAGE ON DATABASE BLUE_APP_GALLERY_REGISTRY TO APPLICATION BLUE_APP_GALLERY;
GRANT USAGE ON SCHEMA BLUE_APP_GALLERY_REGISTRY.PUBLIC TO APPLICATION BLUE_APP_GALLERY;
GRANT SELECT ON TABLE BLUE_APP_GALLERY_REGISTRY.PUBLIC.OPERATOR TO APPLICATION BLUE_APP_GALLERY;
GRANT USAGE ON PROCEDURE BLUE_APP_GALLERY_REGISTRY.PUBLIC.DISCOVER_APPS()
    TO APPLICATION BLUE_APP_GALLERY;`}</CodeBlock>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Step 3: Discover and Register Apps</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Open the Blue App Gallery dashboard (Streamlit UI)</li>
          <li>Go to the <strong>Operator</strong> page</li>
          <li>Click <strong>Discover Apps</strong> — your apps will appear</li>
          <li>Click <strong>Add</strong> next to each app you want to manage</li>
          <li>Copy and run the displayed <strong>GRANT</strong> statements in Snowsight</li>
          <li>Click <strong>Validate</strong> to confirm permissions</li>
        </ol>
      </div>

      <Divider />

      {/* Managing Apps */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Managing Apps</h2>
        <p className="text-muted-foreground mb-6">
          Use the Operator page to discover, register, and configure apps for lifecycle management.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">App Discovery</h3>
        <p className="text-sm text-muted-foreground">
          Click <strong>Discover Apps</strong> to scan your account for Native Apps and Streamlit apps.
          The discovery procedure detects:
        </p>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mt-2">
          <li>Native Apps with SPCS services</li>
          <li>Standalone Streamlit apps (Container Runtime or Warehouse)</li>
          <li>Compute Pools and their current state</li>
          <li>Whether apps implement Gallery Compatible procedures</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Adding an App to Management</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>Click <strong>Add</strong> next to a discovered app</li>
          <li>The app moves to the &quot;Managed Apps&quot; section</li>
          <li>Required GRANT statements are displayed — run these as ACCOUNTADMIN</li>
          <li>Click <strong>Validate</strong> to verify permissions</li>
        </ol>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Changing App Type</h3>
        <p className="text-sm text-muted-foreground">
          Expand a managed app and use the <strong>app_type</strong> selector to change between
          <code className="text-xs bg-muted px-1 rounded mx-1">native_app</code>,
          <code className="text-xs bg-muted px-1 rounded mx-1">streamlit_cp</code>, and
          <code className="text-xs bg-muted px-1 rounded mx-1">streamlit_wh</code>.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Required Permissions</h3>
        <p className="text-sm text-muted-foreground mb-3">
          The Operator generates GRANT statements automatically. Typical permissions include:
        </p>
        <CodeBlock>{`-- Compute Pool management
GRANT OPERATE ON COMPUTE POOL <compute_pool_name> TO APPLICATION BLUE_APP_GALLERY;
GRANT MONITOR ON COMPUTE POOL <compute_pool_name> TO APPLICATION BLUE_APP_GALLERY;

-- Postgres Instance (if configured)
GRANT OPERATE ON POSTGRES INSTANCE <instance_name> TO APPLICATION BLUE_APP_GALLERY;

-- Gallery Compatible apps (for resume_service() calls)
GRANT APPLICATION ROLE <APP_NAME>.APP_ADMIN TO APPLICATION BLUE_APP_GALLERY;`}</CodeBlock>
      </div>

      <Divider />

      {/* Watchdog */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Watchdog Task</h2>
        <p className="text-muted-foreground mb-4">
          The Watchdog is a background task that automatically manages resource lifecycle.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">What It Does</h3>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li>
            <strong>Lease Expiration:</strong> Every 5 minutes, checks for expired leases and suspends
            the associated Compute Pools (and Postgres Instances if configured).
          </li>
          <li>
            <strong>Leaseless Detection:</strong> For <code className="text-xs bg-muted px-1 rounded">streamlit_cp</code> apps,
            detects when a Compute Pool is running without an active lease and auto-stops it after a 1-hour grace period.
          </li>
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Enabling the Watchdog</h3>
        <p className="text-sm text-muted-foreground mb-3">
          <strong>Step 1:</strong> Grant the required privilege:
        </p>
        <CodeBlock>{`USE ROLE ACCOUNTADMIN;
GRANT EXECUTE MANAGED TASK ON ACCOUNT TO APPLICATION BLUE_APP_GALLERY;`}</CodeBlock>
        <p className="text-sm text-muted-foreground">
          <strong>Step 2:</strong> Go to the <strong>Operator</strong> page and click <strong>Enable Watchdog</strong>.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Cost Estimate</h3>
        <p className="text-sm text-muted-foreground mb-3">
          The Watchdog runs as a <strong>Snowflake Managed Task</strong> (serverless):
        </p>
        <div className="border rounded-lg p-4 bg-muted/50">
          <ul className="text-sm space-y-1">
            <li><strong>Frequency:</strong> Every 5 minutes (8,640 executions/month)</li>
            <li><strong>Duration:</strong> Typically 1-3 seconds per execution</li>
            <li><strong>Warehouse Size:</strong> XSMALL (serverless managed)</li>
          </ul>
          <p className="text-sm mt-3">
            <strong>Estimated monthly cost:</strong> $10-30 USD depending on execution time and number of managed apps.
          </p>
        </div>
        <p className="text-sm text-muted-foreground mt-3">
          <strong>Trade-off:</strong> With 5-minute intervals, expired leases may run up to 5 extra minutes
          before being stopped. This is more cost-effective than 1-minute intervals for most use cases.
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// For Developers Tab
// =============================================================================
function TabDevelopers() {
  return (
    <div className="space-y-6">
      {/* Gallery Compatible Apps */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Gallery Compatible Apps</h2>
        <p className="text-muted-foreground mb-4">
          Gallery Compatible apps implement specific procedures that allow Blue App Gallery
          to manage their SERVICE lifecycle directly.
        </p>
      </div>

      <div className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
        <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">For Native App Developers</h3>
        <p className="text-sm text-amber-700 dark:text-amber-300">
          This section is for developers who want their Native App to be fully compatible with
          Blue App Gallery&apos;s lifecycle management.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Requirements</h3>
        <p className="text-sm text-muted-foreground">
          Your Native App must implement the following procedure in the <code className="text-xs bg-muted px-1 rounded">app_setup</code> schema:
        </p>
        <CodeBlock>{`-- Resume the app's service (called by Operator on start)
CREATE OR REPLACE PROCEDURE app_setup.resume_service()
RETURNS VARCHAR
LANGUAGE SQL
EXECUTE AS OWNER
AS
$$
BEGIN
    -- Your service resume logic here
    ALTER SERVICE IF EXISTS <schema>.<service_name> RESUME;
    RETURN 'OK';
END;
$$;

-- Grant to app_admin role (required for Operator access)
GRANT USAGE ON PROCEDURE app_setup.resume_service()
    TO APPLICATION ROLE app_admin;`}</CodeBlock>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">How It Works</h3>
        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
          <li>When the Operator starts a Gallery Compatible <code className="text-xs bg-muted px-1 rounded">native_app</code>, it first resumes the Compute Pool</li>
          <li>Then it calls <code className="text-xs bg-muted px-1 rounded">&lt;app_name&gt;.app_setup.resume_service()</code></li>
          <li>When stopping, the Operator suspends the Compute Pool, which implicitly stops all services</li>
          <li>No <code className="text-xs bg-muted px-1 rounded">suspend_service()</code> is needed — Pool suspend handles it</li>
        </ol>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Detection</h3>
        <p className="text-sm text-muted-foreground">
          The <code className="text-xs bg-muted px-1 rounded">gallery_compatible</code> flag is automatically detected during
          discovery by checking for the <code className="text-xs bg-muted px-1 rounded">app_setup.resume_service</code> procedure.
          You can also manually toggle it in the Operator UI.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Granting Access</h3>
        <p className="text-sm text-muted-foreground mb-3">
          For the Operator to call your app&apos;s <code className="text-xs bg-muted px-1 rounded">resume_service()</code>,
          you must grant the <code className="text-xs bg-muted px-1 rounded">app_admin</code> role:
        </p>
        <CodeBlock>{`USE ROLE ACCOUNTADMIN;

GRANT APPLICATION ROLE <YOUR_APP>.APP_ADMIN
    TO APPLICATION BLUE_APP_GALLERY;`}</CodeBlock>
      </div>

      <Divider />

      {/* API Reference */}
      <div>
        <h2 className="text-2xl font-bold mb-4">API Reference</h2>
        <p className="text-muted-foreground mb-4">
          Blue App Gallery exposes a public API via the <code className="text-xs bg-muted px-1 rounded">api</code> schema.
          These procedures can be called by any user/role granted the <code className="text-xs bg-muted px-1 rounded">operator_api</code> application role.
        </p>
        <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">For Third-Party Integrations</h4>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Use this API to build custom dashboards, automation scripts, or integrate with your existing tools.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Access Setup</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Create a dedicated role and user for API access:
        </p>
        <CodeBlock>{`USE ROLE ACCOUNTADMIN;

-- Create API role
CREATE ROLE IF NOT EXISTS MY_GALLERY_API_ROLE;

-- Grant operator_api application role
GRANT APPLICATION ROLE BLUE_APP_GALLERY.operator_api
    TO ROLE MY_GALLERY_API_ROLE;

-- Grant warehouse for SQL execution
GRANT USAGE ON WAREHOUSE COMPUTE_WH
    TO ROLE MY_GALLERY_API_ROLE;`}</CodeBlock>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Response Format</h3>
        <p className="text-sm text-muted-foreground mb-3">
          All API procedures return a VARIANT with a consistent structure:
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Success Response</p>
            <CodeBlock>{`{
  "api_version": "1.0",
  "status": "OK",
  "data": { ... }
}`}</CodeBlock>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Error Response</p>
            <CodeBlock>{`{
  "api_version": "1.0",
  "status": "ERROR",
  "error": {
    "code": "LEASE_NOT_FOUND",
    "message": "..."
  }
}`}</CodeBlock>
          </div>
        </div>
      </div>

      {/* API Procedures */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Procedures</h3>
      </div>

      {/* api.get_version */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold font-mono text-primary">api.get_version()</h4>
        <p className="text-sm text-muted-foreground">
          Returns the Operator version and API compatibility information.
        </p>
        <CodeBlock>{`CALL BLUE_APP_GALLERY.api.get_version();`}</CodeBlock>
        <p className="text-xs text-muted-foreground">Returns: <code>operator_version</code>, <code>api_version</code>, <code>min_compatible_api</code></p>
      </div>

      {/* api.launch */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold font-mono text-primary">api.launch(app_name, duration_minutes, user_name)</h4>
        <p className="text-sm text-muted-foreground">
          Starts an app by resuming its Compute Pool and (for Gallery Compatible apps) calling resume_service().
          Creates a lease that automatically expires after the specified duration.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="pr-4 py-2">Parameter</th>
                <th className="pr-4 py-2">Type</th>
                <th className="pr-4 py-2">Default</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b">
                <td className="pr-4 py-2 font-mono text-xs">app_name</td>
                <td className="pr-4 py-2">VARCHAR</td>
                <td className="pr-4 py-2">—</td>
                <td className="py-2">Name of the managed app</td>
              </tr>
              <tr className="border-b">
                <td className="pr-4 py-2 font-mono text-xs">duration_minutes</td>
                <td className="pr-4 py-2">INTEGER</td>
                <td className="pr-4 py-2">60</td>
                <td className="py-2">Lease duration in minutes</td>
              </tr>
              <tr>
                <td className="pr-4 py-2 font-mono text-xs">user_name</td>
                <td className="pr-4 py-2">VARCHAR</td>
                <td className="pr-4 py-2">NULL</td>
                <td className="py-2">Identifier for audit logging</td>
              </tr>
            </tbody>
          </table>
        </div>
        <CodeBlock>{`CALL BLUE_APP_GALLERY.api.launch('MY_APP', 60, 'user@example.com');`}</CodeBlock>
        <p className="text-xs text-muted-foreground">Returns: <code>lease_id</code>, <code>lease_expires_at</code>, <code>endpoint_url</code></p>
      </div>

      {/* api.extend */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold font-mono text-primary">api.extend(lease_id, duration_minutes, user_name)</h4>
        <p className="text-sm text-muted-foreground">
          Extends an existing lease by the specified duration. Also ensures resources are resumed.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="pr-4 py-2">Parameter</th>
                <th className="pr-4 py-2">Type</th>
                <th className="pr-4 py-2">Default</th>
                <th className="py-2">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b">
                <td className="pr-4 py-2 font-mono text-xs">lease_id</td>
                <td className="pr-4 py-2">VARCHAR</td>
                <td className="pr-4 py-2">—</td>
                <td className="py-2">UUID of the lease</td>
              </tr>
              <tr className="border-b">
                <td className="pr-4 py-2 font-mono text-xs">duration_minutes</td>
                <td className="pr-4 py-2">INTEGER</td>
                <td className="pr-4 py-2">60</td>
                <td className="py-2">Additional minutes</td>
              </tr>
              <tr>
                <td className="pr-4 py-2 font-mono text-xs">user_name</td>
                <td className="pr-4 py-2">VARCHAR</td>
                <td className="pr-4 py-2">NULL</td>
                <td className="py-2">Identifier for audit</td>
              </tr>
            </tbody>
          </table>
        </div>
        <CodeBlock>{`CALL BLUE_APP_GALLERY.api.extend('abc12345-...', 30, 'user@example.com');`}</CodeBlock>
      </div>

      {/* api.stop */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold font-mono text-primary">api.stop(lease_id)</h4>
        <p className="text-sm text-muted-foreground">
          Stops a lease immediately. Suspends the Compute Pool if no other active leases exist.
        </p>
        <CodeBlock>{`CALL BLUE_APP_GALLERY.api.stop('abc12345-...');`}</CodeBlock>
      </div>

      {/* api.get_status */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold font-mono text-primary">api.get_status(app_name)</h4>
        <p className="text-sm text-muted-foreground">
          Returns the status of a specific app or all apps with active leases. Pass NULL for all apps.
        </p>
        <CodeBlock>{`-- All apps with active leases
CALL BLUE_APP_GALLERY.api.get_status();

-- Specific app
CALL BLUE_APP_GALLERY.api.get_status('MY_APP');`}</CodeBlock>
      </div>

      {/* api.list_apps */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold font-mono text-primary">api.list_apps()</h4>
        <p className="text-sm text-muted-foreground">
          Returns all managed apps with catalog information.
        </p>
        <CodeBlock>{`CALL BLUE_APP_GALLERY.api.list_apps();`}</CodeBlock>
        <p className="text-xs text-muted-foreground">Returns: <code>app_name</code>, <code>app_type</code>, <code>compute_pool</code>, <code>endpoint_url</code>, <code>gallery_compatible</code>, etc.</p>
      </div>

      {/* api.get_endpoints */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold font-mono text-primary">api.get_endpoints(app_name)</h4>
        <p className="text-sm text-muted-foreground">
          Discovers endpoint URLs dynamically via <code className="text-xs bg-muted px-1 rounded">SHOW ENDPOINTS IN SERVICE</code>.
        </p>
        <CodeBlock>{`CALL BLUE_APP_GALLERY.api.get_endpoints('MY_APP');`}</CodeBlock>
      </div>

      {/* api.heartbeat */}
      <div className="border rounded-lg p-4 space-y-3">
        <h4 className="font-semibold font-mono text-primary">api.heartbeat(lease_id, user_name)</h4>
        <p className="text-sm text-muted-foreground">
          Records a heartbeat for session tracking.
        </p>
        <CodeBlock>{`CALL BLUE_APP_GALLERY.api.heartbeat('abc12345-...', 'user@example.com');`}</CodeBlock>
      </div>

      {/* Error Codes */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Error Codes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-muted">
              <tr className="text-left">
                <th className="px-4 py-2">Code</th>
                <th className="px-4 py-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-4 py-2 font-mono text-xs">APP_NOT_FOUND</td>
                <td className="px-4 py-2 text-muted-foreground">App is not registered as managed</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">LEASE_NOT_FOUND</td>
                <td className="px-4 py-2 text-muted-foreground">Lease ID does not exist</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">LEASE_ALREADY_EXISTS</td>
                <td className="px-4 py-2 text-muted-foreground">Active lease exists — use extend()</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">NO_COMPUTE_POOL</td>
                <td className="px-4 py-2 text-muted-foreground">App has no Compute Pool</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">PERMISSION_DENIED</td>
                <td className="px-4 py-2 text-muted-foreground">Missing GRANT permissions</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-mono text-xs">NO_START_NEEDED</td>
                <td className="px-4 py-2 text-muted-foreground">App is streamlit_wh (always on)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Troubleshooting Tab
// =============================================================================
function TabTroubleshooting() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Troubleshooting</h2>
        <p className="text-muted-foreground mb-6">
          Common issues and their solutions.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">&quot;App not found or no compute pool&quot;</h3>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>Ensure the app is registered as managed (Operator → Add)</li>
          <li>Verify the Compute Pool name is correct in the app catalog</li>
          <li>Click <strong>Discover Apps</strong> again to refresh infrastructure data</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">&quot;Permission denied&quot; on Start/Stop</h3>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>GRANTs have not been applied — check the Operator page for pending GRANT statements</li>
          <li>Run the required GRANT SQL with <code className="text-xs bg-muted px-1 rounded">ACCOUNTADMIN</code> role</li>
          <li>Use <strong>Validate</strong> to confirm all permissions are in place</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Watchdog not running</h3>
        <p className="text-sm text-muted-foreground mb-2">
          Grant the required privilege and enable:
        </p>
        <CodeBlock>{`USE ROLE ACCOUNTADMIN;
GRANT EXECUTE MANAGED TASK ON ACCOUNT TO APPLICATION BLUE_APP_GALLERY;`}</CodeBlock>
        <p className="text-sm text-muted-foreground mt-2">
          Then go to the Operator page and click <strong>Enable Watchdog</strong>.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Endpoint URL not showing</h3>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li><strong>native_app:</strong> Endpoint is discovered via <code className="text-xs bg-muted px-1 rounded">SHOW ENDPOINTS IN SERVICE</code>. Ensure the service is running and has a public endpoint.</li>
          <li><strong>streamlit_cp / streamlit_wh:</strong> Set the endpoint_url manually in the Operator management interface.</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Service fails to resume</h3>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>Check that the app implements <code className="text-xs bg-muted px-1 rounded">app_setup.resume_service()</code></li>
          <li>Verify the app is marked as <strong>Gallery Compatible</strong></li>
          <li>Check the Audit Log for error details</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">&quot;Compute Pool is in IDLE state&quot;</h3>
        <p className="text-sm text-muted-foreground">
          The Compute Pool may take 1-3 minutes to transition from IDLE to ACTIVE after a RESUME command.
          The app endpoint will become available once the pool is fully active.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Discovery shows no apps</h3>
        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
          <li>Ensure you have run the Setup Notebook to create the Discovery procedure</li>
          <li>Check that the GRANT statements were applied to the Operator</li>
          <li>Verify your Native Apps and Streamlit apps exist in the account</li>
        </ul>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">After Operator Upgrade</h3>
        <p className="text-sm text-muted-foreground">
          When the Operator is upgraded, application role grants may be revoked. Re-run:
        </p>
        <CodeBlock>{`USE ROLE ACCOUNTADMIN;

-- Re-grant API access
GRANT APPLICATION ROLE BLUE_APP_GALLERY.operator_api
    TO ROLE <YOUR_API_ROLE>;

-- Re-grant for Gallery Compatible apps
GRANT APPLICATION ROLE <YOUR_APP>.APP_ADMIN
    TO APPLICATION BLUE_APP_GALLERY;`}</CodeBlock>
      </div>

      <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
        <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Getting Support</h3>
        <ul className="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
          <li>Check the Audit Log page for detailed error information</li>
          <li>Review the GRANT permissions using the Validate function</li>
          <li>Ensure you are using the latest version of the Operator</li>
        </ul>
      </div>
    </div>
  );
}

// =============================================================================
// Main Page
// =============================================================================
export default function NativeAppGuidePage() {
  const [activeTab, setActiveTab] = useState<Tab>('installation');

  const renderTab = () => {
    switch (activeTab) {
      case 'installation': return <TabInstallation />;
      case 'developers': return <TabDevelopers />;
      case 'troubleshooting': return <TabTroubleshooting />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Blue App Gallery — Native App Guide</h1>
      <p className="text-muted-foreground mb-6">
        Complete documentation for the Snowflake Native App Operator.
      </p>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-8 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pb-12">
        {renderTab()}
      </div>
    </div>
  );
}
