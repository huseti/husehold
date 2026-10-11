import { User } from '@phosphor-icons/react/dist/csr/User';

// Small round avatar: the member's photo, else their initial on their color;
// a gray person placeholder when nobody is assigned (member is null).
export default function MemberAvatar({ member, sizeClass = 'h-6 w-6', title }) {
  const name = member ? (member.user.first_name || member.user.username) : null;
  return (
    <span
      className={`${sizeClass} rounded-full overflow-hidden inline-flex items-center justify-center text-[10px] font-semibold flex-shrink-0 align-middle ${member ? 'text-white' : 'bg-gray-200 text-gray-400 dark:bg-gray-600 dark:text-gray-300'}`}
      style={member ? { backgroundColor: member.color_hex } : undefined}
      title={title ?? name ?? undefined}
    >
      {member?.avatar ? (
        <img src={member.avatar} alt={name} className="h-full w-full object-cover" />
      ) : member ? (
        name?.[0]?.toUpperCase()
      ) : (
        <User weight="fill" size="70%" aria-hidden="true" />
      )}
    </span>
  );
}
