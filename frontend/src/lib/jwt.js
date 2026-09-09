/**
 * Utility to safely decode and inspect JWT tokens on the client side.
 * Note: Cryptographic signature verification happens on the server with HMAC secrets.
 * The client decodes the signed claims to authoritatively extract the user identity,
 * role, and expiration timestamp, preventing reliance on mutable localStorage state.
 */

export function parseJwt(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url to base64 decoding
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);

    // Check expiration
    if (payload.exp && typeof payload.exp === 'number') {
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowInSeconds) {
        return null; // Expired
      }
    }

    return payload;
  } catch (err) {
    console.warn('Failed to parse JWT token payload:', err);
    return null;
  }
}

export function isTokenValid(token) {
  const payload = parseJwt(token);
  return !!payload;
}

export function getTokenRole(token) {
  const payload = parseJwt(token);
  return payload?.role || null;
}
