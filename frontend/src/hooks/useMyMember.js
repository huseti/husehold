import { useEffect, useState } from 'react';
import { memberService } from '../services/api';

// The logged-in user's HouseholdMember (avatar, color, name), or null while
// loading / for accounts without one. Returns [member, setMember] so an avatar
// change can update it in place.
export function useMyMember() {
  const [member, setMember] = useState(null);
  useEffect(() => {
    memberService.getMe().then((res) => setMember(res.data)).catch(() => {});
  }, []);
  return [member, setMember];
}
