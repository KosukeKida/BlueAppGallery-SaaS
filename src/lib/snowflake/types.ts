// =============================================================
// Types for Blue App Gallery Operator API v1.0
//
// All api.* procedures return: { api_version, status, data/error }
// This file defines the unwrapped data types and the wrapper.
// =============================================================

// -- Operator API envelope --

export interface OperatorResponse<T = unknown> {
  api_version: string;
  status: 'OK' | 'ERROR';
  data?: T;
  error?: OperatorError;
}

export interface OperatorError {
  code: string;
  message: string;
  // Additional context fields returned by specific error codes
  resource_name?: string;
  resource_type?: string;
  lease_id?: string;
}

// Known error codes from the Operator
export type OperatorErrorCode =
  | 'APP_NOT_FOUND'
  | 'NO_START_NEEDED'
  | 'LEASE_ALREADY_EXISTS'
  | 'LEASE_NOT_FOUND'
  | 'PERMISSION_NOT_GRANTED'
  | 'START_FAILED'
  | 'EXTEND_FAILED'
  | 'STOP_FAILED';

// -- Resource types --

export type ResourceType = 'COMPUTE_POOL' | 'SERVICE' | 'POSTGRES_INSTANCE';

export interface LeaseResource {
  name: string;
  type: ResourceType;
}

// -- api.get_version() --

export interface VersionData {
  operator_version: string;
  api_version: string;
  min_gallery_version: string;
  product_name: string;
}

// -- api.launch() --

export interface LaunchData {
  action: 'STARTED';
  lease_id: string;
  app_name: string;
  compute_pool: string;
  resource_summary: string;
  resources: LeaseResource[];
  expires_at: string;
  remaining_minutes: number;
  message: string;
  service_warning?: string;
}

// -- api.extend() --

export interface ExtendData {
  action: 'EXTENDED';
  lease_id: string;
  app_name: string;
  compute_pool: string;
  resource_summary: string;
  resources: LeaseResource[];
  expires_at: string;
  remaining_minutes: number;
  message: string;
  service_warning?: string;
}

// -- api.stop() --

export interface StopData {
  action: 'STOPPED';
  lease_id: string;
  app_name: string;
  compute_pool: string;
  message: string;
}

// -- api.get_status() --

// When querying a specific app with an active lease
export interface StatusDataSingle {
  app_name: string;
  lease_id: string;
  lease_status: 'ACTIVE';
  compute_pool: string;
  resource_summary: string;
  resources: LeaseResource[];
  started_at: string;
  expires_at: string;
  remaining_minutes: number;
  initiated_by: string;
  active_user_count: number;
}

// When querying a specific app with no active lease
export interface StatusDataNone {
  app_name: string;
  lease_status: 'NO_ACTIVE_LEASE';
}

// When querying all apps (app_name = NULL)
export interface StatusDataAll {
  active_leases: Array<{
    app_name: string;
    lease_id: string;
    compute_pool: string;
    resource_summary: string;
    expires_at: string;
    remaining_minutes: number;
  }>;
  total_count: number;
}

export type StatusData = StatusDataSingle | StatusDataNone | StatusDataAll;

export function isStatusSingle(data: StatusData): data is StatusDataSingle {
  return 'lease_status' in data && data.lease_status === 'ACTIVE';
}

export function isStatusNone(data: StatusData): data is StatusDataNone {
  return 'lease_status' in data && data.lease_status === 'NO_ACTIVE_LEASE';
}

export function isStatusAll(data: StatusData): data is StatusDataAll {
  return 'active_leases' in data;
}

// -- api.heartbeat() --

export interface HeartbeatData {
  lease_id: string;
  user_name: string;
  heartbeat_at: string;
}

// -- api.list_apps() --

export interface AppInfo {
  app_name: string;
  app_version: string | null;
  app_comment: string | null;
  app_type: 'native_app' | 'streamlit_cp' | 'streamlit_wh';
  compute_pool: string | null;
  service_name: string | null;
  endpoint_url: string | null;
  gallery_compatible: boolean;
  managed_status: string;
  postgres_mode: string;
  registered_at: string;
  registered_by: string;
}

export interface ListAppsData {
  apps: AppInfo[];
  total_count: number;
}

// -- api.get_endpoints() --

export interface EndpointsDataReady {
  app_name: string;
  service_name: string;
  endpoint_status: 'READY';
  ingress_url: string;
  endpoints: Array<{
    name: string;
    port: string;
    protocol: string;
    is_public: string;
    ingress_url: string | null;
  }>;
  endpoint_count: number;
}

export interface EndpointsDataNotReady {
  app_name: string;
  service_name?: string;
  endpoint_status: 'STARTING' | 'NO_SERVICE' | 'PENDING';
  message?: string;
  error?: string;
}

export type EndpointsData = EndpointsDataReady | EndpointsDataNotReady;

export function isEndpointReady(data: EndpointsData): data is EndpointsDataReady {
  return data.endpoint_status === 'READY';
}

// -- Snowflake SQL API raw response --

export interface SqlApiResponse {
  resultSetMetaData: {
    numRows: number;
    format: string;
    rowType: Array<{ name: string; type: string }>;
  };
  data: string[][];
  code: string;
  statementHandle: string;
  statementStatusUrl: string;
  sqlState: string;
  message: string;
}

export interface SqlApiErrorResponse {
  code: string;
  message: string;
  sqlState: string;
  statementHandle: string;
}
