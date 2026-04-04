import { generateSnowflakeJwt } from './jwt';
import type {
  OperatorResponse,
  VersionData,
  LaunchData,
  ExtendData,
  StopData,
  StatusData,
  HeartbeatData,
  ListAppsData,
  EndpointsData,
  SqlApiResponse,
} from './types';

export interface SnowflakeClientConfig {
  accountIdentifier: string;
  accountLocator: string;
  username: string;
  privateKeyPem: string;
  database?: string;
  role?: string;
  warehouse?: string;
}

/**
 * Snowflake SQL API client for Blue App Gallery Operator.
 *
 * All procedures are called via the `api` schema:
 *   CALL {database}.api.{procedure}(args)
 *
 * All responses follow the Operator envelope:
 *   { api_version: "1.0", status: "OK"|"ERROR", data?: T, error?: {...} }
 */
export class SnowflakeSqlApiClient {
  private config: Required<Omit<SnowflakeClientConfig, 'warehouse'>> & { warehouse: string | null };

  constructor(config: SnowflakeClientConfig) {
    this.config = {
      accountIdentifier: config.accountIdentifier,
      accountLocator: config.accountLocator,
      username: config.username,
      privateKeyPem: config.privateKeyPem,
      database: config.database ?? 'BLUE_APP_GALLERY',
      role: config.role ?? 'BLUE_APP_GALLERY_API_ROLE',
      warehouse: config.warehouse ?? null,
    };
  }

  // ============================================================
  // Low-level SQL API communication
  // ============================================================

  private async executeStatement(sql: string): Promise<SqlApiResponse> {
    const jwt = await generateSnowflakeJwt({
      accountIdentifier: this.config.accountIdentifier,
      accountLocator: this.config.accountLocator,
      username: this.config.username,
      privateKeyPem: this.config.privateKeyPem,
    });

    const accountUrl = this.config.accountIdentifier.toLowerCase();
    const url = `https://${accountUrl}.snowflakecomputing.com/api/v2/statements`;

    const body: Record<string, unknown> = {
      statement: sql,
      timeout: 120,
      database: this.config.database,
      role: this.config.role,
    };
    if (this.config.warehouse) {
      body.warehouse = this.config.warehouse;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`,
        'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Handle 202 Accepted (async query)
    if (response.status === 202) {
      const asyncResult = await response.json() as { statementStatusUrl: string; statementHandle: string };
      return this.pollForResult(asyncResult.statementStatusUrl, jwt);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Snowflake SQL API error (${response.status}): ${errorBody}`);
    }

    return response.json() as Promise<SqlApiResponse>;
  }

  private async pollForResult(statusUrl: string, jwt: string, maxAttempts = 60): Promise<SqlApiResponse> {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await fetch(statusUrl, {
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'X-Snowflake-Authorization-Token-Type': 'KEYPAIR_JWT',
          'Accept': 'application/json',
        },
      });

      if (response.status === 202) continue;

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Snowflake poll error (${response.status}): ${errorBody}`);
      }

      return response.json() as Promise<SqlApiResponse>;
    }

    throw new Error('Snowflake query timed out after polling');
  }

  // ============================================================
  // Operator API call helper
  // ============================================================

  /**
   * Call an api.* procedure and return the parsed OperatorResponse.
   *
   * All api.* procedures return VARIANT with structure:
   *   { api_version, status, data?, error? }
   */
  private async callApi<T>(
    procedure: string,
    args: (string | number | null)[] = []
  ): Promise<OperatorResponse<T>> {
    const formattedArgs = args.map(arg => {
      if (arg === null) return 'NULL';
      if (typeof arg === 'number') return String(arg);
      const escaped = String(arg).replace(/'/g, "''");
      return `'${escaped}'`;
    }).join(', ');

    const sql = `CALL ${this.config.database}.api.${procedure}(${formattedArgs})`;
    const result = await this.executeStatement(sql);

    if (!result.data || result.data.length === 0) {
      throw new Error(`No result from api.${procedure}`);
    }

    return JSON.parse(result.data[0][0]) as OperatorResponse<T>;
  }

  /**
   * Call an api.* procedure and unwrap the response.
   * Throws if status is ERROR.
   */
  private async callApiUnwrap<T>(
    procedure: string,
    args: (string | number | null)[] = []
  ): Promise<T> {
    const response = await this.callApi<T>(procedure, args);

    if (response.status === 'ERROR') {
      const err = response.error;
      const error = new OperatorApiError(
        err?.message ?? `api.${procedure} returned ERROR`,
        err?.code ?? 'UNKNOWN',
        err ? { ...err } : undefined
      );
      throw error;
    }

    return response.data as T;
  }

  // ============================================================
  // High-level API methods
  // ============================================================

  /** api.get_version() — Get Operator version and compatibility info */
  async getVersion(): Promise<OperatorResponse<VersionData>> {
    return this.callApi<VersionData>('get_version');
  }

  /** api.launch(app_name, duration_minutes, user_name) — Launch an app */
  async launchApp(
    appName: string,
    durationMinutes = 60,
    userName: string | null = null
  ): Promise<OperatorResponse<LaunchData>> {
    return this.callApi<LaunchData>('launch', [appName, durationMinutes, userName]);
  }

  /** api.extend(lease_id, duration_minutes, user_name) — Extend a lease */
  async extendLease(
    leaseId: string,
    durationMinutes = 30,
    userName: string | null = null
  ): Promise<OperatorResponse<ExtendData>> {
    return this.callApi<ExtendData>('extend', [leaseId, durationMinutes, userName]);
  }

  /** api.stop(lease_id) — Stop a lease */
  async stopLease(leaseId: string): Promise<OperatorResponse<StopData>> {
    return this.callApi<StopData>('stop', [leaseId]);
  }

  /** api.get_status(app_name) — Get active lease status */
  async getStatus(appName: string | null = null): Promise<OperatorResponse<StatusData>> {
    return this.callApi<StatusData>('get_status', [appName]);
  }

  /** api.heartbeat(lease_id, user_name) — Send heartbeat */
  async heartbeat(
    leaseId: string,
    userName: string | null = null
  ): Promise<OperatorResponse<HeartbeatData>> {
    return this.callApi<HeartbeatData>('heartbeat', [leaseId, userName]);
  }

  /** api.list_apps() — List all managed apps */
  async listApps(): Promise<OperatorResponse<ListAppsData>> {
    return this.callApi<ListAppsData>('list_apps');
  }

  /** api.get_endpoints(app_name) — Get app endpoints */
  async getEndpoints(appName: string): Promise<OperatorResponse<EndpointsData>> {
    return this.callApi<EndpointsData>('get_endpoints', [appName]);
  }

  // ============================================================
  // Convenience methods
  // ============================================================

  /**
   * Test the connection by calling api.get_version().
   * Returns version info on success, or error details on failure.
   */
  async testConnection(): Promise<{
    ok: boolean;
    version?: VersionData;
    error?: string;
    compatible?: boolean;
  }> {
    try {
      const response = await this.getVersion();
      if (response.status === 'OK' && response.data) {
        return {
          ok: true,
          version: response.data,
          compatible: this.isCompatible(response.data.min_gallery_version),
        };
      }
      return {
        ok: false,
        error: response.error?.message ?? 'Unknown error from get_version',
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if this Gallery version meets the Operator's minimum requirement.
   */
  private isCompatible(minVersion: string): boolean {
    // Simple semver-ish comparison for now (1.0 >= 1.0)
    const GALLERY_VERSION = '1.0';
    return GALLERY_VERSION >= minVersion;
  }
}

// ============================================================
// Error class for Operator API errors
// ============================================================

export class OperatorApiError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'OperatorApiError';
    this.code = code;
    this.details = details;
  }
}
