export function smbErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  const combined = `${code} ${raw}`;

  if (combined.includes("Docker Desktop") || combined.includes("MEDIA_PATH")) {
    return raw;
  }
  if (combined.includes("ERR_OSSL") || combined.includes("digital envelope")) {
    return "SMB login needs legacy OpenSSL (NTLM). Restart the container so NODE_OPTIONS=--openssl-legacy-provider is set.";
  }
  if (combined.includes("ENOTFOUND") || combined.includes("EAI_AGAIN")) {
    return "Host name could not be resolved inside Docker. Use the NAS IP address instead of a Windows computer name.";
  }
  if (combined.includes("ECONNREFUSED")) {
    return "Connection refused on port 445. Check that SMB is enabled and that Docker can reach the NAS.";
  }
  if (combined.includes("EHOSTUNREACH") || combined.includes("ENETUNREACH")) {
    return "The NAS is unreachable from the container. Use a LAN IP, not localhost.";
  }
  if (combined.includes("ETIMEDOUT") || combined.includes("TIMEOUT") || combined.includes("timed out")) {
    return "Timed out reaching the share. Check the IP, firewall, and that port 445 is allowed from Docker.";
  }
  if (combined.includes("STATUS_LOGON_FAILURE") || combined.includes("LOGON_FAILURE")) {
    return "SMB login failed. Check username, password, and domain (try empty, WORKGROUP, or the NAS name).";
  }
  if (combined.includes("STATUS_BAD_NETWORK_NAME") || combined.includes("BAD_NETWORK_NAME")) {
    return "Share name not found on that host. Use the share name only, e.g. movies — not the full UNC path.";
  }
  if (combined.includes("STATUS_ACCESS_DENIED") || combined.includes("ACCESS_DENIED")) {
    return "Access denied. The account may not have permission for that share or subfolder.";
  }
  if (combined.includes("STATUS_LOGON_TYPE_NOT_GRANTED")) {
    return "This account is not allowed to log on over the network.";
  }
  if (combined.includes("NT_STATUS_HOST_UNREACHABLE") || combined.includes("NT_STATUS_NETWORK_UNREACHABLE")) {
    return "Samba cannot reach the NAS from Docker. Same VLAN as the Windows host is not enough — the container sits in a VM. Use the LAN IP, or enable Docker Desktop host networking.";
  }
  if (combined.includes("protocol negotiation") || combined.includes("NT_STATUS_INVALID_NETWORK_RESPONSE")) {
    return "The NAS refused the SMB dialect. Enable SMB 2/3 on the NAS (SMB 1 only is not supported).";
  }
  if (combined.includes("NT_STATUS_PASSWORD_MUST_CHANGE") || combined.includes("NT_STATUS_PASSWORD_EXPIRED")) {
    return "The NAS account password must be changed before it can be used here.";
  }
  if (combined.includes("NT_STATUS_ACCOUNT_LOCKED_OUT") || combined.includes("NT_STATUS_ACCOUNT_DISABLED")) {
    return "The NAS account is locked or disabled.";
  }
  if (combined.includes("NT_STATUS_OBJECT_NAME_NOT_FOUND") || combined.includes("NT_STATUS_NO_SUCH_FILE")) {
    return "That subfolder does not exist on the share.";
  }

  const status = combined.match(/NT_STATUS_[A-Z0-9_]+/);
  if (status) {
    return `SMB error (${status[0]}). Check host IP, share name, username, and password.`;
  }

  return raw || "Could not connect to the SMB share.";
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
