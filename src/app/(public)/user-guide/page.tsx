'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DemoAppCard,
  DemoLeasePanel,
  DemoToast,
  DemoContainer,
} from '@/components/guide/demo-components';

export default function UserGuidePage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">User Guide</h2>
        <p className="text-sm text-muted-foreground">
          How to use App Gallery — launching apps, managing leases, and more.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Need to set up the connection first?{' '}
          <Link href="/setup-guide" className="text-primary hover:underline font-medium">
            ← Setup Guide
          </Link>
        </p>
      </div>

      <div className="space-y-6">
        {/* Gallery */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gallery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              The Gallery shows all available apps as cards. Each card displays the app name,
              category, and current status.
            </p>

            {/* Demo: App Cards Grid */}
            <div className="grid grid-cols-2 gap-3">
              <DemoContainer label="Stopped App">
                <DemoAppCard
                  name="Sales Dashboard"
                  icon="📊"
                  category="Analytics"
                  version="1.2"
                  description="Interactive sales metrics and KPI tracking"
                  state="stopped"
                />
              </DemoContainer>
              <DemoContainer label="Running App">
                <DemoAppCard
                  name="ML Pipeline"
                  icon="🤖"
                  category="AI/ML"
                  version="2.0"
                  description="Machine learning model training platform"
                  state="running"
                  isFavorite
                />
              </DemoContainer>
            </div>

            <h4 className="font-semibold pt-2">App Types</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium">Streamlit on Compute Pool</span> / <span className="font-medium">Native App</span> —
                These apps require a lease to run. Click the <span className="font-medium">Launch</span> button to start.
              </li>
              <li>
                <span className="font-medium">Streamlit on Warehouse (Always On)</span> —
                These apps are always available. Click <span className="font-medium">Open</span> to access directly.
              </li>
            </ul>

            <DemoContainer label="Always On App (no lease required)">
              <DemoAppCard
                name="Quick Reports"
                icon="📋"
                category="Tools"
                version="1.0"
                description="Serverless reporting tool"
                state="always-on"
              />
            </DemoContainer>
          </CardContent>
        </Card>

        {/* Launching Apps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Launching Apps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              When you launch an app, the system starts the required compute resources in Snowflake.
              A progress indicator appears on the card during startup.
            </p>

            <DemoContainer label="App Starting (progress indicator)">
              <DemoAppCard
                name="Data Pipeline"
                icon="🔄"
                category="Operations"
                version="3.1"
                description="ETL and data transformation workflows"
                state="starting"
                progress={65}
              />
            </DemoContainer>

            <ul className="list-disc pl-5 space-y-1">
              <li>Default lease duration is 60 minutes.</li>
              <li>Once running, click the card to open the management panel.</li>
              <li>The app endpoint URL becomes available after launch — click to open it in a new tab.</li>
            </ul>
            <div className="bg-muted rounded-lg p-3 text-xs">
              <span className="font-semibold">Note:</span> It may take 1-3 minutes for the app to become fully accessible
              after launch, depending on the compute pool warm-up time.
            </div>
          </CardContent>
        </Card>

        {/* Lease Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lease Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              A lease reserves compute resources for a set duration. When the lease expires,
              resources are automatically stopped to save costs.
            </p>

            <DemoContainer label="Lease Management Panel (shown when you click a running app)">
              <DemoLeasePanel
                timeRemaining="42m 15s remaining"
                startedAt="4/5/2026, 10:30:00 AM"
              />
            </DemoContainer>

            <h4 className="font-semibold">Extending a Lease</h4>
            <p>
              Click a running app card to open the management panel. Use the extend buttons
              (+30m, +1h, +2h) to add time before the lease expires.
            </p>

            <h4 className="font-semibold">Stopping a Lease</h4>
            <p>
              Click <span className="font-medium">Stop App</span> in the management panel to immediately
              stop the app and release compute resources. You will be asked to confirm before stopping.
            </p>

            <DemoContainer label="Stop Confirmation">
              <DemoLeasePanel
                timeRemaining="42m 15s remaining"
                startedAt="4/5/2026, 10:30:00 AM"
                showStopConfirm
              />
            </DemoContainer>

            <h4 className="font-semibold">Automatic Expiry</h4>
            <p>
              When a lease expires, the system automatically suspends compute resources. You will
              receive toast notifications at 5 minutes and 1 minute before expiry.
            </p>

            <div className="space-y-2">
              <DemoContainer label="5 minutes before expiry">
                <DemoToast message="ML Pipeline lease expires in 5 minutes" variant="warning" />
              </DemoContainer>
              <DemoContainer label="1 minute before expiry">
                <DemoToast message="ML Pipeline lease expires in 1 minute!" variant="destructive" />
              </DemoContainer>
            </div>

            <div className="bg-muted rounded-lg p-3 text-xs">
              <span className="font-semibold">Note:</span> The automatic stop is handled by a background
              task (Watchdog) that runs every 5 minutes. This means the app may continue running for
              up to 5 minutes after the lease expires. For immediate stop, use the{' '}
              <span className="font-medium">Stop</span> button.
            </div>

            <h4 className="font-semibold">Countdown Timer</h4>
            <p>
              The management panel shows a real-time countdown of remaining lease time,
              calculated on the client side for accuracy.
            </p>
          </CardContent>
        </Card>

        {/* Leases Page */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Leases Page</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              The Leases page shows all your active and past leases. You can see which apps
              are currently running, when they were started, and when they expire.
            </p>
          </CardContent>
        </Card>

        {/* Usage Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usage Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              View usage analytics for your organization — total usage hours, active users,
              popular apps, and usage trends over time.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Click an app in the ranking chart to filter the trend and heatmap.</li>
              <li>Switch between metrics: Usage Hours, Launches, Unique Users, and Average Duration.</li>
              <li>Export data as CSV for further analysis.</li>
            </ul>
          </CardContent>
        </Card>

        {/* Scheduled Start/Stop */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scheduled Start/Stop</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Organization admins can configure automated schedules to start and stop apps
              at specific times (e.g., Mon-Fri 9:00-18:00).
            </p>
            <div className="bg-muted rounded-lg p-3 text-xs">
              <span className="font-semibold">Important:</span> When a scheduled stop time arrives,
              <span className="font-medium"> all active leases for that app are stopped</span> — including
              manually started ones. This ensures compute costs stay within the organization&apos;s policy.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
