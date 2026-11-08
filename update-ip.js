const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = __dirname;
const envPath = path.join(projectRoot, '.env');
const port = 8000;
const wifiInterfacePattern = /(wi[\s_-]?fi|wlan|wireless)/i;
const virtualInterfacePattern =
  /(virtualbox|vmware|vbox|wsl|hyper[- ]?v|vethernet|docker|container|loopback|bluetooth|tailscale|zerotier|vpn|wireguard|hamachi|tap|tun)/i;

function getWifiIPv4() {
  const interfaces = os.networkInterfaces();

  for (const [name, addresses] of Object.entries(interfaces)) {
    if (
      !wifiInterfacePattern.test(name) ||
      virtualInterfacePattern.test(name)
    ) {
      continue;
    }

    const ipv4 = addresses?.find((address) => {
      const isIPv4 = address.family === 'IPv4' || address.family === 4;
      return (
        isIPv4 &&
        !address.internal &&
        !address.address.startsWith('169.254.')
      );
    });

    if (ipv4) return ipv4.address;
  }

  throw new Error(
    'No se encontró una dirección IPv4 activa en una interfaz Wi-Fi. Conéctate a una red inalámbrica y vuelve a iniciar Expo.',
  );
}

function getApiScheme(envContent) {
  const match = envContent.match(
    /^\s*(?:export\s+)?EXPO_PUBLIC_API_SCHEME\s*=\s*(['"]?)([^'"\s#]+)\1\s*$/m,
  );
  const scheme = match ? match[2].toLowerCase() : 'http';

  if (scheme !== 'http' && scheme !== 'https') {
    throw new Error('EXPO_PUBLIC_API_SCHEME debe ser http o https.');
  }

  return scheme;
}

function updateEnvFile(ipAddress) {
  const current = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8')
    : '';
  const scheme = getApiScheme(current);
  const newline = current.includes('\r\n') ? '\r\n' : '\n';
  const lines = current
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:export\s+)?EXPO_PUBLIC_API_URL\s*=/.test(line));

  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  lines.push(`EXPO_PUBLIC_API_URL=${scheme}://${ipAddress}:${port}`);
  fs.writeFileSync(envPath, `${lines.join(newline)}${newline}`, 'utf8');
  return scheme;
}

try {
  const ipAddress = getWifiIPv4();
  const scheme = updateEnvFile(ipAddress);
  console.log(`EXPO_PUBLIC_API_URL actualizado para la interfaz Wi-Fi: ${scheme}://${ipAddress}:${port}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
