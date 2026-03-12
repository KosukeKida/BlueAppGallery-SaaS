'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const WIZARD_DISMISSED_KEY = 'setup_wizard_dismissed';

interface SetupWizardProps {
  hasConnections: boolean;
  hasCatalog: boolean;
}

type Step = 'welcome' | 'connection' | 'catalog' | 'done';

export function SetupWizard({ hasConnections, hasCatalog }: SetupWizardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('welcome');

  useEffect(() => {
    // Don't show if already dismissed or fully setup
    if (hasConnections && hasCatalog) return;

    try {
      const dismissed = localStorage.getItem(WIZARD_DISMISSED_KEY);
      if (dismissed) return;
    } catch {
      // localStorage not available
    }

    // Determine starting step
    if (!hasConnections) {
      setCurrentStep('welcome');
    } else if (!hasCatalog) {
      setCurrentStep('catalog');
    }
    setOpen(true);
  }, [hasConnections, hasCatalog]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(WIZARD_DISMISSED_KEY, 'true');
    } catch {
      // Ignore
    }
    setOpen(false);
  };

  const steps: Record<Step, { title: string; description: string; action: string; onAction: () => void }> = {
    welcome: {
      title: 'Welcome to App Gallery!',
      description: 'Let\'s get started by connecting your Snowflake account. This will allow you to manage and launch your Native Apps from the gallery.',
      action: 'Set Up Connection',
      onAction: () => {
        setOpen(false);
        router.push('/settings/connections');
      },
    },
    connection: {
      title: 'Connect to Snowflake',
      description: 'Add your Snowflake connection details including the account identifier, username, and private key for JWT authentication.',
      action: 'Go to Connections',
      onAction: () => {
        setOpen(false);
        router.push('/settings/connections');
      },
    },
    catalog: {
      title: 'Sync Your App Catalog',
      description: 'Great, your Snowflake connection is ready! Now sync your app catalog to discover the Native Apps installed in your account.',
      action: 'Go to Catalog',
      onAction: () => {
        setOpen(false);
        router.push('/settings/catalog');
      },
    },
    done: {
      title: 'You\'re All Set!',
      description: 'Your app catalog is synced. Click on any app in the gallery to launch it.',
      action: 'Start Exploring',
      onAction: () => {
        handleDismiss();
      },
    },
  };

  const step = steps[currentStep];
  const stepNumber = currentStep === 'welcome' || currentStep === 'connection' ? 1
    : currentStep === 'catalog' ? 2 : 3;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`w-8 h-1 rounded-full ${
                  n <= stepNumber ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <DialogTitle>{step.title}</DialogTitle>
          <DialogDescription>{step.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleDismiss}>
            Skip
          </Button>
          <Button onClick={step.onAction}>
            {step.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
