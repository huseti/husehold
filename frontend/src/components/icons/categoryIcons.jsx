// Flat, single-color icon set for shopping list categories -- same
// treatment as taskIcons.jsx (single currentColor fill, no gradients).

function Icon({ children, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" {...props}>
      {children}
    </svg>
  );
}

const ICONS = {
  produce: (props) => (
    <Icon {...props}>
      <path d="M12 9a1 1 0 0 1-1-1c0-1.8 1.2-3 2.7-3.3a.6.6 0 0 1 .7.7C14.1 6.8 13 8.1 12.6 8.8a1 1 0 0 1-.6.2Z" />
      <path d="M12 9c3.9 0 7 3.1 7 6.8 0 3.5-2.7 6.7-5.6 6.7-.5 0-1-.1-1.4-.3-.5.2-1 .3-1.4.3-2.9 0-5.6-3.2-5.6-6.7C5 12.1 8.1 9 12 9Z" />
    </Icon>
  ),
  bakery: (props) => (
    <Icon {...props}>
      <path d="M12 3c3 0 5.5 1.8 6 4.4.8.4 1.3 1.2 1.3 2.1 0 .5-.2 1-.5 1.4.6.7 1 1.6 1 2.6 0 3.6-3.5 6.5-8 6.5s-8-2.9-8-6.5c0-1 .4-1.9 1-2.6a2 2 0 0 1 .8-3.5C6.5 4.8 9 3 12 3Z" />
    </Icon>
  ),
  dairy: (props) => (
    <Icon {...props}>
      <path d="M8 2h8l1 4-2 2v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V8L7 6l1-4Zm1.6 2-.5 2h5.8l-.5-2H9.6Z" />
    </Icon>
  ),
  meat: (props) => (
    <Icon {...props}>
      <path d="M15 3a4.5 4.5 0 0 1 1.4 8.8l-3.1 3.1a4 4 0 0 1-1 4.6l-1.4 1.4a2.5 2.5 0 0 1-3.5-3.5l1.4-1.4a4 4 0 0 1 4.6-1l3.1-3.1A4.5 4.5 0 0 1 15 3Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
    </Icon>
  ),
  frozen: (props) => (
    <Icon {...props}>
      <path d="M11 2h2v20h-2V2Z" transform="rotate(0 12 12)" />
      <path d="M11 2h2v20h-2V2Z" transform="rotate(60 12 12)" />
      <path d="M11 2h2v20h-2V2Z" transform="rotate(120 12 12)" />
    </Icon>
  ),
  pantry: (props) => (
    <Icon {...props}>
      <path d="M8 2h8v3h-1v1h1a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1V5H8V2Zm1 8v9h6v-9H9Z" />
    </Icon>
  ),
  spices: (props) => (
    <Icon {...props}>
      <path d="M9 2h6v3.5c1.8.8 3 2.6 3 4.7V20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9.8c0-2.1 1.2-3.9 3-4.7V2Zm-1 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm4-2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-2 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" />
    </Icon>
  ),
  drinks: (props) => (
    <Icon {...props}>
      <path d="M7 4h10l-1.2 15.2A3 3 0 0 1 12.8 22h-1.6a3 3 0 0 1-3-2.8L7 4Zm1.7 3 1 12.4a1 1 0 0 0 1 .9h1.6a1 1 0 0 0 1-.9L14.3 7H8.7Z" />
    </Icon>
  ),
  sweets: (props) => (
    <Icon {...props}>
      <circle cx="12" cy="8" r="5" />
      <path d="M11 13h2l1.5 8a1 1 0 0 1-1 1.2h-3a1 1 0 0 1-1-1.2L11 13Z" />
    </Icon>
  ),
  household: (props) => (
    <Icon {...props}>
      <path d="M10 2h3v2h1a1 1 0 0 1 1 1v1.2l2 1V9h-1v1l1 1v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9.5L9 8V6a1 1 0 0 1 1-1V2Z" />
    </Icon>
  ),
  other: (props) => (
    <Icon {...props}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-3.6h-2c0-3 2.6-2.7 2.6-4.7 0-1-.9-1.7-2-1.7-.9 0-1.7.5-1.9 1.3l-1.8-.8C8.3 6.2 9.9 5 12 5c2.2 0 4 1.5 4 3.6 0 2.4-2.6 2.6-3 4.8Z" />
    </Icon>
  ),
};

export const CATEGORY_ICON_KEYS = Object.keys(ICONS);

export default function CategoryIcon({ icon, className = '', ...props }) {
  const Component = ICONS[icon] || ICONS.other;
  return <Component className={className} {...props} />;
}
