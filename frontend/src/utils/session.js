import { clearApiCache } from '../services/apiCache';

// Log out on this device: forget the tokens and everything cached for this user.
export function logout(navigate) {
  clearApiCache();
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  navigate('/login');
}
