/**
 * Unified Launcher for North Star MCP
 * Starts API server and dashboard automatically with dynamic ports
 */

import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import portfinder from 'portfinder';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

interface ServerInfo {
  process: ChildProcess;
  port: number;
  url: string;
}

let apiServer: ServerInfo | null = null;
let dashboardServer: ServerInfo | null = null;

/**
 * Find an available port starting from the given base port
 */
async function findAvailablePort(basePort: number): Promise<number> {
  portfinder.basePort = basePort;
  return await portfinder.getPortPromise();
}

/**
 * Start the API server on a dynamic port
 */
async function startApiServer(): Promise<ServerInfo> {
  const port = await findAvailablePort(3001);

  return new Promise((resolve, reject) => {
    const apiProcess = spawn('node', ['build/api-server.js'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        PORT: port.toString(),
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let started = false;

    apiProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('North Star API server running') && !started) {
        started = true;
        const info: ServerInfo = {
          process: apiProcess,
          port,
          url: `http://localhost:${port}`,
        };
        resolve(info);
      }
    });

    apiProcess.stderr?.on('data', (data) => {
      // Forward stderr but don't treat as error during startup
      process.stderr.write(data);
    });

    apiProcess.on('error', (error) => {
      if (!started) {
        reject(new Error(`Failed to start API server: ${error.message}`));
      }
    });

    apiProcess.on('exit', (code) => {
      if (!started && code !== 0) {
        reject(new Error(`API server exited with code ${code}`));
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!started) {
        apiProcess.kill();
        reject(new Error('API server startup timeout'));
      }
    }, 10000);
  });
}

/**
 * Start the dashboard on a dynamic port
 */
async function startDashboard(apiUrl: string): Promise<ServerInfo> {
  const port = await findAvailablePort(5173);

  return new Promise((resolve, reject) => {
    const dashboardProcess = spawn(
      'npm',
      ['run', 'dev', '--', '--port', port.toString(), '--host'],
      {
        cwd: join(projectRoot, 'dashboard'),
        env: {
          ...process.env,
          VITE_API_URL: apiUrl,
          NODE_ENV: 'production',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      }
    );

    let started = false;

    dashboardProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local:') && !started) {
        started = true;
        const info: ServerInfo = {
          process: dashboardProcess,
          port,
          url: `http://localhost:${port}`,
        };
        resolve(info);
      }
    });

    dashboardProcess.stderr?.on('data', (data) => {
      // Forward stderr
      process.stderr.write(data);
    });

    dashboardProcess.on('error', (error) => {
      if (!started) {
        reject(new Error(`Failed to start dashboard: ${error.message}`));
      }
    });

    dashboardProcess.on('exit', (code) => {
      if (!started && code !== 0) {
        reject(new Error(`Dashboard exited with code ${code}`));
      }
    });

    // Timeout after 30 seconds (Vite can take longer)
    setTimeout(() => {
      if (!started) {
        dashboardProcess.kill();
        reject(new Error('Dashboard startup timeout'));
      }
    }, 30000);
  });
}

/**
 * Start all servers
 */
export async function startAllServers(): Promise<void> {
  try {
    console.error('\n🚀 Starting North Star MCP System...\n');

    // Start API server first
    console.error('📡 Starting API server...');
    apiServer = await startApiServer();
    console.error(`✅ API server running at ${apiServer.url}\n`);

    // Update dashboard MCP client with dynamic API URL
    const apiUrl = `${apiServer.url}/api`;

    // Start dashboard
    console.error('🎨 Starting dashboard...');
    dashboardServer = await startDashboard(apiUrl);
    console.error(`✅ Dashboard running at ${dashboardServer.url}\n`);

    // Report final URLs
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('🎉 North Star MCP System Ready!');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`📊 Dashboard: ${dashboardServer.url}`);
    console.error(`🔌 API:       ${apiServer.url}`);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (error) {
    console.error('❌ Failed to start servers:', error);
    await stopAllServers();
    throw error;
  }
}

/**
 * Stop all servers
 */
export async function stopAllServers(): Promise<void> {
  console.error('\n🛑 Stopping North Star MCP System...\n');

  if (dashboardServer) {
    console.error('Stopping dashboard...');
    dashboardServer.process.kill();
    dashboardServer = null;
  }

  if (apiServer) {
    console.error('Stopping API server...');
    apiServer.process.kill();
    apiServer = null;
  }

  console.error('✅ All servers stopped\n');
}

/**
 * Get server information
 */
export function getServerInfo(): { api: ServerInfo | null; dashboard: ServerInfo | null } {
  return {
    api: apiServer,
    dashboard: dashboardServer,
  };
}

// Handle process termination
process.on('SIGINT', async () => {
  await stopAllServers();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopAllServers();
  process.exit(0);
});
