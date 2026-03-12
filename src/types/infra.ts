import type { AppCatalogItem } from '@/components/gallery/app-card';

export interface ComputePoolInfo {
  name: string;
  size: string;
  isRunning: boolean;
  apps: AppCatalogItem[];
}

export interface ServiceInfo {
  name: string;
  isRunning: boolean;
  apps: AppCatalogItem[];
}

export interface PostgresInstanceInfo {
  name: string;
  apps: AppCatalogItem[];
}
